import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import type { DataFlow, MetricBinding, WorkspaceUser } from "@/lib/flows/types";

import { createSession } from "../auth";
import { handleWorkspaceRequest } from "../handler";
import { ClickHouse } from "../services";
import { readStore, updateStore } from "../store";
const flow: DataFlow = {
  id: "flow1",
  name: "Orders",
  kind: "csv",
  columns: [{ source: "id", target: "id", type: "String", required: true }],
  primaryKey: "id",
  grain: "one row",
  status: "published",
  activeLoadId: "load1",
  rowCount: 3,
  publishedAt: "2026-11-02",
  createdAt: "2026-11-02",
};
const binding: MetricBinding = {
  id: "binding1",
  metricId: "record_count",
  flowId: "flow1",
  fields: {},
  definition: "Count all published rows at the approved one-record grain.",
  currency: "",
  ownerId: "customer",
};
const users: WorkspaceUser[] = [
  {
    id: "provider",
    username: "provider",
    role: "provider",
    dataAccess: true,
    passwordHash: "unused",
    credentialVersion: 1,
  },
  {
    id: "customer",
    username: "customer",
    role: "customer",
    dataAccess: true,
    passwordHash: "unused",
    credentialVersion: 1,
  },
  {
    id: "other",
    username: "other",
    role: "customer",
    dataAccess: true,
    passwordHash: "unused",
    credentialVersion: 1,
  },
];
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "bi-governance-"));
  vi.stubEnv("CONTROL_CENTER_DATA_DIR", dir);
  updateStore((state) => {
    state.users = structuredClone(users);
    state.flows = [structuredClone(flow)];
    state.bindings = [structuredClone(binding)];
    state.infrastructure.clickhouse = {
      url: "http://warehouse:8123",
      database: "warehouse",
      user: "u",
      password: "secret",
    };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
const call = (route: string, user: string, body: unknown = {}) =>
  handleWorkspaceRequest(
    new Request("http://localhost/api/workspace/" + route, {
      method: "POST",
      headers: {
        cookie: `bi_workspace_session=${createSession(users.find((item) => item.id === user)!)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    route.split("/"),
  );
describe("KPI approval, reconciliation and report publication", () => {
  it("does not allow a customer to approve their own definition", async () =>
    expect((await call("metrics/binding1/approve", "customer")).status).toBe(
      403,
    ));
  it("blocks generation before review and validation", async () =>
    expect(
      (
        await call("metrics/generate", "customer", {
          bindingIds: ["binding1"],
          name: "Dashboard",
        })
      ).status,
    ).toBe(400));
  it("requires reconciliation to match before generating a publishable report", async () => {
    expect((await call("metrics/binding1/approve", "provider")).status).toBe(
      200,
    );
    vi.spyOn(ClickHouse.prototype, "query").mockResolvedValue([{ value: "3" }]);
    expect(
      (
        await call("metrics/binding1/validate", "customer", {
          expected: "999",
          tolerance: "0",
        })
      ).status,
    ).toBe(400);
    expect(readStore().bindings[0].validatedLoadId).toBeUndefined();
    expect(
      (
        await call("metrics/binding1/validate", "customer", {
          expected: "3",
          tolerance: "0",
        })
      ).status,
    ).toBe(200);
    const generated = await call("metrics/generate", "customer", {
      bindingIds: ["binding1"],
      name: "Trusted dashboard",
    });
    expect(generated.status).toBe(200);
    const report: { id: string } = await generated.json();
    expect(
      (await call(`reports/${report.id}/publish`, "customer")).status,
    ).toBe(200);
    expect(readStore().reports[0].publishedAt).toBeTruthy();
    expect(
      readStore().audit.some(
        (event) =>
          event.actorId === "provider" && event.action.includes("approve"),
      ),
    ).toBe(true);
  });
  it("invalidates readiness when a newer warehouse snapshot is published", async () => {
    updateStore((state) => {
      state.bindings[0].approvedAt = "now";
      state.bindings[0].validatedLoadId = "older-load";
    });
    expect(
      (
        await call("metrics/generate", "customer", {
          bindingIds: ["binding1"],
          name: "Stale dashboard",
        })
      ).status,
    ).toBe(400);
  });
  it("does not allow known identifiers to publish another customer private definition", async () => {
    updateStore((state) => {
      state.bindings[0].approvedAt = "now";
      state.bindings[0].validatedLoadId = "load1";
    });
    const response = await call("reports", "other", {
      name: "Stolen draft",
      widgets: [
        {
          id: "w",
          title: "x",
          bindingId: "binding1",
          flowId: "flow1",
          kind: "kpi",
          dimension: "",
          measure: "",
          aggregation: "count",
        },
      ],
    });
    expect(response.status).toBe(403);
  });
  it("records a KPI request even before a source exists without inventing executable logic", async () => {
    const response = await call("metrics/request", "customer", {
      metricId: "net_profit",
    });
    expect(response.status).toBe(200);
    const result: MetricBinding = await response.json();
    expect(result.flowId).toBe("");
    expect(result.approvedAt).toBeUndefined();
  });
});
