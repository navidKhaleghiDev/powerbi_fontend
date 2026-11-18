import {
  clearAuthTokens,
  getAccessToken,
  refreshAccessTokenOnce,
} from '@/features/auth/api/auth-api';
import { rawApiRequest, readError } from '@/shared/network/http';

export const API_ENDPOINTS = {
  login: '/api/login/',
  refreshToken: '/api/token/refresh/',
  databaseTypes: '/api/database-types/',
  dataTypes: '/api/data-types/',
  connectionTest: '/api/database/connection-test/',
  databaseTables: '/api/database/tables/',
  databaseColumns: '/api/database/columns/',
  connect: '/api/connect/',
  connector: (name: string) => `/api/connect/${encodeURIComponent(name)}/`,
  connectorConfig: (source: string) => `/api/connect/${encodeURIComponent(source)}/config/`,
  consumer: '/api/consumer/',
  kpiAvailableTables: '/api/kpis/available-tables/',
  kpiQuery: '/api/kpis/query/',
  kpiChartQuery: '/api/kpis/chart-query/',
  kpiCreateWidget: (id: number) => `/api/kpis/${id}/create-widget/`,
  kpiWidget: (id: number) => `/api/kpis/widgets/${id}/`,
  kpiSheets: '/api/kpis/sheets/',
  kpiCreateSheet: '/api/kpis/create-sheet/',
  kpiCreateDashboard: '/api/kpis/create-dashboard/',
  kpiDashboards: '/api/kpis/dashboards/',
  kpiDashboard: (id: number) => `/api/kpis/dashboards/${id}/`,
} as const;

export const apiRequest = async (endpoint: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const access = getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const response = await rawApiRequest(endpoint, { ...init, headers });
  if (
    response.status !== 401 ||
    endpoint === API_ENDPOINTS.login ||
    endpoint === API_ENDPOINTS.refreshToken
  ) {
    if (!response.ok) throw new Error(await readError(response));
    return response;
  }

  // Another request may already have refreshed the token while this response was in flight.
  const refreshedAccess =
    access && getAccessToken() !== access ? getAccessToken() : await refreshAccessTokenOnce();
  if (!refreshedAccess) throw new Error(await readError(response));

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${refreshedAccess}`);
  const retryResponse = await rawApiRequest(endpoint, { ...init, headers: retryHeaders });
  if (retryResponse.status === 401 && getAccessToken() === refreshedAccess) clearAuthTokens();
  if (!retryResponse.ok) throw new Error(await readError(retryResponse));
  return retryResponse;
};

export { getApiErrorMessage } from './error';
