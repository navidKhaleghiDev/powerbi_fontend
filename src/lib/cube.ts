import cubejs from '@cubejs-client/core';

const configuredUrl: unknown = import.meta.env.VITE_CUBE_API_URL;
const configuredToken: unknown = import.meta.env.VITE_CUBE_TOKEN;
export const cubeDefaults = {
  url: typeof configuredUrl === 'string' ? configuredUrl.trim() : '',
  token: typeof configuredToken === 'string' ? configuredToken.trim() : '',
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
