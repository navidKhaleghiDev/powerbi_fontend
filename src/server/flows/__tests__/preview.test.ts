import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataFlow, WorkspaceUser } from "@/lib/flows/types";

import { createSession } from "../auth";
import { deploymentStatus } from "../deployment";
import { handleWorkspaceRequest } from "../handler";
import { ClickHouse } from "../services";
import { updateStore } from "../store";

let directory: string;
const provider: WorkspaceUser = {
  id: "provider",
  username: "provider",
  role: "provider",
  dataAccess: true,
  passwordHash: "unused",
  credentialVersion: 1,
};
const customer: WorkspaceUser = {
  ...provider,
  id: "customer",
  username: "customer",
  role: "customer",
};
const flow: DataFlow = {
  id: "previewflow",
  name: "Orders",
  kind: "csv",
  grain: "one order",
  columns: [
    { source: "id", target: "order_id", type: "String", required: true },
    {
      source: "amount",
      target: "total_amount",
      type: "Decimal(18,2)",
      required: true,
    },
  ],
  primaryKey: "order_id",
  status: "published",
  activeLoadId: "verified-load",
  rowCount: 51,
  createdAt: "2026-11-02T00:00:00Z",
};
const request = (route: string, user?: WorkspaceUser) =>
  handleWorkspaceRequest(
    new Request("http://localhost/api/workspace/" + route, {
      headers: {
        cookie: user ? `bi_workspace_session=${createSession(user)}` : "",
      },
    }),
    route.split("?")[0].split("/"),
  );
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "bi-preview-"));
  vi.stubEnv("CONTROL_CENTER_DATA_DIR", directory);
  updateStore((state) => {
    state.users.push(provider, customer);
    state.flows.push(structuredClone(flow));
    state.infrastructure.clickhouse = {
      url: "http://warehouse",
      database: "warehouse",
      user: "app",
      password: "private-value",
    };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
describe("published data browsing authorization and snapshot scope", () => {
  it("rejects anonymous reads and providers without explicit data access", async () => {
    expect((await request("preview/previewflow")).status).toBe(401);
    updateStore((state) => {
      state.users[0].dataAccess = false;
    });
    expect((await request("preview/previewflow", provider)).status).toBe(403);
  });
  it("allows customer data reads but keeps deployment details provider-only", async () => {
    expect((await request("deployment", customer)).status).toBe(403);
    const query = vi
      .spyOn(ClickHouse.prototype, "query")
      .mockResolvedValue([{ order_id: "ord-1", total_amount: "125.50" }]);
    const response = await request("preview/previewflow", customer);
    expect(response.status).toBe(200);
    expect((await response.json()).rows).toEqual([
      { order_id: "ord-1", total_amount: "125.50" },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("_load_id='verified-load'"),
    );
  });
  it("reads only mapped columns from the published mart and bounds every page", async () => {
    const query = vi.spyOn(ClickHouse.prototype, "query").mockResolvedValue(
      Array.from({ length: 51 }, (_, i) => ({
        order_id: String(i),
        total_amount: "1.00",
      })),
    );
    const response = await request("preview/previewflow?page=1", provider);
    const body = await response.json();
    expect(body.rows).toHaveLength(50);
    expect(body.hasMore).toBe(true);
    expect(body.columns).toEqual(["order_id", "total_amount"]);
    expect(query).toHaveBeenCalledWith(
      "SELECT `order_id`,`total_amount` FROM `app_mart_previewflow` FINAL WHERE _load_id='verified-load' ORDER BY `order_id` LIMIT 51 OFFSET 50",
    );
    expect(JSON.stringify(body)).not.toContain("private-value");
  });
  it("rejects malformed or unbounded pages before contacting the warehouse", async () => {
    const query = vi.spyOn(ClickHouse.prototype, "query");
    for (const page of ["-1", "2000", "1;DROP TABLE x", "0.5"]) {
      expect(
        (
          await request(
            "preview/previewflow?page=" + encodeURIComponent(page),
            customer,
          )
        ).status,
      ).toBe(400);
    }
    expect(query).not.toHaveBeenCalled();
  });
  it("does not read unpublished data or replace warehouse errors with synthetic rows", async () => {
    updateStore((state) => {
      state.flows[0].activeLoadId = undefined;
    });
    const query = vi.spyOn(ClickHouse.prototype, "query");
    const response = await request("preview/previewflow", customer);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "notPublished" });
    expect(query).not.toHaveBeenCalled();
  });
  it("audits authorized data-preview reads", async () => {
    vi.spyOn(ClickHouse.prototype, "query").mockResolvedValue([]);
    await request("preview/previewflow", customer);
    const { readStore } = await import("../store");
    expect(readStore().audit).toContainEqual(
      expect.objectContaining({
        actorId: "customer",
        action: "preview.previewflow",
        targetId: "previewflow",
      }),
    );
  });
});
describe("historical deployment evidence", () => {
  it("requires the complete passing acceptance set and returns no private payload", () => {
    const folder = path.join(directory, "reports");
    mkdirSync(folder);
    const file = path.join(folder, "local-stack-verification.json");
    writeFileSync(
      file,
      JSON.stringify({
        at: "2026-11-02T00:00:00Z",
        checks: [{ name: "one-test", passed: true }],
        password: "never-expose",
      }),
    );
    expect(deploymentStatus().verifiedAt).toBeNull();
    const checks = [
      "debezium-task",
      "published-snapshot",
      "published-dashboard",
      "record_count",
      "sales_amount",
      "customer-redaction",
    ].map((name) => ({ name, passed: true }));
    writeFileSync(
      file,
      JSON.stringify({
        at: "2026-11-02T00:00:00Z",
        checks,
        password: "never-expose",
        totals: { amount: "12345" },
      }),
    );
    const status = deploymentStatus();
    expect(status.verifiedAt).toBe("2026-11-02T00:00:00Z");
    expect(JSON.stringify(status)).not.toContain("never-expose");
    expect(status).not.toHaveProperty("totals");
    checks[0].passed = false;
    writeFileSync(file, JSON.stringify({ at: "2026-11-02T00:00:00Z", checks }));
    expect(deploymentStatus().verifiedAt).toBeNull();
  });
});
