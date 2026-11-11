import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AssistantProvider } from '@/components/AssistantProvider';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { toast } from '@/lib/toast';

interface Props {
  children: React.ReactNode;
}
export const WorkspaceProviders = ({ children }: Props) => {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
        }),
        mutationCache: new MutationCache({
          onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
          onSuccess: () => toast.success(),
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AssistantProvider>{children}</AssistantProvider>
      <ToastViewport />
    </QueryClientProvider>
  );
};
