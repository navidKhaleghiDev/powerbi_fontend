import { useEffect } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router';
import { IntlProvider } from 'use-intl';

import {
  AnalyticsKpisPage,
  AnalyticsPublishedDataPage,
} from '@/components/workspace/AnalyticsDataPages';
import { ConfigurationPanel } from '@/components/workspace/ConfigurationPanel';
import { ReportPage } from '@/components/workspace/ReportPage';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { WorkspaceProviders } from '@/components/WorkspaceProviders';

import en from '../public/locales/en.json';
import fa from '../public/locales/fa.json';

const LocaleWorkspace = () => {
  const { locale } = useParams();
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
          className="sr-only rounded-xl bg-white px-4 py-3 text-teal-800 shadow-lg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
        >
          {messages.studio.skipToContent}
        </a>
        <WorkspaceShell
          notice={
            <p
              role="status"
              className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {messages.workspace.frontendOnlyNotice}
            </p>
          }
        >
          <Outlet />
        </WorkspaceShell>
      </WorkspaceProviders>
    </IntlProvider>
  );
};

const NotFound = () => (
  <main className="p-8">
    <h1>404</h1>
    <Link to="/fa/data-platform">{fa.workspace.title}</Link>
    {' · '}
    <Link to="/en/data-platform">{en.workspace.title}</Link>
  </main>
);

export const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/fa/data-platform" replace />} />
    <Route path="/:locale" element={<LocaleWorkspace />}>
      <Route index element={<Navigate to="data-platform" replace />} />
      <Route path="data-platform" element={<ConfigurationPanel />} />
      <Route path="analytics" element={<ReportPage redirect />} />
      <Route path="analytics/reports" element={<ReportPage />} />
      <Route path="analytics/kpis" element={<AnalyticsKpisPage />} />
      <Route path="analytics/data" element={<AnalyticsPublishedDataPage />} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);
