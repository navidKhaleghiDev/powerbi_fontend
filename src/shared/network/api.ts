import { appEnv } from '@/shared/config/env';

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
  kpiCreateDashboard: '/api/kpis/create-dashboard/',
  kpiDashboards: '/api/kpis/dashboards/',
  kpiDashboard: (id: number) => `/api/kpis/dashboards/${id}/`,
} as const;

const API_BASE_URL = appEnv.apiBaseUrl;
const ACCESS_TOKEN_KEY = 'control-center.access-token';
const REFRESH_TOKEN_KEY = 'control-center.refresh-token';

interface TokenPair {
  access: string;
  refresh: string;
}

interface AccessTokenResponse {
  access: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

let refreshInProgress: Promise<string | null> | null = null;

const readToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const saveTokens = (tokens: TokenPair): void => {
  window.dispatchEvent(new Event('control-center:session-change'));
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
};

export const clearAuthTokens = (): void => {
  window.dispatchEvent(new Event('control-center:session-change'));
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const hasAccessToken = (): boolean => Boolean(readToken(ACCESS_TOKEN_KEY));

const apiUrl = (endpoint: string): string => {
  const path = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint.replace(/^\/+/, '')}`;
  return `${API_BASE_URL}${path}`;
};

const messageFromErrorBody = (body: unknown): string | null => {
  if (typeof body === 'string') return body.trim() || null;
  if (Array.isArray(body)) {
    const messages = body
      .map(messageFromErrorBody)
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(' · ') : null;
  }
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  for (const key of ['detail', 'message', 'error', 'errors', 'msg', 'non_field_errors']) {
    if (key in record) {
      const message = messageFromErrorBody(record[key]);
      if (message) return message;
    }
  }
  const fields = Object.entries(record).flatMap(([field, value]) => {
    const message = messageFromErrorBody(value);
    return message ? [`${field}: ${message}`] : [];
  });
  return fields.length ? fields.join(' · ') : null;
};

const readError = async (response: Response): Promise<string> => {
  try {
    const message = messageFromErrorBody(await response.clone().json());
    if (message) return message;
  } catch {
    // Continue with plain text responses when the server does not return JSON.
  }
  const text = (
    await response
      .clone()
      .text()
      .catch(() => '')
  ).trim();
  if (text && !/^<!doctype html|^<html\b/i.test(text)) return text.slice(0, 500);
  return `Request failed (${response.status})`;
};

export const login = async (credentials: LoginCredentials): Promise<void> => {
  const response = await fetch(apiUrl(API_ENDPOINTS.login), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) throw new Error(await readError(response));
  const tokens: unknown = await response.json();
  if (
    !tokens ||
    typeof tokens !== 'object' ||
    !('access' in tokens) ||
    typeof tokens.access !== 'string' ||
    !('refresh' in tokens) ||
    typeof tokens.refresh !== 'string'
  ) {
    throw new Error('The login response did not contain valid tokens');
  }
  saveTokens(tokens as TokenPair);
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refresh = readToken(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  const access = readToken(ACCESS_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const response = await fetch(apiUrl(API_ENDPOINTS.refreshToken), {
    method: 'POST',
    headers,
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearAuthTokens();
    throw new Error(await readError(response));
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== 'object' ||
    !('access' in result) ||
    typeof result.access !== 'string'
  ) {
    clearAuthTokens();
    throw new Error('The token refresh response did not contain a valid access token');
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, (result as AccessTokenResponse).access);
  return (result as AccessTokenResponse).access;
};

export const apiRequest = async (endpoint: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const access = readToken(ACCESS_TOKEN_KEY);
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const response = await fetch(apiUrl(endpoint), { ...init, headers });
  if (
    response.status !== 401 ||
    endpoint === API_ENDPOINTS.login ||
    endpoint === API_ENDPOINTS.refreshToken
  ) {
    if (!response.ok) throw new Error(await readError(response));
    return response;
  }

  refreshInProgress ??= refreshAccessToken().finally(() => {
    refreshInProgress = null;
  });
  const refreshedAccess = await refreshInProgress;
  if (!refreshedAccess) throw new Error(await readError(response));

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${refreshedAccess}`);
  const retryResponse = await fetch(apiUrl(endpoint), { ...init, headers: retryHeaders });
  if (retryResponse.status === 401) clearAuthTokens();
  if (!retryResponse.ok) throw new Error(await readError(retryResponse));
  return retryResponse;
};

export const getApiErrorMessage = readError;
