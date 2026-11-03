import { metricCatalog, metricReadiness } from "@/lib/flows/metrics";
import type { DataFlow, MetricBinding, ReportWidget } from "@/lib/flows/types";

import { FlowError, requireValue } from "./errors";
import { ident, literal, tableName, filterSql } from "./sql";
export const metricSql = (
  flow: DataFlow,
  binding: MetricBinding,
  dimension = "",
  filters?: ReportWidget,
): string => {
  if (!flow.activeLoadId) throw new FlowError("notPublished");
  const spec = requireValue(
    metricCatalog.find((item) => item.id === binding.metricId),
  );
  if (!spec.supported) throw new FlowError("metricUnsupported");
  if (
    spec.fields.some(
      (role) => !flow.columns.some((c) => c.target === binding.fields[role]),
    )
  )
    throw new FlowError("mappingMismatch");
  if (
    spec.money &&
    (!/^[A-Z]{3}$/.test(binding.currency) ||
      !flow.columns.some(
        (c) => c.target === binding.fields.amount && c.type === "Decimal(18,2)",
      ))
  )
    throw new FlowError("metricCurrency");
  if (dimension && !flow.columns.some((c) => c.target === dimension))
    throw new FlowError("invalid");
  const amount = spec.money ? ident(binding.fields.amount) : "";
  const formula =
    binding.metricId === "record_count"
      ? "count()"
      : binding.metricId === "customer_count"
        ? `uniqExact(${ident(binding.fields.customer_id)})`
        : binding.metricId === "order_count"
          ? `uniqExact(${ident(binding.fields.order_id)})`
          : binding.metricId === "sales_amount"
            ? `sum(${amount})`
            : `toDecimal128(sum(${amount}),6)/nullIf(uniqExact(${ident(binding.fields.order_id)}),0)`;
  return `SELECT ${dimension ? `${ident(dimension)} AS label,` : ""}${formula} AS value FROM ${tableName(flow, "mart")} FINAL WHERE _load_id=${literal(flow.activeLoadId)}${filters ? filterSql(flow, filters) : ""}${dimension ? ` GROUP BY ${ident(dimension)} ORDER BY ${filters?.kind === "line" ? ident(dimension) + " ASC" : "value DESC"}` : ""} LIMIT 50`;
};
const scaled = (value: string): bigint => {
  if (!/^-?\d{1,30}([.]\d{1,6})?$/.test(value)) throw new FlowError("invalid");
  const negative = value.startsWith("-");
  const [whole, decimal = ""] = value.replace(/^-/, "").split(".");
  const result =
    BigInt(whole) * BigInt(1000000) + BigInt(decimal.padEnd(6, "0"));
  return negative ? -result : result;
};
export const withinTolerance = (
  actual: string,
  expected: string,
  tolerance: string,
): boolean => {
  const limit = scaled(tolerance);
  if (limit < BigInt(0)) throw new FlowError("invalid");
  const delta = scaled(actual) - scaled(expected);
  return (delta < BigInt(0) ? -delta : delta) <= limit;
};
export const readyWidgets = (
  widgets: ReportWidget[],
  bindings: MetricBinding[],
  flows: DataFlow[],
) => {
  if (!widgets.length) throw new FlowError("metricNotReady");
  for (const widget of widgets) {
    const binding = bindings.find((item) => item.id === widget.bindingId);
    const spec = metricCatalog.find((item) => item.id === binding?.metricId);
    if (
      !binding ||
      !spec ||
      binding.flowId !== widget.flowId ||
      metricReadiness(spec, binding, flows) !== "ready"
    )
      throw new FlowError("metricNotReady");
  }
};
