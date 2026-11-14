import type { Query } from '@cubejs-client/core';

export type WidgetVisual =
  'bar' | 'horizontalBar' | 'line' | 'pie' | 'radar' | 'heatmap' | 'table' | 'card';
export interface DashboardWidget {
  id: string;
  title: string;
  visual: WidgetVisual;
  size: 'small' | 'medium' | 'wide';
  tableWidth?: 'half' | 'full';
  chartWidth?: 'half';
  query: Query | null;
  showValues?: boolean;
  chartColor?: string;
  categoryColors?: string[];
}

export interface DashboardSheet {
  id: string;
  name: string;
  widgets: DashboardWidget[];
}
