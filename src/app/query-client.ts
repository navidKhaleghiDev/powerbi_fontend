import { MutationCache, QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';

import { toast } from '@/shared/lib/toast';
import { getApiErrorMessage } from '@/shared/network/error';

const notifyError = (error: unknown): void => {
  if (error instanceof Error && error.name === 'AbortError') return;
  const message = getApiErrorMessage(error);
  toast.error(message, message);
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: notifyError }),
  mutationCache: new MutationCache({
    onError: notifyError,
  }),
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, retry: 1 },
  },
});

export const invalidateQueries = (queryKey: QueryKey): Promise<void> =>
  queryClient.invalidateQueries({ queryKey });

export const resetQueries = (queryKey: QueryKey): Promise<void> =>
  queryClient.resetQueries({ queryKey });

export const prefetchQuery = async <T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: { staleTime?: number },
): Promise<void> => {
  await queryClient.prefetchQuery({ queryKey, queryFn, staleTime: options?.staleTime });
};

export const clearAllCache = (): void => queryClient.clear();
