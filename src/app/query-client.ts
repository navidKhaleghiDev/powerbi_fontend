import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { toast } from '@/shared/lib/toast';

export const createAppQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
    }),
    mutationCache: new MutationCache({
      onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
      onSuccess: () => toast.success(),
    }),
  });
