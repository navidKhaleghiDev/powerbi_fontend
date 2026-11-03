import { describe, expect, it } from "vitest";

import { syncModeSelector } from "../syncMode";
import type { SourceCapabilities } from "../syncMode";

/* ---------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

const baseCaps = (overrides: Partial<SourceCapabilities>): SourceCapabilities => ({
  estimatedRows: 10_000,
  hasCursor: false,
  hasChangeLog: false,
  hasCdcRetention: false,
  signalsDeletes: false,
  ...overrides,
});

describe("syncModeSelector — selectSyncMode", () => {
  it("selects log-cdc when change log + retention are available", () => {
    const caps = baseCaps({
      hasChangeLog: true,
      hasCdcRetention: true,
      signalsDeletes: true,
    });
    const { mode, reason } = syncModeSelector.selectSyncMode(caps);
    expect(mode).toBe("log-cdc");
    expect(reason).toContain("CDC");
  });

  it("selects incremental-polling when cursor is available but no change log", () => {
    const caps = baseCaps({ hasCursor: true });
    const { mode } = syncModeSelector.selectSyncMode(caps);
    expect(mode).toBe("incremental-polling");
  });

  it("warns about hard deletes when polling without delete signal", () => {
    const caps = baseCaps({
      hasCursor: true,
      signalsDeletes: false,
    });
    const { reason } = syncModeSelector.selectSyncMode(caps);
    expect(reason).toContain("miss hard deletes");
  });

  it("does not warn about deletes when polling with soft-delete flag", () => {
    const caps = baseCaps({
      hasCursor: true,
      signalsDeletes: true,
    });
    const { reason } = syncModeSelector.selectSyncMode(caps);
    expect(reason).not.toContain("miss hard deletes");
  });

  it("falls back to full-snapshot when no change tracking at all", () => {
    const caps = baseCaps({});
    const { mode } = syncModeSelector.selectSyncMode(caps);
    expect(mode).toBe("full-snapshot");
  });

  it("warns when full-snapshot is needed for a large table", () => {
    const caps = baseCaps({ estimatedRows: 500_000 });
    const { mode, reason } = syncModeSelector.selectSyncMode(caps);
    expect(mode).toBe("full-snapshot");
    expect(reason).toContain("large table");
  });

  it("does not warn for full-snapshot on small reference datasets", () => {
    const caps = baseCaps({ estimatedRows: 500 });
    const { reason } = syncModeSelector.selectSyncMode(caps);
    expect(reason).toContain("Small reference dataset");
  });

  it("prefers CDC over polling when both are available", () => {
    const caps = baseCaps({
      hasCursor: true,
      hasChangeLog: true,
      hasCdcRetention: true,
    });
    const { mode } = syncModeSelector.selectSyncMode(caps);
    expect(mode).toBe("log-cdc");
  });
});

describe("syncModeSelector — selectDeleteStrategy", () => {
  it("uses cdc-tombstone for log-cdc mode", () => {
    const caps = baseCaps({
      hasChangeLog: true,
      hasCdcRetention: true,
      signalsDeletes: true,
    });
    const strategy = syncModeSelector.selectDeleteStrategy("log-cdc", caps);
    expect(strategy).toBe("cdc-tombstone");
  });

  it("uses reconciliation for polling without delete signal", () => {
    const caps = baseCaps({
      hasCursor: true,
      signalsDeletes: false,
    });
    const strategy = syncModeSelector.selectDeleteStrategy(
      "incremental-polling",
      caps,
    );
    expect(strategy).toBe("reconciliation");
  });

  it("uses soft delete for polling with soft-delete flag", () => {
    const caps = baseCaps({
      hasCursor: true,
      signalsDeletes: true,
    });
    const strategy = syncModeSelector.selectDeleteStrategy(
      "incremental-polling",
      caps,
    );
    expect(strategy).toBe("soft");
  });

  it("uses soft delete for full-snapshot mode", () => {
    const caps = baseCaps({});
    const strategy = syncModeSelector.selectDeleteStrategy("full-snapshot", caps);
    expect(strategy).toBe("soft");
  });
});

describe("syncModeSelector — requiresResnapshot", () => {
  it("requires resnapshot when change log exists but retention expired", () => {
    const caps = baseCaps({
      hasChangeLog: true,
      hasCdcRetention: false,
    });
    expect(syncModeSelector.requiresResnapshot(caps)).toBe(true);
  });

  it("does not require resnapshot when retention is valid", () => {
    const caps = baseCaps({
      hasChangeLog: true,
      hasCdcRetention: true,
    });
    expect(syncModeSelector.requiresResnapshot(caps)).toBe(false);
  });

  it("does not require resnapshot when no change log at all", () => {
    const caps = baseCaps({
      hasChangeLog: false,
      hasCdcRetention: false,
    });
    expect(syncModeSelector.requiresResnapshot(caps)).toBe(false);
  });
});
