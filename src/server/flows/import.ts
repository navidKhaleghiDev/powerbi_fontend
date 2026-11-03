import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseCsv } from "@/lib/flows/csv";
import type { DataFlow, ImportRun } from "@/lib/flows/types";

import { FlowError, requireValue } from "./errors";
import { ClickHouse, validateSourceContract } from "./services";
import { currentStateSql, ident, literal, martDdl, tableName } from "./sql";
import { dataDirectory, readStore, updateStore } from "./store";
export const normalizeRows = (
  flow: DataFlow,
  rows: Record<string, string>[],
) => {
  const keys = new Set<string>();
  return rows.map((row) => {
    const result: Record<string, string | null> = {};
    for (const column of flow.columns) {
      const value = row[column.source];
      if (value === undefined) throw new FlowError("mappingMismatch");
      if (value === "") {
        if (column.required || column.target === flow.primaryKey)
          throw new FlowError("qualityFailed");
        result[column.target] = null;
        continue;
      }
      if (
        column.type === "Int64" &&
        (!/^-?\d+$/.test(value) ||
          BigInt(value) < BigInt("-9223372036854775808") ||
          BigInt(value) > BigInt("9223372036854775807"))
      )
        throw new FlowError("qualityFailed");
      if (
        column.type === "Float64" &&
        (!/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value) ||
          !Number.isFinite(Number(value)))
      )
        throw new FlowError("qualityFailed");
      if (
        column.type === "Decimal(18,2)" &&
        !/^-?\d{1,16}(\.\d{1,2})?$/.test(value)
      )
        throw new FlowError("qualityFailed");
      if (
        column.type === "Date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new FlowError("qualityFailed");
      result[column.target] = value;
    }
    const key = result[flow.primaryKey];
    if (!key || keys.has(key)) throw new FlowError("duplicateKey");
    keys.add(key);
    return result;
  });
};
const setRun = (id: string, status: ImportRun["status"], error?: string) =>
  updateStore((state) => {
    const run = requireValue(state.runs.find((r) => r.id === id));
    run.status = status;
    run.error = error;
  });
export const importCsv = async (
  flowId: string,
  text: string,
  fileName: string,
) => {
  const state = readStore();
  const flow = requireValue(state.flows.find((f) => f.id === flowId));
  if (flow.kind !== "csv") throw new FlowError("invalid");
  const parsed = parseCsv(text);
  const checksum = createHash("sha256").update(text).digest("hex");
  const loadId = checksum;
  const run: ImportRun = {
    id: randomUUID(),
    flowId,
    checksum,
    fileName: fileName.slice(0, 200),
    rowCount: parsed.rowCount,
    status: "uploaded",
    createdAt: new Date().toISOString(),
  };
  const directory = path.join(dataDirectory(), "raw");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(directory, run.id + ".csv"), text, { mode: 0o600 });
  updateStore((store) => {
    store.runs.unshift(run);
  });
  try {
    const rows = normalizeRows(flow, parsed.rows);
    setRun(run.id, "verified");
    const client = new ClickHouse(state.infrastructure.clickhouse);
    await client.execute(martDdl(flow));
    for (let start = 0; start < rows.length; start += 500)
      await client.insert(
        tableName(flow, "mart"),
        rows
          .slice(start, start + 500)
          .map((row) => ({ _load_id: loadId, ...row })),
      );
    const count = await client.query<{ count: string }>(
      `SELECT count() AS count FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(loadId)}`,
    );
    if (Number(count[0]?.count) !== rows.length)
      throw new FlowError("qualityFailed");
    setRun(run.id, "applied");
    updateStore((store) => {
      const item = requireValue(store.flows.find((f) => f.id === flowId));
      item.activeLoadId = loadId;
      item.rowCount = rows.length;
      item.status = "published";
      item.error = undefined;
      item.publishedAt = new Date().toISOString();
      requireValue(store.runs.find((r) => r.id === run.id)).status =
        "published";
    });
    return { runId: run.id, rowCount: rows.length };
  } catch (error) {
    const code = error instanceof FlowError ? error.code : "importFailed";
    setRun(run.id, "failed", code);
    throw new FlowError(code, 502);
  }
};
export const publishCdc = async (flowId: string) => {
  const state = readStore();
  const flow = requireValue(state.flows.find((f) => f.id === flowId));
  if (flow.kind !== "postgres" || !flow.connectorName)
    throw new FlowError("invalid");
  await validateSourceContract(
    flow,
    requireValue(
      state.connections.find(
        (connection) => connection.id === flow.connectionId,
      ),
    ),
  );
  const client = new ClickHouse(state.infrastructure.clickhouse);
  const bounds = await client.query<{ partition: number; offset: string }>(
    `SELECT partition,max(offset) AS offset FROM ${tableName(flow, "raw")} GROUP BY partition`,
  );
  if (!bounds.length) throw new FlowError("noCapturedData");
  const current = currentStateSql(flow, bounds);
  const checks = [
    "_quality_ok=0",
    ...flow.columns
      .filter((c) => c.required || c.target === flow.primaryKey)
      .map((c) => `${ident(c.target)} IS NULL`),
  ];
  const quality = await client.query<{ invalid: string; count: string }>(
    `SELECT count() AS count,countIf(${checks.join(" OR ") || "0"}) AS invalid FROM (${current})`,
  );
  if (Number(quality[0]?.invalid) > 0) throw new FlowError("qualityFailed");
  const loadId = createHash("sha256")
    .update(JSON.stringify(bounds.sort((a, b) => a.partition - b.partition)))
    .digest("hex");
  await client.execute(martDdl(flow));
  await client.execute(
    `INSERT INTO ${tableName(flow, "mart")} SELECT ${literal(loadId)},${flow.columns.map((c) => ident(c.target)).join(",")} FROM (${current})`,
  );
  const count = await client.query<{ count: string }>(
    `SELECT count() AS count FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(loadId)}`,
  );
  if (Number(count[0]?.count) !== Number(quality[0]?.count))
    throw new FlowError("qualityFailed");
  updateStore((store) => {
    const item = requireValue(store.flows.find((f) => f.id === flowId));
    item.activeLoadId = loadId;
    item.sourceWatermark = bounds;
    item.rowCount = Number(count[0]?.count);
    item.status = "published";
    item.publishedAt = new Date().toISOString();
    item.error = undefined;
  });
  return { rowCount: Number(count[0]?.count) };
};
