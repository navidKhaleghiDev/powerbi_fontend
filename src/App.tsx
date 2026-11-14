import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { IntlProvider } from 'use-intl';

import { AssistantProvider } from '@/components/AssistantProvider';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { toast } from '@/lib/toast';
import { WorkspaceShell } from '@/shared/components/layout/app-layout';

import en from '../public/locales/en.json';
import fa from '../public/locales/fa.json';

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

export const LocaleWorkspace = () => {
  const { locale } = useParams({ from: '/$locale' });
  const { pathname } = useLocation();
  const login = pathname.replace(/\/$/, '').endsWith('/login');
  const messages = locale === 'en' ? en : fa;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
    document.title = messages.workspace.title;
    document.body.className = `workspace-canvas ${locale === 'fa' ? 'font-kalameh' : 'font-sans'}`;
  }, [locale, messages]);

  return (
    <IntlProvider locale={locale} messages={messages} timeZone="Asia/Tehran">
      <WorkspaceProviders>
        <a
          href="#workspace-content"
          className="sr-only rounded-xl bg-surface-default px-4 py-3 text-text-info shadow-lg focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50"
        >
          {messages.studio.skipToContent}
        </a>
        {login ? (
          <Outlet />
        ) : (
          <WorkspaceShell>
            <Outlet />
          </WorkspaceShell>
        )}
      </WorkspaceProviders>
    </IntlProvider>
  );
};

export const NotFound = () => (
  <main className="p-8">
    <h1>404</h1>
    <Link to="/$locale/dashboard" params={{ locale: 'fa' }}>
      {fa.workspace.title}
    </Link>
    {' · '}
    <Link to="/$locale/dashboard" params={{ locale: 'en' }}>
      {en.workspace.title}
    </Link>
  </main>
);
