import { randomUUID } from "node:crypto";
import { sampleRows, sampleAnalytics } from "./sample";

import { parseCsv } from "@/lib/flows/csv";
import { metricCatalog, metricReadiness } from "@/lib/flows/metrics";
import type {
  DataFlow,
  PostgresConnection,
  ReportWidget,
  SessionUser,
  MetricBinding,
} from "@/lib/flows/types";

import { canReadBinding } from "./access";
import { hashPassword, requestUser, audit } from "./auth";
import { deploymentStatus } from "./deployment";
import { FlowError, requireValue } from "./errors";
import { importCsv, publishCdc } from "./import";
import { metricSql, readyWidgets, withinTolerance } from "./metrics";
import { readJsonBody } from "./request-body";
import {
  ClickHouse,
  discover,
  kafkaConnect,
  withPostgres,
  validateSourceContract,
} from "./services";
import {
  ident,
  literal,
  tableName,
  analyticsSql,
  captureDdl,
  debeziumConfig,
} from "./sql";
import { readStore, publicState, updateStore, withAuditContext } from "./store";
import {
  connectionSchema,
  flowSchema,
  infrastructureSchema,
  reportSchema,
  validate,
  widgetSchema,
} from "./validation";
const body = readJsonBody;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FlowError("invalid");
  return value as Record<string, unknown>;
};
const postgres = (id: string): PostgresConnection =>
  requireValue(readStore().connections.find((c) => c.id === id));
