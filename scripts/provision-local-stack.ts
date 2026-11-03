import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

import { Http } from "../src/lib/api/Http";
import type {
  DataFlow,
  MetricBinding,
  MetricId,
  ReportWidget,
  SavedReport,
  WorkspaceState,
} from "../src/lib/flows/types";
import { handleAuth } from "../src/server/flows/auth";
import { ClickHouse } from "../src/server/flows/services";
import { tableName } from "../src/server/flows/sql";
import { dataDirectory } from "../src/server/flows/store";

const base = "http://127.0.0.1:3001";
const flowName = "سفارش‌های پایگاه محلی Docker";
const reportName = "داشبورد سفارش‌های پایگاه محلی";
const verifyOnly = process.argv.includes("--verify-only");
const exercise = process.argv.includes("--exercise-cdc");
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw Error("Missing local-stack setting: " + name);
  return value;
};
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
interface Check {
  name: string;
  passed: boolean;
  detail: string;
}
const checks: Check[] = [];
const check = (name: string, passed: boolean, detail: string) => {
  checks.push({ name, passed, detail });
  process.stdout.write(
    (passed ? "PASS " : "FAIL ") + name + ": " + detail + "\n",
  );
  if (!passed) throw Error("Acceptance check failed: " + name);
};
const authenticate = async (
  username: string,
  password: string,
  setup = false,
) => {
  const response = await handleAuth(
    new Request(base + "/api/auth/" + (setup ? "bootstrap" : "login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        ...(setup
          ? {
              dataAccess: true,
              setupKey: readFileSync(
                path.join(dataDirectory(), "bootstrap.key"),
                "utf8",
              ).trim(),
            }
          : {}),
      }),
    }),
    setup ? "bootstrap" : "login",
  );
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!response.ok || !cookie)
    throw Error(
      "Local account authentication failed; existing accounts were not changed.",
    );
  return new Http(base + "/api/workspace/", {
    headers: { Cookie: cookie },
    timeout: 300000,
  });
};
const sourceClient = () =>
  new pg.Client({
    host: "postgres",
    port: 5432,
    database: "bi_source",
    user: "bi_cdc",
    password: required("POSTGRES_CDC_PASSWORD"),
    connectionTimeoutMillis: 10000,
  });
