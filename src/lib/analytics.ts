import { apiRequest } from './api';

export interface Metric {
  key: string;
  title: string;
  description: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  field: string;
  filters: Record<string, string[]>;
  dimensions: string[];
}
export interface Dataset {
  id: number;
  slug: string;
  title: string;
  description: string;
  grain: string;
  revision: number;
  unit: string;
  timezone: string;
  mapping: Record<string, { column?: string; type: 'number' | 'date' | 'string' }>;
  metrics: Metric[];
  supports_history?: boolean;
  history_start: string | null;
  status?: 'draft' | 'published';
  published_at?: string | null;
  source_table?: string;
  primary_key?: string;
  version_column?: string;
  deleted_column?: string;
  history_table?: string;
  recorded_at_column?: string;
}
export interface AnalyticsMetadata {
  can_manage: boolean;
  datasets: Dataset[];
  templates: Metric[];
}
export interface Source {
  name: string;
  engine: string;
  columns: { name: string; type: string }[];
}
export interface AnalyticsFilters {
  from: string;
  to: string;
  calendar: 'persian' | 'gregorian';
  mode: 'latest' | 'historical';
  knownAt: string;
  values: Record<string, string>;
}
export interface AnalyticsResult {
  columns: { key: string; type: string; unit?: string }[];
  rows: Record<string, string | number | null>[];
  meta: {
    queried_at: string;
    truncated: boolean;
    mode: string;
    source_freshness: string | null;
    next_cursor?: string | null;
  };
}
export const analyticsRequest = async <T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await apiRequest(`/api/analytics/${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  return response.json() as Promise<T>;
};
export const metricId = (dataset: Dataset, metric: Metric) => `${dataset.slug}.${metric.key}`;
export const resolveMetric = (datasets: Dataset[], id: string) => {
  for (const dataset of datasets) {
    const metric = dataset.metrics.find((item) => metricId(dataset, item) === id);
    if (metric) return { dataset, metric };
  }
  return undefined;
};
export const defaultAnalyticsFilters = (): AnalyticsFilters => {
  const today = new Date();
  const end = new Date(today.getTime() + 86_400_000);
  return {
    from: `${today.getFullYear()}-01-01`,
    to: end.toISOString().slice(0, 10),
    calendar: 'persian',
    mode: 'latest',
    knownAt: '',
    values: {},
  };
};
export const loadAnalytics = (
  dataset: Dataset,
  metric: Metric,
  dimensions: string[],
  filters: AnalyticsFilters,
  signal?: AbortSignal,
  options?: { details: boolean; cursor?: string },
) =>
  analyticsRequest<AnalyticsResult>(
    options?.details ? 'details/' : 'query/',
    {
      dataset: dataset.slug,
      metric: metric.key,
      group_by: options?.details ? [] : dimensions,
      ...(options?.details
        ? { limit: 50, ...(options.cursor ? { cursor: options.cursor } : {}) }
        : {}),
      date_from: filters.from,
      date_to: filters.to,
      calendar: filters.calendar,
      mode: filters.mode,
      ...(filters.mode === 'historical' && filters.knownAt
        ? { known_at: new Date(filters.knownAt).toISOString() }
        : {}),
      filters: Object.fromEntries(
        Object.entries(filters.values)
          .filter(
            ([key, value]) =>
              value && metric.dimensions.includes(key) && dataset.mapping[key]?.type === 'string',
          )
          .map(([key, value]) => [key, [value]]),
      ),
    },
    undefined,
    signal,
  );
