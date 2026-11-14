import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { IntlProvider } from 'use-intl';

import { WorkspaceShell } from '@/app/layouts/app-layout';
import { WorkspaceProviders } from '@/app/providers/WorkspaceProviders';

import en from '../../public/locales/en.json';
import fa from '../../public/locales/fa.json';

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
