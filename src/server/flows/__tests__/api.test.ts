import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataFlow } from "@/lib/flows/types";

import { createSession } from "../auth";
import { FlowError } from "../errors";
import { handleWorkspaceRequest } from "../handler";
import { ClickHouse } from "../services";
import { readStore, updateStore } from "../store";
let directory: string;
const call = (route: string, body: unknown, origin = "http://localhost:3002") =>
  handleWorkspaceRequest(
    new Request(`http://localhost:3002/api/workspace/${route}`, {
      method: "POST",
      headers: {
        origin,
        "Content-Type": "application/json",
        cookie: `bi_workspace_session=${createSession(readStore().users[0])}`,
      },
      body: JSON.stringify(body),
    }),
    route.split("/"),
  );
const flow: DataFlow = {
  id: "testflow",
  name: "Customers",
  kind: "csv",
  columns: [
    { source: "id", target: "id", type: "String", required: true },
    {
      source: "amount",
      target: "amount",
      type: "Decimal(18,2)",
      required: true,
    },
  ],
  primaryKey: "id",
  grain: "customer",
  status: "published",
  activeLoadId: "previous",
  rowCount: 1,
  publishedAt: "2026-10-01",
  createdAt: "2026-10-01",
};
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "powerbi-api-"));
  vi.stubEnv("CONTROL_CENTER_DATA_DIR", directory);
  updateStore((state) =>
    state.users.push({
      id: "tester",
      username: "tester",
      role: "provider",
      dataAccess: true,
      passwordHash: "unused",
      credentialVersion: 1,
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
describe("workspace API and publication safety", () => {
  it("rejects cross-origin mutations without writing credentials", async () => {
    const response = await call(
      "connections",
      { password: "secret" },
      "https://other.example",
    );
    expect(response.status).toBe(403);
    expect(readStore().connections).toHaveLength(0);
  });
  it("saves credentials but does not expose them in the response", async () => {
    const response = await call("connections", {
      name: "ERP",
      host: "pg.internal",
      port: 5432,
      database: "erp",
      user: "replica",
      password: "private-password",
      ssl: false,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("private-password");
    expect(readStore().connections[0].password).toBe("private-password");
  });
  it("does not claim an unavailable service is connected", async () => {
    const response = await call("test/clickhouse", {});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "warehouseMissing" });
  });
  it("retains the previous published version on invalid input", async () => {
    updateStore((state) => {
      state.flows.push(flow);
    });
    const insert = vi.spyOn(ClickHouse.prototype, "insert");
    const response = await call("flows/testflow/import", {
      csv: "id,amount\n1,1.123",
      fileName: "customers.csv",
    });
    expect(response.status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
    expect(readStore().flows[0].activeLoadId).toBe("previous");
    expect(readStore().runs[0].status).toBe("failed");
  });
  it("does not advance the published pointer when a warehouse write fails", async () => {
    updateStore((state) => {
      state.flows.push(flow);
      state.infrastructure.clickhouse = {
        url: "http://warehouse:8123",
        database: "warehouse",
        user: "u",
        password: "secret",
      };
    });
    vi.spyOn(ClickHouse.prototype, "execute").mockResolvedValue();
    vi.spyOn(ClickHouse.prototype, "insert").mockRejectedValue(
      new FlowError("warehouseUnavailable", 502),
    );
    const response = await call("flows/testflow/import", {
      csv: "id,amount\n1,1.23",
      fileName: "customers.csv",
    });
    expect(response.status).toBe(502);
    expect(readStore().flows[0].activeLoadId).toBe("previous");
    expect(readStore().runs[0].status).toBe("failed");
  });
  it("publishes only after the complete row count has been verified", async () => {
    updateStore((state) => {
      state.flows.push(flow);
      state.infrastructure.clickhouse = {
        url: "http://warehouse:8123",
        database: "warehouse",
        user: "u",
        password: "secret",
      };
    });
    vi.spyOn(ClickHouse.prototype, "execute").mockResolvedValue();
    vi.spyOn(ClickHouse.prototype, "insert").mockResolvedValue();
    vi.spyOn(ClickHouse.prototype, "query").mockResolvedValue([{ count: "2" }]);
    const response = await call("flows/testflow/import", {
      csv: "id,amount\n1,1.23\n2,2.34",
      fileName: "customers.csv",
    });
    expect(response.status).toBe(200);
    const state = readStore();
    expect(state.flows[0].activeLoadId).not.toBe("previous");
    expect(state.flows[0].rowCount).toBe(2);
    expect(state.runs[0].status).toBe("published");
  });
  it("persists a new CSV flow without inventing a warehouse publication", async () => {
    const draft = {
      name: flow.name,
      kind: flow.kind,
      columns: flow.columns,
      primaryKey: flow.primaryKey,
      grain: flow.grain,
    };
    const response = await call("flows", draft);
    expect(response.status).toBe(200);
    const result: DataFlow = await response.json();
    expect(result.status).toBe("draft");
    expect(result.activeLoadId).toBeUndefined();
  });
});

describe('publication metadata is server-owned',()=>{
 it('rejects an injected active load ID on a new flow',async()=>{const response=await call('flows',{name:'Forged',kind:'csv',columns:flow.columns,primaryKey:'id',grain:'record',activeLoadId:'forged',status:'published'});expect(response.status).toBe(400);expect(readStore().flows).toHaveLength(0);});
 it('rejects an injected publication on a report draft',async()=>{const response=await call('reports',{name:'Forged',widgets:[],publishedAt:'now',publishedWidgets:[]});expect(response.status).toBe(400);expect(readStore().reports).toHaveLength(0);});
});
