export const cubeManagementRequest = async <T>(endpoint: string, body?: unknown): Promise<T> => {
  const response = await fetch(`/api/cube-management/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
        ? result.error
        : `Management API returned ${response.status}`;
    throw new Error(message);
  }
  return result as T;
};
