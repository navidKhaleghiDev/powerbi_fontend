import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { IntlProvider } from 'use-intl';

import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { WorkspaceProviders } from '@/components/WorkspaceProviders';
import { useReportsMockMode } from '@/hooks/useWorkspace';

import en from '../public/locales/en.json';
import fa from '../public/locales/fa.json';

export const LocaleWorkspace = () => {
  const { locale } = useParams({ from: '/$locale' });
  const { pathname } = useLocation();
  const reportsMockMode = useReportsMockMode();
  const login = pathname.replace(/\/$/, '').endsWith('/login');
  const valid = locale === 'en' || locale === 'fa';
  const messages = locale === 'en' ? en : fa;
  useEffect(() => {
    if (!valid) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
    document.title = messages.workspace.title;
    document.body.className = `workspace-canvas ${locale === 'fa' ? 'font-kalameh' : 'font-sans'}`;
  }, [locale, valid, messages]);
  if (!valid) return <NotFound />;
  return (
    <IntlProvider locale={locale} messages={messages} timeZone="Asia/Tehran">
      <WorkspaceProviders>
        <a
          href="#workspace-content"
          className="sr-only rounded-xl bg-surface-default px-4 py-3 text-text-info shadow-lg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
        >
          {messages.studio.skipToContent}
        </a>
        {login ? (
          <Outlet />
        ) : (
          <WorkspaceShell
            notice={
              <p role="status" className="workspace-mode-text">
                {reportsMockMode
                  ? messages.workspace.reportsMockNotice
                  : messages.workspace.frontendOnlyNotice}
              </p>
            }
          >
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
    <Link to="/$locale/data-platform" params={{ locale: 'fa' }}>
      {fa.workspace.title}
    </Link>
    {' · '}
    <Link to="/$locale/data-platform" params={{ locale: 'en' }}>
      {en.workspace.title}
    </Link>
  </main>
);
