import type { KpiQuery } from '@/features/kpis/api/kpi-api';
import type { Query } from '@cubejs-client/core';

export type WidgetVisual =
  'bar' | 'horizontalBar' | 'line' | 'pie' | 'radar' | 'heatmap' | 'table' | 'card';
export interface DashboardWidget {
  savedWidgetId?: number;
  id: string;
  title: string;
  visual: WidgetVisual;
  size: 'small' | 'medium' | 'wide';
  tableWidth?: 'half' | 'full';
  chartWidth?: 'half';
  query: Query | null;
  kpiQuery?: KpiQuery;
  showValues?: boolean;
  chartColor?: string;
  categoryColors?: string[];
}

export interface DashboardSheet {
  serverId?: number;
  description?: string;
  id: string;
  name: string;
  widgets: DashboardWidget[];
}
