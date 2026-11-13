import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AssistantProvider } from '@/components/AssistantProvider';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { toast } from '@/lib/toast';

interface Props {
  children: React.ReactNode;
}

const createAppQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
    }),
    mutationCache: new MutationCache({
      onError: (error) => toast.error(error instanceof Error ? error.message : undefined),
      onSuccess: () => toast.success(),
    }),
  });

export const WorkspaceProviders = ({ children }: Props) => {
  const [client] = useState(createAppQueryClient);

  useEffect(() => {
    const clearSessionData = () => client.clear();
    window.addEventListener('control-center:session-change', clearSessionData);
    return () => window.removeEventListener('control-center:session-change', clearSessionData);
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <AssistantProvider>{children}</AssistantProvider>
      <ToastViewport />
    </QueryClientProvider>
  );
};
