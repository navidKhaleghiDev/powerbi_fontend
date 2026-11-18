import { QueryClientProvider } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useLocale } from 'use-intl';

import { queryClient } from '@/app/query-client';
import { hasAccessToken } from '@/features/auth/api/auth-api';
import { ToastViewport } from '@/shared/components/organisms/ToastViewport';

import { AssistantProvider } from './AssistantProvider';

export const WorkspaceProviders = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const locale = useLocale();

  useEffect(() => {
    const handleSessionChange = () => {
      queryClient.clear();
      if (!hasAccessToken()) {
        void navigate({ to: '/$locale/login', params: { locale }, replace: true });
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === null || event.key === 'control-center.access-token') {
        handleSessionChange();
      }
    };
    window.addEventListener('control-center:session-change', handleSessionChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('control-center:session-change', handleSessionChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [locale, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>{children}</AssistantProvider>
      <ToastViewport />
    </QueryClientProvider>
  );
};
