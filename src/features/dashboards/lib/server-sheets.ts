import type { DashboardWidget } from './dashboard';
import type { KpiSheetWidget } from '@/features/kpis/api/kpi-api';

export const toDashboardWidget = (widget: KpiSheetWidget): DashboardWidget => ({
  id: `server-widget-${widget.id}`,
  savedWidgetId: widget.id,
  title: widget.title,
  visual: widget.chart_type === 'number' ? 'card' : (widget.chart_type ?? 'bar'),
  size: widget.chart_type === 'number' ? 'small' : 'wide',
  query: null,
  kpiQuery: {
    table_name: widget.table_name,
    dimension: widget.dimension ?? '',
    measure: widget.measure ?? undefined,
    aggregation: widget.aggregation,
    join_table_name: widget.join_table_name ?? undefined,
    join_type: widget.join_type || undefined,
    join_left_column: widget.join_left_column ?? undefined,
    join_right_column: widget.join_right_column ?? undefined,
    limit: widget.limit,
    filters: widget.filters,
  },
});
