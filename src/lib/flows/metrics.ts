import type { DataFlow, MetricBinding, MetricId } from "./types";
export interface MetricSpec {
  id: MetricId;
  category: "sales" | "customers" | "platform" | "finance";
  fields: string[];
  money: boolean;
  supported: boolean;
}
export const metricCatalog: MetricSpec[] = [
  {
    id: "record_count",
    category: "platform",
    fields: [],
    money: false,
    supported: true,
  },
  {
    id: "customer_count",
    category: "customers",
    fields: ["customer_id"],
    money: false,
    supported: true,
  },
  {
    id: "order_count",
    category: "sales",
    fields: ["order_id"],
    money: false,
    supported: true,
  },
  {
    id: "sales_amount",
    category: "sales",
    fields: ["amount"],
    money: true,
    supported: true,
  },
  {
    id: "average_order_value",
    category: "sales",
    fields: ["amount", "order_id"],
    money: true,
    supported: true,
  },
  {
    id: "completed_revenue",
    category: "finance",
    fields: ["orders", "payments", "payment_status", "paid_at"],
    money: true,
    supported: false,
  },
  {
    id: "gross_margin",
    category: "finance",
    fields: ["net_revenue", "cost_of_goods"],
    money: false,
    supported: false,
  },
  {
    id: "retention",
    category: "customers",
    fields: ["customer_id", "historical_periods"],
    money: false,
    supported: false,
  },
  {
    id: "net_profit",
    category: "finance",
    fields: ["accounting_policy", "income", "expenses", "adjustments"],
    money: true,
    supported: false,
  },
];
export type Readiness =
  | "ready"
  | "needs_source"
  | "needs_mapping"
  | "needs_definition_approval"
  | "unsupported";
export const metricReadiness = (
  spec: MetricSpec,
  binding: MetricBinding | undefined,
  flows: DataFlow[],
): Readiness => {
  if (!spec.supported) return "unsupported";
  if (!binding)
    return flows.some((flow) => !!flow.activeLoadId)
      ? "needs_mapping"
      : "needs_source";
  const flow = flows.find(
    (item) => item.id === binding?.flowId && item.activeLoadId,
  );
  if (!flow) return "needs_source";
  if (
    !binding ||
    spec.fields.some(
      (role) =>
        !flow.columns.some((column) => column.target === binding.fields[role]),
    )
  )
    return "needs_mapping";
  if (!binding.approvedAt || binding.validatedLoadId !== flow.activeLoadId)
    return "needs_definition_approval";
  return "ready";
};
