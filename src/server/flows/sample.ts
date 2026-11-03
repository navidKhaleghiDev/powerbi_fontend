import type { ReportWidget } from '@/lib/flows/types';

/** Explicit synthetic dataset. Never used as a fallback for warehouse failures. */
export const sampleRows: Record<string, string | number>[] = Array.from({ length: 180 }, (_, i) => ({
  order_id: `SAMPLE-${String(i + 1).padStart(4, '0')}`,
  customer_id: `CUSTOMER-${(i % 37) + 1}`,
  order_date: `2026-${String(5 + Math.floor(i / 30)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  region: ['Tehran', 'Isfahan', 'Shiraz', 'Tabriz', 'Mashhad'][i % 5],
  product: ['Software', 'Training', 'Support', 'Consulting'][(i * 7) % 4],
  status: ['Completed', 'Completed', 'Completed', 'Pending', 'Cancelled'][i % 5],
  units: 1 + ((i * 13) % 19),
}));

export const sampleAnalytics = (widget: ReportWidget) => {
  const rows = sampleRows.filter(row =>
    (!widget.filterField || String(row[widget.filterField]) === widget.filterValue) &&
    (!widget.dateField || ((!widget.dateFrom || String(row[widget.dateField]) >= widget.dateFrom) &&
      (!widget.dateTo || String(row[widget.dateField]) <= widget.dateTo)))
  );
  const groups = new Map<string, { sum: number; count: number }>();
  if (widget.kind === "kpi" || !widget.dimension) groups.set("", {sum: 0, count: 0});
  for (const row of rows) {
    const label = widget.kind === 'kpi' || !widget.dimension ? '' : String(row[widget.dimension]);
    const group = groups.get(label) ?? { sum: 0, count: 0 };
    group.sum += Number(row[widget.measure] ?? 0);
    group.count++;
    groups.set(label, group);
  }
  return [...groups].map(([label, group]) => ({
    label,
    value: widget.aggregation === 'count' ? group.count : widget.aggregation === 'avg' ? (group.count ? group.sum / group.count : 0) : group.sum,
  })).sort((a, b) => widget.kind === 'line' ? a.label.localeCompare(b.label) : b.value - a.value).slice(0, 50);
};
