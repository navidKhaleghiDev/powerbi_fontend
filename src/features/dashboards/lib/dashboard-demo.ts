import { queryDemo, demoMeasures, demoDimensions } from '@/features/dashboards/lib/sales-demo';

import type { DashboardSheet } from '@/features/dashboards/lib/dashboard';
import type {
  AnalyticsFilters,
  AnalyticsMetadata,
  AnalyticsResult,
  Dataset,
  Metric,
} from '@/features/datasets/api/analytics';

const STORAGE_KEY = 'control-center.sample-dashboard';
const metrics: Metric[] = demoMeasures.map((key) => ({
  key,
  title: key,
  description: 'Synthetic sample data',
  aggregation: 'sum',
  field: key,
  filters: {},
  dimensions: demoDimensions.filter((dimension) =>
    ['incomeType', 'paymentTerms'].includes(dimension)
      ? [
          'income',
          'formalIncome',
          'informalIncome',
          'cashIncome',
          'creditIncome',
          'incomeReturns',
        ].includes(key)
      : !['latestExpenses', 'latestPurchases'].includes(key),
  ),
}));
const dataset: Dataset = {
  id: 0,
  slug: 'sample-sales',
  title: 'Sample sales',
  description: 'Synthetic sales records',
  grain: 'sample',
  revision: 1,
  unit: 'IRR',
  timezone: 'Asia/Tehran',
  mapping: Object.fromEntries(
    demoDimensions.map((key) => [
      key,
      { type: ['incomeType', 'paymentTerms'].includes(key) ? 'string' : 'date' },
    ]),
  ),
  metrics,
  history_start: null,
};
export const sampleAnalyticsMetadata: AnalyticsMetadata = {
  can_manage: false,
  datasets: [dataset],
  templates: [],
};
export interface SampleDashboard {
  sheets: DashboardSheet[];
  revision: number;
}
export const readSampleDashboard = (): SampleDashboard => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SampleDashboard | null;
    if (value && Array.isArray(value.sheets) && typeof value.revision === 'number') return value;
  } catch {
    /* Invalid local draft starts fresh. */
  }
  return { sheets: [], revision: 0 };
};
export const saveSampleDashboard = (
  sheets: DashboardSheet[],
  revision: number,
): SampleDashboard => {
  const value = { sheets, revision: revision + 1 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
};
export const loadSampleAnalytics = (
  source: Dataset,
  metric: Metric,
  dimensions: string[],
  filters: AnalyticsFilters,
  _signal?: AbortSignal,
  options?: { details: boolean; cursor?: string },
): Promise<AnalyticsResult> => {
  const rows = queryDemo(
    { measures: [metric.key], dimensions },
    {
      asOf: filters.to || '2026-06-30',
      incomeType: (filters.values.incomeType ?? '') as '' | 'formal' | 'informal',
      paymentTerms: (filters.values.paymentTerms ?? '') as '' | 'cash' | 'credit',
    },
  ) as Record<string, string | number | null>[];
  const visible: Record<string, string | number | null>[] = options?.details
    ? rows.map((row, index) => ({ _record_id: index + 1, ...row }))
    : rows;
  return Promise.resolve({
    columns: [
      ...(options?.details ? [{ key: '_record_id', type: 'number' }] : []),
      ...dimensions.map((key) => ({ key, type: 'string' })),
      { key: `${source.slug}.${metric.key}`, type: 'number', unit: source.unit },
    ],
    rows: visible.map((row) => ({
      ...row,
      [`${source.slug}.${metric.key}`]: row[metric.key] ?? 0,
    })),
    meta: {
      queried_at: new Date().toISOString(),
      truncated: false,
      mode: 'sample',
      source_freshness: null,
      next_cursor: null,
    },
  });
};
