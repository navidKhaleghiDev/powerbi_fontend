import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DataFlow, ReportWidget } from "@/lib/flows/types";

import { normalizeRows } from "../import";
import {
  analyticsSql,
  captureDdl,
  currentStateSql,
  debeziumConfig,
  ident,
} from "../sql";
import { publicState, readStore, updateStore } from "../store";
const flow: DataFlow = {
  id: "abc123",
  name: "Sales",
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
  grain: "order",
  status: "draft",
  createdAt: "2026-11-02",
};
afterEach(() => vi.unstubAllEnvs());
describe("warehouse publication contracts", () => {
  it("preserves large exact decimal values", () =>
    expect(
      normalizeRows(flow, [{ id: "1", amount: "1234567890123456.12" }])[0]
        .amount,
    ).toBe("1234567890123456.12"));
  it.each(["12.345", "1e3", "NaN", "12345678901234567.00", ""])(
    "rejects imprecise money %s",
    (amount) =>
      expect(() => normalizeRows(flow, [{ id: "1", amount }])).toThrow(),
  );
  it("rejects duplicate keys before warehouse writes", () =>
    expect(() =>
      normalizeRows(flow, [
        { id: "1", amount: "1.00" },
        { id: "1", amount: "2.00" },
      ]),
    ).toThrow("duplicateKey"));
  it("rejects a changed source header", () =>
    expect(() => normalizeRows(flow, [{ id: "1", renamed: "1" }])).toThrow(
      "mappingMismatch",
    ));
  it("prevents SQL identifiers from becoming SQL fragments", () =>
    expect(() => ident("orders;DROP TABLE x")).toThrow());
  it("reads only the published snapshot and aggregates the entire snapshot before limiting groups", () => {
    const widget: ReportWidget = {
      id: "w",
      title: "Sales",
      flowId: flow.id,
      kind: "bar",
      dimension: "id",
      measure: "amount",
      aggregation: "sum",
    };
    expect(() => analyticsSql(flow, widget)).toThrow("notPublished");
    const sql = analyticsSql({ ...flow, activeLoadId: "load1" }, widget);
    expect(sql).toContain("_load_id='load1'");
    expect(sql).toContain("sum(`amount`)");
    expect(sql.indexOf("GROUP BY")).toBeLessThan(sql.indexOf("LIMIT 50"));
  });
  it("does not let a supplied measure name inject SQL", () => {
    expect(() =>
      analyticsSql(
        { ...flow, activeLoadId: "load" },
        {
          id: "w",
          title: "x",
          flowId: flow.id,
          kind: "bar",
          dimension: "id;drop",
          measure: "amount",
          aggregation: "sum",
        },
      ),
    ).toThrow();
  });
  it("creates Kafka raw landing before starting a source and keeps topic identity stable", () => {
    const source = {
      ...flow,
      kind: "postgres" as const,
      schema: "public",
      table: "orders",
    };
    const settings = {
      clickhouse: {
        url: "http://warehouse:8123",
        database: "warehouse",
        user: "u",
        password: "secret",
      },
      kafka: {
        connectUrl: "http://connect:8083",
        brokers: "kafka:9092",
        user: "",
        password: "",
      },
    };
    const ddl = captureDdl(source, settings).join("\n");
    expect(ddl).toContain("kafka_format='JSONAsString'");
    expect(ddl).toContain("_offset AS offset");
    expect(ddl).not.toContain("secret");
    const config = debeziumConfig(source, {
      id: "s",
      name: "ERP",
      host: "pg",
      port: 5432,
      database: "erp",
      user: "replica",
      password: "db-secret",
      ssl: false,
    });
    expect(config["tombstones.on.delete"]).toBe("false");
    expect(config["table.include.list"]).toBe("public\\.orders");
    expect(config.name).toBe("app_abc123");
    expect(config["topic.prefix"]).toBe("app_abc123");
    expect(config["column.include.list"]).toBe(["public","orders","id"].join(String.fromCharCode(92)+".")+","+["public","orders","amount"].join(String.fromCharCode(92)+"."));
  });
  it("bounds CDC publication by partition offsets and keeps tombstones before filtering deletes", () => {
    const sql = currentStateSql(flow, [{ partition: 0, offset: "123" }]);
    expect(sql).toContain("offset<=toUInt64('123')");
    expect(sql).toContain("argMax(tuple(");
    expect(sql).toContain("JSONExtractUInt(event,'source','lsn')");
    expect(sql).toContain("_quality_ok");
    expect(sql).toContain("{1,2}");
  });
  it("encrypts stored credentials and redacts every public response", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "powerbi-store-"));
    vi.stubEnv("CONTROL_CENTER_DATA_DIR", dir);
    try {
      updateStore((state) => {
        state.infrastructure.clickhouse.password = "warehouse-secret";
        state.connections.push({
          id: "s",
          name: "ERP",
          host: "pg",
          port: 5432,
          database: "erp",
          user: "u",
          password: "pg-secret",
          ssl: false,
        });
      });
      expect(readStore().connections[0].password).toBe("pg-secret");
      const response = JSON.stringify(
        publicState({
          id: "tester",
          username: "tester",
          role: "provider",
          dataAccess: true,
        }),
      );
      expect(response).not.toContain("pg-secret");
      expect(response).not.toContain("warehouse-secret");
      expect(response).toContain("hasPassword");
      expect(
        readFileSync(path.join(dir, "workspace.enc")).toString(),
      ).not.toContain("pg-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
