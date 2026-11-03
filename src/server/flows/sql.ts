import type {
  DataFlow,
  Infrastructure,
  PostgresConnection,
  ReportWidget,
} from "@/lib/flows/types";

import { FlowError } from "./errors";
import { identifier } from "./validation";
export const ident = (value: string) => {
  if (!identifier.test(value)) throw new FlowError("invalidIdentifier");
  return "`" + value + "`";
};
export const literal = (value: string) =>
  "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
export const tableName = (
  flow: DataFlow,
  kind: "mart" | "raw" | "queue" | "capture",
) => ident(`app_${kind}_${flow.id}`);
export const martDdl = (flow: DataFlow) =>
  `CREATE TABLE IF NOT EXISTS ${tableName(flow, "mart")} (_load_id String, ${flow.columns.map((c) => `${ident(c.target)} ${c.required || c.target === flow.primaryKey ? c.type : `Nullable(${c.type})`}`).join(", ")}) ENGINE = ReplacingMergeTree ORDER BY (_load_id,${ident(flow.primaryKey)})`;
const jsonValue = (column: string) => {
  const parent = "if(JSONExtractString(event,'op')='d','before','after')";
  const raw = `JSONExtractRaw(event,${parent},${literal(column)})`;
  return `if(JSONHas(event,${parent},${literal(column)}) AND ${raw}!='null',if(JSONType(event,${parent},${literal(column)})='String',JSONExtractString(event,${parent},${literal(column)}),${raw}),NULL)`;
};
const castValue = (value: string, type: string): string => {
  if (type === "Int64")
    return `if(match(${value},'^-?[0-9]+$') AND abs(toDecimal128OrNull(${value},0))<=if(startsWith(${value},'-'),toDecimal128('9223372036854775808',0),toDecimal128('9223372036854775807',0)),toInt64OrNull(${value}),NULL)`;
  if (type === "Float64")
    return `if(isFinite(toFloat64OrNull(${value})),toFloat64OrNull(${value}),NULL)`;
  if (type === "Decimal(18,2)")
    return `if(match(${value},'^-?[0-9]{1,16}([.][0-9]{1,2})?$'),toDecimal64OrNull(${value},2),NULL)`;
  if (type === "Date")
    return `if(match(${value},'^[0-9]{4}-[0-9]{2}-[0-9]{2}$') AND toString(toDateOrNull(${value}))=${value},toDateOrNull(${value}),if(match(${value},'^[0-9]{1,5}$'),addDays(toDate('1970-01-01'),toInt32OrNull(${value})),NULL))`;
  return value;
};
export const currentStateSql = (
  flow: DataFlow,
  bounds?: { partition: number | string; offset: string }[],
) => {
  const primary = flow.columns.find((c) => c.target === flow.primaryKey);
  if (!primary) throw new FlowError("invalid");
  const fields = flow.columns.map((c) =>
    castValue(jsonValue(c.source), c.type),
  );
  const quality = flow.columns
    .map((c, i) => {
      const original = jsonValue(c.source);
      const empty = `(${original} IS NULL OR ${original}='')`;
      return c.required || c.target === flow.primaryKey
        ? `(NOT ${empty} AND ${fields[i]} IS NOT NULL)`
        : `(${empty} OR ${fields[i]} IS NOT NULL)`;
    })
    .join(" AND ");
  const constraint = bounds
    ? ` AND (${
        bounds
          .map((b) => {
            if (!/^\d+$/.test(String(b.partition)) || !/^\d+$/.test(b.offset))
              throw new FlowError("invalid");
            return `(partition=toUInt64(${literal(String(b.partition))}) AND offset<=toUInt64(${literal(b.offset)}))`;
          })
          .join(" OR ") || "0"
      })`
    : "";
  return `SELECT ${flow.columns.map((c, i) => `tupleElement(latest,${i + 1}) AS ${ident(c.target)}`).join(",")},tupleElement(latest,${fields.length + 2}) AS _quality_ok FROM (SELECT argMax(tuple(${fields.join(",")},JSONExtractString(event,'op')='d',${quality}),tuple(JSONExtractUInt(event,'source','lsn'),partition,offset)) AS latest FROM ${tableName(flow, "raw")} WHERE JSONExtractString(event,'op') IN ('c','r','u','d')${constraint} GROUP BY ${jsonValue(primary.source)}) WHERE tupleElement(latest,${fields.length + 1})=0`;
};
export const captureDdl = (flow: DataFlow, infrastructure: Infrastructure) => {
  if (!infrastructure.kafka.brokers || !flow.schema || !flow.table)
    throw new FlowError("invalid");
  const topic = `app_${flow.id}.${flow.schema}.${flow.table}`;
  return [
    `CREATE TABLE IF NOT EXISTS ${tableName(flow, "raw")} (event String,topic String,partition UInt64,offset UInt64,received_at DateTime64(3) DEFAULT now64()) ENGINE = MergeTree ORDER BY (topic,partition,offset)`,
    `CREATE TABLE IF NOT EXISTS ${tableName(flow, "queue")} (event String) ENGINE = Kafka SETTINGS kafka_broker_list=${literal(infrastructure.kafka.brokers)},kafka_topic_list=${literal(topic)},kafka_group_name=${literal("app_" + flow.id)},kafka_format='JSONAsString',kafka_num_consumers=1,kafka_max_block_size=1000,kafka_poll_max_batch_size=1000`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${tableName(flow, "capture")} TO ${tableName(flow, "raw")} AS SELECT event,_topic AS topic,_partition AS partition,_offset AS offset,now64() AS received_at FROM ${tableName(flow, "queue")}`,
    martDdl(flow),
  ];
};
export const debeziumConfig = (
  flow: DataFlow,
  connection: PostgresConnection,
): Record<string, string> => ({
  name: "app_" + flow.id,
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "tasks.max": "1",
  "database.hostname": connection.host,
  "database.port": String(connection.port),
  "database.dbname": connection.database,
  "database.user": connection.user,
  "database.password": connection.password,
  "database.sslmode": connection.ssl ? "verify-full" : "disable",
  "topic.prefix": "app_" + flow.id,
  // PostgreSQL names are identifier-validated; only the separators need regex escaping.
  "table.include.list":[flow.schema,flow.table].join(String.fromCharCode(92)+'.'),
  "column.include.list":flow.columns.map(column=>[flow.schema,flow.table,column.source].join(String.fromCharCode(92)+'.')).join(','),
  "slot.name": "app_" + flow.id,
  "publication.name": "app_" + flow.id,
  "publication.autocreate.mode": "filtered",
  "plugin.name": "pgoutput",
  "snapshot.mode": "initial",
  "decimal.handling.mode": "string",
  "tombstones.on.delete": "false",
  "key.converter": "org.apache.kafka.connect.json.JsonConverter",
  "key.converter.schemas.enable": "false",
  "value.converter": "org.apache.kafka.connect.json.JsonConverter",
  "value.converter.schemas.enable": "false",
});
export const filterSql = (flow: DataFlow, widget: ReportWidget): string => {
  const clauses: string[] = [];
  if (widget.filterField) {
    const field = flow.columns.find(
      (column) =>
        column.target === widget.filterField && column.type === "String",
    );
    if (!field || widget.filterValue === undefined)
      throw new FlowError("invalid");
    clauses.push(`${ident(field.target)}=${literal(widget.filterValue)}`);
  }
  if (widget.dateField) {
    const field = flow.columns.find(
      (column) => column.target === widget.dateField && column.type === "Date",
    );
    if (!field) throw new FlowError("invalid");
    for (const value of [widget.dateFrom, widget.dateTo])
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new FlowError("invalid");
    if (widget.dateFrom && widget.dateTo && widget.dateFrom > widget.dateTo)
      throw new FlowError("invalid");
    if (widget.dateFrom)
      clauses.push(
        `${ident(field.target)}>=toDate(${literal(widget.dateFrom)})`,
      );
    if (widget.dateTo)
      clauses.push(`${ident(field.target)}<=toDate(${literal(widget.dateTo)})`);
  } else if (widget.dateFrom || widget.dateTo) throw new FlowError("invalid");
  return clauses.length ? " AND " + clauses.join(" AND ") : "";
};
export const analyticsSql = (flow: DataFlow, widget: ReportWidget): string => {
  if (!flow.activeLoadId) throw new FlowError("notPublished");
  const columns = new Set(flow.columns.map((c) => c.target));
  if (widget.dimension && !columns.has(widget.dimension))
    throw new FlowError("invalid");
  const measure = flow.columns.find((c) => c.target === widget.measure);
  if (
    widget.aggregation !== "count" &&
    (!measure || !["Int64", "Float64", "Decimal(18,2)"].includes(measure.type))
  )
    throw new FlowError("invalid");
  const metric =
    widget.aggregation === "count"
      ? "count()"
      : `${widget.aggregation}(${ident(widget.measure)})`;
  const group =
    widget.kind === "kpi" || !widget.dimension ? "" : widget.dimension;
  return `SELECT ${group ? `${ident(group)} AS label, ` : ""}${metric} AS value FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(flow.activeLoadId)}${filterSql(flow, widget)}${group ? ` GROUP BY ${ident(group)} ORDER BY ${widget.kind === "line" ? ident(group) + " ASC" : "value DESC"}` : ""} LIMIT 50`;
};
