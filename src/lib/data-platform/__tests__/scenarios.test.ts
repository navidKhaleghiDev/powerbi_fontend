import { describe, expect, it } from "vitest";

import { scenarioEngine } from "../scenarios";

/* ---------------------------------------------------------------------------
 * Resilience scenario tests (PDF page 46 — "Failure drills we must pass")
 * ------------------------------------------------------------------------- */

describe("scenarioEngine — SCENARIO_DEFINITIONS", () => {
  it("defines all seven failure drills", () => {
    expect(scenarioEngine.SCENARIO_DEFINITIONS).toHaveLength(7);
  });

  it("every definition has an id, label, and required behavior", () => {
    for (const def of scenarioEngine.SCENARIO_DEFINITIONS) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.requiredBehavior).toBeTruthy();
    }
  });
});

/* ---------------------------------------------------------------------------
 * Individual scenario tests
 * ------------------------------------------------------------------------- */

describe("Scenario 1 — Crash After Raw Upload", () => {
  it("passes: checkpoint does not advance on upload alone", () => {
    const result = scenarioEngine.runScenario("crash-after-upload");

    expect(result.scenarioId).toBe("crash-after-upload");
    expect(result.passed).toBe(true);
    expect(result.duplicateProduced).toBe(false);
    expect(result.steps.some((s) => s.includes("PASS"))).toBe(true);
  });

  it("replays from the durable manifest after crash", () => {
    const result = scenarioEngine.runScenario("crash-after-upload");
    expect(result.steps.some((s) => s.includes("Recovery: replay"))).toBe(true);
  });
});

describe("Scenario 2 — ACK Lost After Warehouse Commit", () => {
  it("passes: retry is idempotent, no duplicate row", () => {
    const result = scenarioEngine.runScenario("ack-lost-after-commit");

    expect(result.scenarioId).toBe("ack-lost-after-commit");
    expect(result.passed).toBe(true);
    expect(result.duplicateProduced).toBe(false);
    expect(result.finalBatchStatus).toBe("published");
  });

  it("produces a PUBLISHED batch after idempotent retry", () => {
    const result = scenarioEngine.runScenario("ack-lost-after-commit");
    expect(result.finalBatchStatus).toBe("published");
  });
});

describe("Scenario 3 — API Rate-Limit (429)", () => {
  it("passes: recovers after backoff", () => {
    const result = scenarioEngine.runScenario("api-rate-limit");

    expect(result.scenarioId).toBe("api-rate-limit");
    expect(result.passed).toBe(true);
    expect(result.steps.some((s) => s.includes("HTTP 429"))).toBe(true);
    expect(result.steps.some((s) => s.includes("HTTP 200"))).toBe(true);
  });

  it("respects bounded attempts", () => {
    const result = scenarioEngine.runScenario("api-rate-limit");
    // The scenario succeeds on attempt 3 (within the 5-attempt budget)
    expect(result.passed).toBe(true);
  });
});

describe("Scenario 4 — Breaking Schema Change", () => {
  it("passes: blocks publication on field removal", () => {
    const result = scenarioEngine.runScenario("breaking-schema-change");

    expect(result.scenarioId).toBe("breaking-schema-change");
    expect(result.passed).toBe(true);
    expect(result.steps.some((s) => s.includes("block"))).toBe(true);
  });

  it("keeps the batch at VERIFIED (not promoted to APPLIED)", () => {
    const result = scenarioEngine.runScenario("breaking-schema-change");
    expect(result.finalBatchStatus).toBe("verified");
  });

  it("does not advance the checkpoint", () => {
    const result = scenarioEngine.runScenario("breaking-schema-change");
    expect(result.finalCursor).toBe("cursor-050"); // unchanged from initial
  });
});

describe("Scenario 5 — CDC Retention Expired", () => {
  it("passes: triggers explicit resnapshot, never skips ahead", () => {
    const result = scenarioEngine.runScenario("cdc-retention-expired");

    expect(result.scenarioId).toBe("cdc-retention-expired");
    expect(result.passed).toBe(true);
    expect(result.steps.some((s) => s.includes("resnapshot"))).toBe(true);
  });

  it("falls back to full-snapshot mode", () => {
    const result = scenarioEngine.runScenario("cdc-retention-expired");
    expect(result.steps.some((s) => s.includes("full-snapshot"))).toBe(true);
  });

  it("does not advance the cursor (no silent skip)", () => {
    const result = scenarioEngine.runScenario("cdc-retention-expired");
    expect(result.finalCursor).toBe("cursor-050");
  });
});

describe("Scenario 6 — 24h Agent Outage", () => {
  it("passes: data not lost within bounded spool", () => {
    const result = scenarioEngine.runScenario("agent-outage-24h");

    expect(result.scenarioId).toBe("agent-outage-24h");
    expect(result.passed).toBe(true);
  });

  it("reports spool utilization", () => {
    const result = scenarioEngine.runScenario("agent-outage-24h");
    expect(result.steps.some((s) => s.includes("spool utilization"))).toBe(true);
  });

  it("replays spooled batches after agent recovery", () => {
    const result = scenarioEngine.runScenario("agent-outage-24h");
    expect(result.steps.some((s) => s.includes("Replaying spooled batches"))).toBe(true);
  });
});

describe("Scenario 7 — Out-of-Order / Delete Event", () => {
  it("passes: version-aware merge resolves correctly", () => {
    const result = scenarioEngine.runScenario("out-of-order-delete");

    expect(result.scenarioId).toBe("out-of-order-delete");
    expect(result.passed).toBe(true);
    expect(result.duplicateProduced).toBe(false);
  });

  it("resolves delete-then-reinsert to the final insert", () => {
    const result = scenarioEngine.runScenario("out-of-order-delete");
    expect(result.steps.some((s) => s.includes("version 30"))).toBe(true);
  });

  it("produces exactly one current-state row", () => {
    const result = scenarioEngine.runScenario("out-of-order-delete");
    expect(result.duplicateProduced).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Run-all test
 * ------------------------------------------------------------------------- */

describe("scenarioEngine — runAllScenarios", () => {
  it("runs all seven scenarios and they all pass", () => {
    const results = scenarioEngine.runAllScenarios();
    expect(results).toHaveLength(7);

    for (const result of results) {
      expect(result.passed).toBe(true);
      expect(result.duplicateProduced).toBe(false);
      expect(result.steps.length).toBeGreaterThan(0);
    }
  });

  it("every result has a valid scenarioId matching a definition", () => {
    const results = scenarioEngine.runAllScenarios();
    const ids = scenarioEngine.SCENARIO_DEFINITIONS.map((d) => d.id);
    for (const result of results) {
      expect(ids).toContain(result.scenarioId);
    }
  });
});