const sourceTotals = async () => {
  const client = sourceClient();
  await client.connect();
  try {
    const result = await client.query<{
      records: string;
      customers: string;
      orders: string;
      amount: string;
    }>(
      "SELECT count(*)::text AS records,count(DISTINCT customer_id)::text AS customers,count(DISTINCT order_id)::text AS orders,sum(total_amount)::text AS amount FROM sales.orders",
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
};
const publishWhenCaughtUp = async (
  provider: Http,
  flow: DataFlow,
  warehouse: ClickHouse,
) => {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    // The seed is fixed and quiet except for the explicit CDC exercise. Check
    // the source count before and after publication, rather than treating task
    // RUNNING alone as evidence that a complete snapshot was captured.
    const expected = await sourceTotals();
    const raw = await warehouse.query<{ count: string }>(
      `SELECT count() AS count FROM ${tableName(flow, "raw")}`,
    );
    if (Number(raw[0]?.count) >= Number(expected.records)) {
      try {
        const result = await provider.post<{ rowCount: number }>(
          `flows/${flow.id}/publish`,
          {},
        );
        if (result.rowCount === Number(expected.records)) {
          return;
        }
      } catch {
        /* Bounded wait for a consistent CDC snapshot; final failure is explicit. */
      }
    }
    await wait(2000);
  }
  throw Error(
    "CDC did not catch up within 180 seconds. Inspect stack logs; no substitute data was published.",
  );
};
const main = async () => {
  if (
    process.env.LOCAL_STACK_ENABLED !== "1" ||
    dataDirectory() !== "/app/.data"
  )
    throw Error(
      "Run only with npm run stack:provision inside the dedicated Compose app.",
    );
  const session = await new Http(base + "/api/auth/").get<{
    needsSetup: boolean;
  }>("session");
  if (verifyOnly && session.needsSetup)
    throw Error("Provision the local stack before verification.");
  const provider = await authenticate(
    "local_provider",
    required("LOCAL_PROVIDER_PASSWORD"),
    session.needsSetup,
  );
  let state = await provider.get<WorkspaceState>("state");
  if (!verifyOnly) {
    if (!state.users?.some((user) => user.username === "local_customer"))
      await provider.post("users", {
        username: "local_customer",
        password: required("LOCAL_CUSTOMER_PASSWORD"),
        role: "customer",
        dataAccess: false,
      });
    await provider.post("settings", {
      clickhouse: {
        url: "http://clickhouse:8123",
        database: "bi_warehouse",
        user: "bi_app",
        password: required("CLICKHOUSE_PASSWORD"),
      },
      kafka: {
        connectUrl: "http://connect:8083",
        brokers: "kafka:9092",
        user: "",
        password: "",
      },
    });
    await provider.post("test/clickhouse", {});
    await provider.post("test/kafka", {});
    state = await provider.get<WorkspaceState>("state");
    if (
      !state.connections.some((item) => item.name === "Local Docker PostgreSQL")
    ) {
      await provider.post("connections", {
        name: "Local Docker PostgreSQL",
        host: "postgres",
        port: 5432,
        database: "bi_source",
        user: "bi_cdc",
        password: required("POSTGRES_CDC_PASSWORD"),
        ssl: false,
      });
    }
    state = await provider.get<WorkspaceState>("state");
    const connection = state.connections.find(
      (item) => item.name === "Local Docker PostgreSQL",
    );
    if (!connection) throw Error("Local source missing.");
    const test = await provider.post<{ walLevel: string }>("test/postgres", {
      connectionId: connection.id,
    });
    check(
      "postgres-logical-wal",
      test.walLevel === "logical",
      "source supports logical decoding",
    );
    if (!state.flows.some((item) => item.name === flowName)) {
      await provider.post("flows", {
        name: flowName,
        kind: "postgres",
        connectionId: connection.id,
        schema: "sales",
        table: "orders",
        grain: "هر ردیف یک سفارش آزمایشی یکتا؛ همهٔ وضعیت‌ها",
        primaryKey: "order_id",
        columns: [
          {
            source: "order_id",
            target: "order_id",
            type: "String",
            required: true,
          },
          {
            source: "customer_id",
            target: "customer_id",
            type: "String",
            required: true,
          },
          { source: "city", target: "city", type: "String", required: true },
          {
            source: "status",
            target: "status",
            type: "String",
            required: true,
          },
          {
            source: "total_amount",
            target: "total_amount",
            type: "Decimal(18,2)",
            required: true,
          },
          {
            source: "order_date",
            target: "order_date",
            type: "Date",
            required: true,
          },
        ],
      });
    }
  }
  state = await provider.get<WorkspaceState>("state");
  const flow = state.flows.find((item) => item.name === flowName);
  if (!flow) throw Error("Local source flow has not been provisioned.");
  const warehouse = new ClickHouse({
    url: "http://clickhouse:8123",
    database: "bi_warehouse",
    user: "bi_app",
    password: required("CLICKHOUSE_PASSWORD"),
  });
  if (!verifyOnly) await provider.post(`flows/${flow.id}/capture`, {});
  const deadline = Date.now() + 120000;
  let running = false;
  while (Date.now() < deadline) {
    const status = await provider.get<{
      connector: string;
      tasks: { state: string }[];
    }>(`flows/${flow.id}/status`);
    running =
      status.connector === "RUNNING" &&
      status.tasks.length > 0 &&
      status.tasks.every((task) => task.state === "RUNNING");
    if (running) break;
    if (verifyOnly) break;
    await wait(2000);
  }
  check("debezium-task", running, "connector and at least one task RUNNING");
  if (exercise) {
    const client = sourceClient();
    await client.connect();
    try {
      // This transaction operates only on dedicated synthetic verification IDs.
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO sales.orders VALUES ('cdc-proof-kept','cdc-proof-customer','Tehran','paid',10.00,'2026-11-02') ON CONFLICT(order_id) DO UPDATE SET total_amount=10.00",
      );
      await client.query(
        "UPDATE sales.orders SET total_amount=20.00 WHERE order_id='cdc-proof-kept'",
      );
      await client.query(
        "INSERT INTO sales.orders VALUES ('cdc-proof-deleted','cdc-proof-customer','Tehran','paid',5.00,'2026-11-02') ON CONFLICT(order_id) DO NOTHING",
      );
      await client.query(
        "DELETE FROM sales.orders WHERE order_id='cdc-proof-deleted'",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      await client.end();
    }
    const until = Date.now() + 120000;
    let caught = false;
    while (Date.now() < until) {
      const raw = await warehouse.query<{ kept: string; deleted: string }>(
        `SELECT countIf(JSONExtractString(event,'after','order_id')='cdc-proof-kept' AND JSONExtractString(event,'after','total_amount')='20.00') AS kept,countIf(JSONExtractString(event,'op')='d' AND JSONExtractString(event,'before','order_id')='cdc-proof-deleted') AS deleted FROM ${tableName(flow, "raw")}`,
      );
      if (Number(raw[0]?.kept) > 0 && Number(raw[0]?.deleted) > 0) {
        caught = true;
        break;
      }
      await wait(2000);
    }
    check(
      "cdc-insert-update-delete",
      caught,
      "new amount and delete envelope reached raw ClickHouse history",
    );
  }
  if (!verifyOnly) await publishWhenCaughtUp(provider, flow, warehouse);
  state = await provider.get<WorkspaceState>("state");
  const published = state.flows.find((item) => item.id === flow.id);
  check(
    "published-snapshot",
    !!published?.activeLoadId,
    "warehouse snapshot activated",
  );
  if (exercise && published?.activeLoadId) {
    const proof = await warehouse.query<{ kept: string; deleted: string }>(
      `SELECT countIf(order_id='cdc-proof-kept' AND total_amount=toDecimal64('20.00',2)) AS kept,countIf(order_id='cdc-proof-deleted') AS deleted FROM ${tableName(flow, "mart")} FINAL WHERE _load_id='${published.activeLoadId}'`,
    );
    check(
      "cdc-current-state",
      Number(proof[0]?.kept) === 1 && Number(proof[0]?.deleted) === 0,
      "updated row appears once; deleted row absent from published snapshot",
    );
  }
  const totals = await sourceTotals();
  const customer = await authenticate(
    "local_customer",
    required("LOCAL_CUSTOMER_PASSWORD"),
  );
  if (!verifyOnly) {
    const specs: {
      id: MetricId;
      fields: Record<string, string>;
      expected: string;
    }[] = [
      { id: "record_count", fields: {}, expected: totals.records },
      {
        id: "customer_count",
        fields: { customer_id: "customer_id" },
        expected: totals.customers,
      },
      {
        id: "order_count",
        fields: { order_id: "order_id" },
        expected: totals.orders,
      },
      {
        id: "sales_amount",
        fields: { amount: "total_amount" },
        expected: totals.amount,
      },
    ];
    for (const spec of specs) {
      state = await provider.get<WorkspaceState>("state");
      let binding = state.bindings.find(
        (item) =>
          item.metricId === spec.id &&
          item.flowId === flow.id &&
          item.definition.startsWith("LOCAL COMPOSE:"),
      );
      if (!binding)
        binding = await customer.post<MetricBinding>("metrics", {
          metricId: spec.id,
          flowId: flow.id,
          fields: spec.fields,
          currency: spec.id === "sales_amount" ? "USD" : "",
          definition:
            "LOCAL COMPOSE: شمارش و جمع سفارش‌های مصنوعی این جدول با همهٔ وضعیت‌ها؛ مبالغ آزمایشی USD هستند، نه درآمد قطعی یا سود سازمان.",
        });
      if (!binding.approvedAt)
        await provider.post(`metrics/${binding.id}/approve`, {});
      await customer.post(`metrics/${binding.id}/validate`, {
        expected: spec.expected,
        tolerance: "0",
      });
    }
    state = await customer.get<WorkspaceState>("state");
    const bindings = state.bindings.filter(
      (item) =>
        item.flowId === flow.id && item.definition.startsWith("LOCAL COMPOSE:"),
    );
    let report = state.reports.find((item) => item.name === reportName);
    if (!report)
      report = await customer.post<SavedReport>("metrics/generate", {
        name: reportName,
        bindingIds: bindings.map((item) => item.id),
      });
    const widgets: ReportWidget[] = bindings.map((binding) => ({
      id: randomUUID(),
      title: binding.metricId,
      flowId: flow.id,
      bindingId: binding.id,
      kind: "kpi",
      dimension: "",
      measure: binding.fields.amount || "",
      aggregation: "count",
    }));
    const amount = bindings.find((item) => item.metricId === "sales_amount");
    if (!amount) throw Error("Amount binding missing");
    for (const visual of [
      {
        title: "مبلغ سفارش‌ها بر اساس شهر",
        kind: "bar" as const,
        dimension: "city",
      },
      {
        title: "روند روزانهٔ مبلغ سفارش‌ها",
        kind: "line" as const,
        dimension: "order_date",
      },
      {
        title: "مبلغ بر اساس وضعیت",
        kind: "pie" as const,
        dimension: "status",
      },
      {
        title: "جزئیات جمع به تفکیک مشتری",
        kind: "table" as const,
        dimension: "customer_id",
      },
    ])
      widgets.push({
        id: randomUUID(),
        ...visual,
        flowId: flow.id,
        bindingId: amount.id,
        measure: "total_amount",
        aggregation: "sum",
      });
    report = await customer.post<SavedReport>("reports", {
      id: report.id,
      name: reportName,
      widgets,
    });
    await customer.post(`reports/${report.id}/publish`, {});
  }
  state = await customer.get<WorkspaceState>("state");
  const report = state.reports.find((item) => item.name === reportName);
  check(
    "published-dashboard",
    !!report?.publishedAt,
    "governed dashboard saved and published",
  );
  if (!report) throw Error("Report missing");
  for (const metricId of [
    "record_count",
    "customer_count",
    "order_count",
    "sales_amount",
  ]) {
    const binding = state.bindings.find(
      (item) =>
        item.flowId === flow.id &&
        item.metricId === metricId &&
        item.definition.startsWith("LOCAL COMPOSE:"),
    );
    const widget = report.widgets.find(
      (item) => item.bindingId === binding?.id && item.kind === "kpi",
    );
    if (!binding || !widget) throw Error("Dashboard metric missing");
    const result = await customer.post<{ rows: { value: string | number }[] }>(
      "analytics",
      widget,
    );
    const expected =
      metricId === "record_count"
        ? totals.records
        : metricId === "customer_count"
          ? totals.customers
          : metricId === "order_count"
            ? totals.orders
            : totals.amount;
    // Monetary value is reconciled exactly by the application above. Compare
    // string-decimal normal forms here without Number/float rounding.
    const normalize = (value: string) => {
      const [whole, fraction = ""] = value.split(".");
      return whole + "." + fraction.replace(/0+$/, "");
    };
    check(
      metricId,
      normalize(String(result.rows[0]?.value)) === normalize(expected),
      "matches independent PostgreSQL control total " + expected,
    );
  }
  for (const widget of report.widgets.filter((item) => item.kind !== "kpi")) {
    const result = await customer.post<{ rows: unknown[] }>(
      "analytics",
      widget,
    );
    check(
      "visual-" + widget.kind,
      result.rows.length > 0,
      "nonempty live warehouse result",
    );
  }
  const hidden =
    !("infrastructure" in state) || !state.infrastructure?.clickhouse?.url;
  check(
    "customer-redaction",
    hidden && !state.connections.length,
    "source credentials and infrastructure hidden",
  );
  const directory = path.join(dataDirectory(), "reports");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(directory, "local-stack-verification.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        mode: verifyOnly ? "verify" : exercise ? "exercise-cdc" : "provision",
        checks,
        totals,
        flowId: flow.id,
        reportId: report.id,
        source:
          "dedicated synthetic PostgreSQL database; real containers, not HTTP fixtures",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  process.stdout.write(
    "SUCCESS: /fa/analytics?report=" +
      report.id +
      " (select the local dashboard if necessary). Evidence saved privately in .data/reports/local-stack-verification.json.\n",
  );
};
main().catch((error: unknown) => {
  // Never print Axios error/config objects: they contain credentials.
  let message = error instanceof Error && error.name !== "AxiosError" ? error.message : "Local-stack setup failed";
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (data && typeof data === "object" && "error" in data && typeof data.error === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(data.error)) message += ": " + data.error;
    }
    if ("config" in error && error.config && typeof error.config === "object" && "url" in error.config && typeof error.config.url === "string" && /^[A-Za-z0-9_/-]+$/.test(error.config.url)) message += " (operation " + error.config.url + ")";
  }
  process.stderr.write(message + "\n");
  process.exitCode = 1;
});
