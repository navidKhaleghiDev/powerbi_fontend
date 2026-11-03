import pg from "pg";

import { Http } from "@/lib/api/Http";
import type {
  DataFlow,
  Infrastructure,
  PostgresConnection,
  SourceTable,
} from "@/lib/flows/types";

import { FlowError } from "./errors";

export const withPostgres = async <T>(
  connection: PostgresConnection,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> => {
  const client = new pg.Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 7000,
    statement_timeout: 10000,
    options: "-c default_transaction_read_only=on",
  });
  try {
    await client.connect();
    return await work(client);
  } catch {
    throw new FlowError("postgresUnavailable", 502);
  } finally {
    await client.end().catch(() => undefined);
  }
};
export const discover = (
  connection: PostgresConnection,
): Promise<SourceTable[]> =>
  withPostgres(connection, async (client) => {
    const result = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
      character_maximum_length: number | null;
      datetime_precision: number | null;
      udt_schema: string;
      udt_name: string;
      is_nullable: string;
      is_pk: boolean;
    }>(
      `SELECT c.table_schema,c.table_name,c.column_name,c.data_type,c.numeric_precision,c.numeric_scale,c.character_maximum_length,c.datetime_precision,c.udt_schema,c.udt_name,c.is_nullable,EXISTS(SELECT 1 FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name=t.constraint_name AND k.constraint_schema=t.constraint_schema AND k.table_name=t.table_name WHERE t.constraint_type='PRIMARY KEY' AND t.table_schema=c.table_schema AND t.table_name=c.table_name AND k.column_name=c.column_name) AS is_pk FROM information_schema.columns c JOIN information_schema.tables b ON b.table_schema=c.table_schema AND b.table_name=c.table_name AND b.table_type='BASE TABLE' WHERE c.table_schema NOT IN ('pg_catalog','information_schema') ORDER BY c.table_schema,c.table_name,c.ordinal_position LIMIT 5000`,
    );
    const tables = new Map<string, SourceTable>();
    for (const row of result.rows) {
      const key = JSON.stringify([row.table_schema, row.table_name]);
      if (!tables.has(key))
        tables.set(key, {
          schema: row.table_schema,
          name: row.table_name,
          columns: [],
        });
      tables.get(key)?.columns.push({
        name: row.column_name,
        type:
          row.numeric_precision !== null
            ? `${row.data_type}(${row.numeric_precision},${row.numeric_scale ?? 0})`
            : row.character_maximum_length !== null
              ? `${row.data_type}(${row.character_maximum_length})`
              : row.datetime_precision !== null
                ? `${row.data_type}(${row.datetime_precision})`
                : row.data_type === "USER-DEFINED"
                  ? `${row.udt_schema}.${row.udt_name}`
                  : row.data_type,
        nullable: row.is_nullable === "YES",
        primaryKey: row.is_pk,
      });
    }
    return [...tables.values()];
  });
export class ClickHouse {
  private readonly transport: Http;
  constructor(private readonly settings: Infrastructure["clickhouse"]) {
    if (!settings.url || !settings.database)
      throw new FlowError("warehouseMissing");
    this.transport = new Http(settings.url.replace(/\/$/, ""), {
      headers: {
        "X-ClickHouse-User": settings.user || "default",
        "X-ClickHouse-Key": settings.password,
      },
      maxContentLength: 8 * 1024 * 1024,
      maxBodyLength: 8 * 1024 * 1024,
    });
  }
  async execute(sql: string): Promise<void> {
    try {
      await this.transport.post("", sql, {
        params: {
          database: this.settings.database,
          wait_end_of_query: 1,
          max_execution_time: 20,
        },
        headers: { "Content-Type": "text/plain" },
      });
    } catch {
      throw new FlowError("warehouseUnavailable", 502);
    }
  }
  async query<T>(sql: string): Promise<T[]> {
    try {
      const result = await this.transport.post<{ data: T[] }>(
        "",
        sql + " FORMAT JSON",
        {
          params: {
            database: this.settings.database,
            wait_end_of_query: 1,
            max_execution_time: 15,
            max_result_rows: 10000,
            output_format_json_quote_decimals: 1,
            output_format_json_quote_64bit_integers: 1,
            result_overflow_mode: "throw",
          },
          headers: { "Content-Type": "text/plain" },
        },
      );
      if (!Array.isArray(result.data)) throw new Error();
      return result.data;
    } catch {
      throw new FlowError("warehouseUnavailable", 502);
    }
  }
  async insert(
    table: string,
    rows: Record<string, string | number | null>[],
  ): Promise<void> {
    if (!rows.length) return;
    await this.execute(
      `INSERT INTO ${table} FORMAT JSONEachRow\n` +
        rows.map((row) => JSON.stringify(row)).join("\n"),
    );
  }
}
export const kafkaConnect = (settings: Infrastructure["kafka"]) => {
  if (!settings.connectUrl) throw new FlowError("kafkaMissing");
  return new Http(settings.connectUrl.replace(/\/$/, "") + "/", {
    auth: settings.user
      ? { username: settings.user, password: settings.password }
      : undefined,
  });
};
export const validateSourceContract = async (
  flow: DataFlow,
  connection: PostgresConnection,
) => {
  const tables = await discover(connection);
  const table = tables.find(
    (item) => item.schema === flow.schema && item.name === flow.table,
  );
  if (
    !table ||
    !flow.schemaContract ||
    flow.schemaContract.some(
      (expected) =>
        !table.columns.some(
          (actual) =>
            actual.name === expected.name &&
            actual.type === expected.type &&
            actual.nullable === expected.nullable &&
            actual.primaryKey === expected.primaryKey,
        ),
    )
  )
    throw new FlowError("schemaChanged");
};
