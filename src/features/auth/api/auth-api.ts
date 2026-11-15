import { TOKEN_STORAGE_KEYS } from '@/shared/network/config';
import { rawApiRequest, readError } from '@/shared/network/http';

const LOGIN_ENDPOINT = '/api/login/';
const REFRESH_ENDPOINT = '/api/token/refresh/';

const ACCESS_TOKEN_KEY = TOKEN_STORAGE_KEYS.ACCESS_TOKEN;
const REFRESH_TOKEN_KEY = TOKEN_STORAGE_KEYS.REFRESH_TOKEN;

interface TokenPair {
  access: string;
  refresh: string;
}

interface AccessTokenResponse {
  access: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

const readToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const saveTokens = (tokens: TokenPair): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  window.dispatchEvent(new Event('control-center:session-change'));
};

export const clearAuthTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event('control-center:session-change'));
};

export const getAccessToken = (): string | null => readToken(ACCESS_TOKEN_KEY);
export const hasAccessToken = (): boolean => Boolean(getAccessToken());

export const login = async (credentials: LoginCredentials): Promise<void> => {
  const response = await rawApiRequest(LOGIN_ENDPOINT, {
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

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const response = await rawApiRequest(REFRESH_ENDPOINT, {
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

let refreshInProgress: Promise<string | null> | null = null;

export const refreshAccessTokenOnce = (): Promise<string | null> => {
  refreshInProgress ??= refreshAccessToken().finally(() => {
    refreshInProgress = null;
  });
  return refreshInProgress;
};
