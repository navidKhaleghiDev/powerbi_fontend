import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { queryClient } from '@/app/query-client';
import { ToastViewport } from '@/shared/components/organisms/ToastViewport';

import { AssistantProvider } from './AssistantProvider';

export const WorkspaceProviders = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const clearSessionData = () => queryClient.clear();
    window.addEventListener('control-center:session-change', clearSessionData);
    return () => window.removeEventListener('control-center:session-change', clearSessionData);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>{children}</AssistantProvider>
      <ToastViewport />
    </QueryClientProvider>
  );
};
