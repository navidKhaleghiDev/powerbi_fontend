import { appEnv } from '@/shared/config/env';

import type { ApiConfig } from './type';

export const API_CONFIG: ApiConfig = {
  baseURL: appEnv.apiBaseUrl,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
};

export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'control-center.access-token',
  REFRESH_TOKEN: 'control-center.refresh-token',
} as const;

export const TOKEN_CONFIG = {
  accessTokenKey: TOKEN_STORAGE_KEYS.ACCESS_TOKEN,
  refreshTokenKey: TOKEN_STORAGE_KEYS.REFRESH_TOKEN,
} as const;
