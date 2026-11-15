import { API_ENDPOINTS, apiRequest } from '@/shared/network/api';

export type KpiAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'uniqExact';
export type KpiChartType = 'bar' | 'line' | 'pie' | 'table' | 'number';
export type KpiFilterOperator =
  'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like' | 'is_null' | 'is_not_null';
export interface KpiTable {
  name: string;
  engine: string;
  columns: { name: string; type: string }[];
}
export interface KpiFilter {
  column: string;
  operator: KpiFilterOperator;
  value?: string | number | (string | number)[];
}
export interface KpiQuery {
  table_name: string;
  dimension: string;
  measure?: string;
  aggregation: KpiAggregation;
  join_table_name?: string;
  join_type?: 'INNER' | 'LEFT';
  join_left_column?: string;
  join_right_column?: string;
  limit?: number;
  filters?: KpiFilter[];
}
export interface KpiChartCreate extends KpiQuery {
  title: string;
  chart_type: KpiChartType;
  x_label?: string;
  y_label?: string;
  position: number;
}
export interface KpiChart extends KpiChartCreate {
  id: number;
  filters: (KpiFilter & { id: number; position: number })[];
}
export interface KpiDashboard {
  id: number;
  title: string;
  description: string;
  owner: number | null;
  created_at: string;
  updated_at: string;
  charts: KpiChart[];
}
export interface KpiResult {
  success: boolean;
  x: unknown[];
  y: unknown[];
  message?: string;
}

const readJson = async <T>(response: Response): Promise<T> => response.json() as Promise<T>;
const postJson = async <T>(endpoint: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  readJson<T>(
    await apiRequest(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }),
  );
const assertKpiResult = (result: KpiResult): KpiResult => {
  if (!result.success) throw new Error(result.message || 'KPI query failed');
  if (!Array.isArray(result.x) || !Array.isArray(result.y))
    throw new Error('The KPI response has an unexpected format');
  return result;
};

export const getKpiAvailableTables = async (signal?: AbortSignal): Promise<KpiTable[]> => {
  const payload = await readJson<{ success: boolean; tables: KpiTable[]; message?: string }>(
    await apiRequest(API_ENDPOINTS.kpiAvailableTables, { signal }),
  );
  if (!payload.success) throw new Error(payload.message || 'Unable to load KPI tables');
  if (!Array.isArray(payload.tables))
    throw new Error('The KPI tables response has an unexpected format');
  return payload.tables;
};
export const queryKpi = async (query: KpiQuery, signal?: AbortSignal): Promise<KpiResult> =>
  assertKpiResult(await postJson<KpiResult>(API_ENDPOINTS.kpiQuery, query, signal));
export const querySavedKpiChart = async (
  chartId: number,
  limit?: number,
  signal?: AbortSignal,
): Promise<KpiResult> =>
  assertKpiResult(
    await postJson<KpiResult>(
      API_ENDPOINTS.kpiChartQuery,
      {
        chart_id: chartId,
        ...(limit ? { limit } : {}),
      },
      signal,
    ),
  );
export const createKpiDashboard = (dashboard: {
  title: string;
  description: string;
  charts: KpiChartCreate[];
}): Promise<KpiDashboard> => postJson(API_ENDPOINTS.kpiCreateDashboard, dashboard);
export const listKpiDashboards = async (signal?: AbortSignal): Promise<KpiDashboard[]> =>
  readJson<KpiDashboard[]>(await apiRequest(API_ENDPOINTS.kpiDashboards, { signal }));
export const getKpiDashboard = async (id: number, signal?: AbortSignal): Promise<KpiDashboard> =>
  readJson<KpiDashboard>(await apiRequest(API_ENDPOINTS.kpiDashboard(id), { signal }));

/** POST /api/kpis/create-sheet/; creator and timestamps are server-owned. */
export interface KpiSheetCreate {
  title: string;
  description?: string | null;
}
export interface KpiCreatedSheet {
  id: number;
  title: string;
  description: string | null;
}
export const createKpiSheet = async (sheet: KpiSheetCreate): Promise<KpiCreatedSheet> => {
  const result = await postJson<KpiCreatedSheet>(API_ENDPOINTS.kpiCreateSheet, sheet);
  if (
    !Number.isInteger(result.id) ||
    typeof result.title !== 'string' ||
    (result.description !== null && typeof result.description !== 'string')
  ) {
    throw new Error('The sheet response has an unexpected format');
  }
  return result;
};