const run = async (
  request: Request,
  parts: string[],
  user: SessionUser,
): Promise<unknown> => {
  const [resource, id, action] = parts;
  if (request.method === "GET") {
    if (resource === "state") return publicState(user);
    if (resource === "deployment" && !id) return deploymentStatus();
    if (resource === "preview" && id && !action) {
      const flow = requireValue(
        readStore().flows.find((item) => item.id === id),
      );
      if (!flow.activeLoadId) throw new FlowError("notPublished");
      const rawPage = new URL(request.url).searchParams.get("page") || "0";
      if (!/^(0|[1-9][0-9]{0,3})$/.test(rawPage) || Number(rawPage) > 1999)
        throw new FlowError("invalid");
      const page = Number(rawPage);
      const rows = flow.sampleData ? sampleRows.slice(page * 50, page * 50 + 51) : await new ClickHouse(
        readStore().infrastructure.clickhouse,
      ).query<Record<string, string | number | null>>(
        `SELECT ${flow.columns.map((column) => ident(column.target)).join(",")} FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(flow.activeLoadId)} ORDER BY ${ident(flow.primaryKey)} LIMIT 51 OFFSET ${page * 50}`,
      );
      return {
        columns: flow.columns.map((column) => column.target),
        rows: rows.slice(0, 50),
        page,
        pageSize: 50,
        hasMore: rows.length > 50,
        loadId: flow.activeLoadId,
        publishedAt: flow.publishedAt,
        queriedAt: new Date().toISOString(),
      };
    }
    if (resource === "connections" && id && action === "discover")
      return discover(postgres(id));
    if (resource === "flows" && id && action === "plan") {
      const state = readStore();
      const flow = requireValue(state.flows.find((f) => f.id === id));
      return {
        sql:
          flow.kind === "postgres"
            ? captureDdl(flow, state.infrastructure)
            : [],
        topic:
          flow.kind === "postgres"
            ? `app_${id}.${flow.schema}.${flow.table}`
            : null,
      };
    }
    if (resource === "flows" && id && action === "status") {
      const state = readStore();
      const flow = requireValue(state.flows.find((f) => f.id === id));
      if (!flow.connectorName) return { connector: null };
      try {
        const result = await kafkaConnect(state.infrastructure.kafka).get<{
          connector: { state: string };
          tasks: { id: number; state: string }[];
        }>(`connectors/${encodeURIComponent(flow.connectorName)}/status`);
        return {
          connector: result.connector.state,
          tasks: result.tasks.map((t) => ({ id: t.id, state: t.state })),
        };
      } catch {
        throw new FlowError("kafkaUnavailable", 502);
      }
    }
    throw new FlowError("notFound", 404);
  }
  if (request.method !== "POST") throw new FlowError("notFound", 404);
  const input = await body(request);
  if (resource === "settings") {
    const value = await validate(infrastructureSchema, input);
    const previous = readStore();
    if (
      previous.flows.some((flow) => flow.activeLoadId || flow.connectorName)
    ) {
      if (
        value.clickhouse.url !== previous.infrastructure.clickhouse.url ||
        value.clickhouse.database !==
          previous.infrastructure.clickhouse.database ||
        value.kafka.connectUrl !== previous.infrastructure.kafka.connectUrl ||
        value.kafka.brokers !== previous.infrastructure.kafka.brokers
      )
        throw new FlowError("infrastructureInUse", 409);
    }
    updateStore((state) => {
      state.infrastructure = {
        clickhouse: {
          ...value.clickhouse,
          password:
            value.clickhouse.password ||
            state.infrastructure.clickhouse.password,
        },
        kafka: {
          ...value.kafka,
          password: value.kafka.password || state.infrastructure.kafka.password,
        },
      };
    });
    return publicState(user);
  }
  if (resource === "connections" && !id) {
    const value = await validate(connectionSchema, input);
    const connection = { ...value, id: randomUUID() };
    updateStore((state) => {
      state.connections.push(connection);
    });
    return publicState(user);
  }
  if (resource === "users") {
    const value = object(input);
    if (
      typeof value.username !== "string" ||
      !/^[A-Za-z0-9_.@-]{3,80}$/.test(value.username) ||
      typeof value.password !== "string" ||
      !["provider", "customer"].includes(String(value.role))
    )
      throw new FlowError("invalid");
    if (value.dataAccess === true && !user.dataAccess)
      throw new FlowError("forbidden", 403);
    const account = {
      id: randomUUID(),
      username: value.username,
      role: value.role as "provider" | "customer",
      dataAccess: value.role === "customer" || value.dataAccess === true,
      passwordHash: hashPassword(value.password),
      credentialVersion: 1,
    };
    updateStore((state) => {
      if (
        state.users.some(
          (existing) =>
            existing.username.toLowerCase() === account.username.toLowerCase(),
        )
      )
        throw new FlowError("userExists");
      state.users.push(account);
    });
    return publicState(user);
  }
  if (resource === "metrics") {
    const state = readStore();
    const value = object(input);
    if (id === "request") {
      const spec = requireValue(
        metricCatalog.find((item) => item.id === value.metricId),
      );
      const existing = state.bindings.find(
        (item) =>
          item.ownerId === user.id &&
          item.metricId === spec.id &&
          !item.definition &&
          !item.requestResolved,
      );
      if (existing) return existing;
      const request: MetricBinding = {
        id: randomUUID(),
        metricId: spec.id,
        flowId: "",
        fields: {},
        currency: "",
        definition: "",
        ownerId: user.id,
      };
      updateStore((store) => store.bindings.push(request));
      return request;
    }
    if (!id) {
      const spec = requireValue(
        metricCatalog.find((item) => item.id === value.metricId),
      );
      if (!spec.supported) throw new FlowError("metricUnsupported");
      const flow = requireValue(
        state.flows.find(
          (item) => item.id === value.flowId && item.activeLoadId,
        ),
      );
      const fields = object(value.fields);
      if (
        Object.values(fields).some(
          (field) =>
            typeof field !== "string" ||
            !flow.columns.some((column) => column.target === field),
        )
      )
        throw new FlowError("mappingMismatch");
      if (
        typeof value.definition !== "string" ||
        value.definition.trim().length < 30 ||
        value.definition.length > 2000 ||
        typeof value.currency !== "string"
      )
        throw new FlowError("definitionRequired");
      const binding: MetricBinding = {
        id: randomUUID(),
        metricId: spec.id,
        flowId: flow.id,
        fields: fields as Record<string, string>,
        currency: value.currency,
        definition: value.definition,
        ownerId: user.id,
      };
      metricSql(flow, binding);
      updateStore((store) => {
        store.bindings
          .filter(
            (item) =>
              item.ownerId === user.id &&
              item.metricId === binding.metricId &&
              !item.definition,
          )
          .forEach((item) => {
            item.requestResolved = true;
          });
        store.bindings.push(binding);
      });
      return binding;
    }
    if (id === "generate") {
      if (
        !Array.isArray(value.bindingIds) ||
        !value.bindingIds.length ||
        value.bindingIds.length > 12 ||
        typeof value.name !== "string" ||
        !value.name.trim() ||
        value.name.length > 100
      )
        throw new FlowError("invalid");
      const bindings = value.bindingIds.map((bindingId) =>
        requireValue(
          state.bindings.find(
            (item) =>
              item.id === bindingId &&
              (user.role === "provider" || item.ownerId === user.id),
          ),
        ),
      );
      const widgets: ReportWidget[] = bindings.map((binding) => ({
        id: randomUUID(),
        title: binding.metricId,
        flowId: binding.flowId,
        bindingId: binding.id,
        kind: "kpi",
        dimension: "",
        measure: binding.fields.amount || "",
        aggregation: "count",
      }));
      readyWidgets(widgets, bindings, state.flows);
      const report = {
        id: randomUUID(),
        name: value.name,
        widgets,
        updatedAt: new Date().toISOString(),
        ownerId: user.id,
        revision: 1,
      };
      updateStore((store) => store.reports.push(report));
      return report;
    }
    const binding = requireValue(
      state.bindings.find(
        (item) =>
          item.id === id &&
          (user.role === "provider" || item.ownerId === user.id),
      ),
    );
    const flow = requireValue(
      state.flows.find((item) => item.id === binding.flowId),
    );
    if (action === "approve") {
      if (!binding.definition || !binding.flowId)
        throw new FlowError("definitionRequired");
      if (user.role !== "provider") throw new FlowError("forbidden", 403);
      updateStore((store) => {
        const item = requireValue(store.bindings.find((row) => row.id === id));
        item.approvedBy = user.id;
        item.approvedAt = new Date().toISOString();
        item.validatedLoadId = undefined;
      });
      return { ok: true };
    }
    if (action === "validate") {
      if (!user.dataAccess) throw new FlowError("dataAccessRequired", 403);
      if (!binding.approvedAt) throw new FlowError("metricNotReady");
      if (
        typeof value.expected !== "string" ||
        typeof value.tolerance !== "string"
      )
        throw new FlowError("invalid");
      const spec = requireValue(
        metricCatalog.find((item) => item.id === binding.metricId),
      );
      const client = new ClickHouse(state.infrastructure.clickhouse);
      if (spec.fields.length) {
        const fields = spec.fields.map((field) => ident(binding.fields[field]));
        const checks = await client.query<{ invalid: string }>(
          `SELECT countIf(${fields.map((field) => `(${field} IS NULL OR toString(${field})='')`).join(" OR ")}) AS invalid FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(flow.activeLoadId || "")}`,
        );
        if (Number(checks[0]?.invalid || 0) > 0)
          throw new FlowError("qualityFailed");
      }
      const rows = await client.query<{ value: string | number | null }>(
        metricSql(flow, binding),
      );
      const actual = String(rows[0]?.value ?? "");
      if (!withinTolerance(actual, value.expected, value.tolerance))
        throw new FlowError("reconciliationFailed");
      updateStore((store) => {
        const item = requireValue(store.bindings.find((row) => row.id === id));
        item.expected = value.expected as string;
        item.tolerance = value.tolerance as string;
        item.actual = actual;
        item.validatedLoadId = flow.activeLoadId;
        item.validatedAt = new Date().toISOString();
      });
      return { actual };
    }
    throw new FlowError("notFound", 404);
  }
  if (resource === "test") {
    const state = readStore();
    if (id === "clickhouse") {
      const rows = await new ClickHouse(state.infrastructure.clickhouse).query<{
        version: string;
      }>("SELECT version() AS version");
      if (typeof rows[0]?.version !== "string")
        throw new FlowError("warehouseUnavailable", 502);
      return { ok: true, version: rows[0].version };
    }
    if (id === "kafka") {
      try {
        const plugins = await kafkaConnect(state.infrastructure.kafka).get<
          { class: string }[]
        >("connector-plugins");
        if (
          !plugins.some(
            (p) =>
              p.class === "io.debezium.connector.postgresql.PostgresConnector",
          )
        )
          throw new FlowError("pluginMissing");
        return { ok: true };
      } catch (error) {
        if (error instanceof FlowError) throw error;
        throw new FlowError("kafkaUnavailable", 502);
      }
    }
    if (id === "postgres") {
      const connectionId = object(input).connectionId;
      if (typeof connectionId !== "string") throw new FlowError("invalid");
      return withPostgres(postgres(connectionId), async (client) => {
        const result = await client.query<{ wal_level: string }>(
          "SHOW wal_level",
        );
        return { ok: true, walLevel: result.rows[0]?.wal_level };
      });
    }
  }
  if (resource === "csv" && id === "preview") {
    const value = object(input);
    if (typeof value.csv !== "string") throw new FlowError("invalid");
    try {
      const result = parseCsv(value.csv);
      return { ...result, rows: result.rows.slice(0, 5) };
    } catch (error) {
      throw new FlowError(
        error instanceof Error ? error.message : "csvInvalid",
      );
    }
  }
  if (resource === "flows" && !id) {
    const value = await validate(flowSchema, input);
    if (
      new Set(value.columns.map((c) => c.target)).size !==
        value.columns.length ||
      !value.columns.some((c) => c.target === value.primaryKey)
    )
      throw new FlowError("invalid");
    let schemaContract: DataFlow["schemaContract"];
    if (value.kind === "postgres") {
      if (
        value.columns.some(
          (column) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.source),
        )
      )
        throw new FlowError("invalid");
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.schema || "") ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.table || "")
      )
        throw new FlowError("invalid");
      const connection = postgres(value.connectionId || "");
      const tables = await discover(connection);
      const table = requireValue(
        tables.find((t) => t.schema === value.schema && t.name === value.table),
      );
      schemaContract = table.columns.filter((c) =>
        value.columns.some((mapping) => mapping.source === c.name),
      );
      const keys = table.columns.filter((c) => c.primaryKey);
      if (
        keys.length !== 1 ||
        !value.columns.some(
          (c) => c.source === keys[0].name && c.target === value.primaryKey,
        )
      )
        throw new FlowError("singleKeyRequired");
      if (
        value.columns.some(
          (c) => !table.columns.some((s) => s.name === c.source),
        )
      )
        throw new FlowError("mappingMismatch");
    }
    const flow: DataFlow = {
      ...value,
      schemaContract,
      id: randomUUID().replaceAll("-", ""),
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    updateStore((state) => {
      state.flows.push(flow);
    });
    return flow;
  }
  if (resource === "flows" && id) {
    const state = readStore();
    const flow = requireValue(state.flows.find((f) => f.id === id));
    if (action === "import") {
      const value = object(input);
      if (typeof value.csv !== "string" || typeof value.fileName !== "string")
        throw new FlowError("invalid");
      return importCsv(id, value.csv, value.fileName);
    }
    if (action === "publish") return publishCdc(id);
    if (action === "capture") {
      if (flow.kind !== "postgres") throw new FlowError("invalid");
      const connection = postgres(flow.connectionId || "");
      await validateSourceContract(flow, connection);
      const config = debeziumConfig(flow, connection);
      const name = "app_" + flow.id;
      try {
        const connect = kafkaConnect(state.infrastructure.kafka);
        const validation = await connect.put<{ error_count: number }>(
          "connector-plugins/io.debezium.connector.postgresql.PostgresConnector/config/validate",
          config,
        );
        if (validation.error_count) throw new FlowError("connectorInvalid");
        const warehouse = new ClickHouse(state.infrastructure.clickhouse);
        for (const sql of captureDdl(flow, state.infrastructure))
          await warehouse.execute(sql);
        await connect.put(
          `connectors/${encodeURIComponent(name)}/config`,
          config,
        );
        updateStore((store) => {
          const item = requireValue(store.flows.find((f) => f.id === id));
          item.connectorName = name;
          item.status = item.activeLoadId ? "published" : "capture_started";
          item.error = undefined;
        });
        return { ok: true, connectorName: name };
      } catch (error) {
        const code =
          error instanceof FlowError ? error.code : "kafkaUnavailable";
        updateStore((store) => {
          const item = requireValue(store.flows.find((f) => f.id === id));
          if (!item.activeLoadId) item.status = "failed";
          item.error = code;
        });
        throw new FlowError(code, 502);
      }
    }
  }
  if (resource === "reports" && id && action === "publish") {
    if (!user.dataAccess) throw new FlowError("dataAccessRequired", 403);
    const state = readStore();
    const report = requireValue(
      state.reports.find((item) => item.id === id && item.ownerId === user.id),
    );
    readyWidgets(
      report.widgets,
      state.bindings.filter((binding) => canReadBinding(state, user, binding)),
      state.flows,
    );
    updateStore((store) => {
      const item = requireValue(store.reports.find((row) => row.id === id));
      item.publishedAt = new Date().toISOString();
      item.publishedRevision = item.revision;
      item.publishedWidgets = structuredClone(item.widgets);
    });
    return { ok: true };
  }
  if (resource === "reports") {
    if (!user.dataAccess) throw new FlowError("dataAccessRequired", 403);
    const value = await validate(reportSchema, input);
    const state = readStore();
    for (const widget of value.widgets) {
      if (
        widget.bindingId &&
        !state.bindings.some(
          (binding) =>
            binding.id === widget.bindingId &&
            canReadBinding(state, user, binding),
        )
      )
        throw new FlowError("forbidden", 403);
      const flow = requireValue(
        state.flows.find((f) => f.id === widget.flowId),
      );
      analyticsSql(flow, widget);
    }
    const report = {
      ...value,
      id: value.id || randomUUID(),
      updatedAt: new Date().toISOString(),
      ownerId: user.id,
      revision: 1,
    };
    updateStore((store) => {
      const existing = store.reports.findIndex((r) => r.id === report.id);
      if (existing >= 0) {
        if (store.reports[existing].ownerId !== user.id)
          throw new FlowError("forbidden", 403);
        report.revision = (store.reports[existing].revision || 1) + 1;
        store.reports[existing] = {
          ...report,
          publishedAt: store.reports[existing].publishedAt,
          publishedRevision: store.reports[existing].publishedRevision,
          publishedWidgets: store.reports[existing].publishedWidgets,
        };
      } else store.reports.push(report);
    });
    return report;
  }
  if (resource === "analytics") {
    const widget: ReportWidget = await validate(widgetSchema, input);
    const state = readStore();
    const flow = requireValue(state.flows.find((f) => f.id === widget.flowId));
    let query = analyticsSql(flow, widget);
    if (widget.bindingId) {
      const binding = requireValue(
        state.bindings.find((item) => {
          const shared = state.reports.some(
            (report) =>
              report.publishedAt &&
              report.publishedWidgets?.some(
                (published) => published.bindingId === item.id,
              ),
          );
          return (
            item.id === widget.bindingId &&
            (user.role === "provider" || item.ownerId === user.id || shared)
          );
        }),
      );
      const spec = requireValue(
        metricCatalog.find((item) => item.id === binding.metricId),
      );
      if (
        binding.flowId !== flow.id ||
        metricReadiness(spec, binding, state.flows) !== "ready"
      )
        throw new FlowError("metricNotReady");
      query = metricSql(
        flow,
        binding,
        widget.kind === "kpi" ? "" : widget.dimension,
        widget,
      );
    }
    const rows = flow.sampleData && !widget.bindingId ? sampleAnalytics(widget) : await new ClickHouse(state.infrastructure.clickhouse).query<
      Record<string, string | number | null>
    >(query);
    return {
      rows,
      queriedAt: new Date().toISOString(),
      publishedAt: flow.publishedAt,
      limit: 50,
    };
  }
  throw new FlowError("notFound", 404);
};
const activeFlows = new Set<string>();
export const handleWorkspaceRequest = async (
  request: Request,
  parts: string[],
) => {
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin) {
        const expected = new URL(request.url);
        const received = new URL(origin);
        const host = request.headers.get("host") || expected.host;
        if (received.host !== host || received.protocol !== expected.protocol)
          throw new FlowError("originRejected", 403);
      }
    }
    const user = requestUser(request);
    if (!user) throw new FlowError("unauthorized", 401);
    const resource = parts[0];
    if (
      [
        "settings",
        "connections",
        "test",
        "flows",
        "csv",
        "users",
        "deployment",
      ].includes(resource) &&
      user.role !== "provider"
    )
      throw new FlowError("forbidden", 403);
    if (
      ["analytics", "reports", "preview"].includes(resource) &&
      !user.dataAccess
    )
      throw new FlowError("dataAccessRequired", 403);
    const flowKey =
      request.method === "POST" && parts[0] === "flows" && parts[1]
        ? parts[1]
        : undefined;
    if (flowKey && activeFlows.has(flowKey))
      throw new FlowError("flowBusy", 409);
    if (flowKey) activeFlows.add(flowKey);
    let result: unknown;
    try {
      result = await withAuditContext(
        {
          actorId: user.id,
          action: parts.join("."),
          targetId: parts[1] || "workspace",
        },
        () => run(request, parts, user),
      );
      if (["analytics", "preview"].includes(parts[0]))
        audit(user.id, parts.join("."), parts[1] || "workspace");
    } finally {
      if (flowKey) activeFlows.delete(flowKey);
    }
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof FlowError ? error.code : "requestFailed";
    const status = error instanceof FlowError ? error.status : 500;
    return Response.json(
      { error: code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
};
