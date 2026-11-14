import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { createAppQueryClient } from '@/app/query-client';
import { ToastViewport } from '@/shared/components/ui/ToastViewport';

import { AssistantProvider } from './AssistantProvider';

export const WorkspaceProviders = ({ children }: { children: ReactNode }) => {
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
