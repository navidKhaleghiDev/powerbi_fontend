const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const withoutTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

export const appEnv = {
  openRouterApiKey: readString(import.meta.env.VITE_OPENROUTER_API_KEY),
  apiBaseUrl: withoutTrailingSlashes(readString(import.meta.env.VITE_API_BASE_URL)),
  cubeApiUrl: withoutTrailingSlashes(readString(import.meta.env.VITE_CUBE_API_URL)),
  cubeToken: readString(import.meta.env.VITE_CUBE_TOKEN),
} as const;
