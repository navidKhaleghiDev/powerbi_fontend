import cubejs from '@cubejs-client/core';

import { appEnv } from '@/shared/config/env';

export const cubeDefaults = {
  url: appEnv.cubeApiUrl,
  token: appEnv.cubeToken,
};

export const createCubeClient = (url: string, token: string) =>
  cubejs(token, { apiUrl: url.replace(/\/+$/, '') });

export const loadCubeMeasure = async (
  client: ReturnType<typeof createCubeClient>,
  measure: string,
): Promise<string | number | null> => {
  const result = await client.load({ measures: [measure] });
  const value: unknown = result.rawData()[0]?.[measure];
  if (value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Cube returned no measure value');
  }
  return value;
};
