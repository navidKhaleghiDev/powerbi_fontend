import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from './App';
import { LoginPage } from './components/auth/LoginPage';
import {
  AnalyticsKpisPage,
  AnalyticsPublishedDataPage,
} from './components/workspace/AnalyticsDataPages';
import { ConfigurationPanel } from './components/workspace/ConfigurationPanel';
import { ReportPage } from './components/workspace/ReportPage';

const rootRoute = createRootRoute({ notFoundComponent: NotFound });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    return redirect({ to: '/$locale/data-platform', params: { locale: 'fa' }, replace: true });
  },
});
const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$locale',
  component: LocaleWorkspace,
  notFoundComponent: NotFound,
  validateSearch: (search: Record<string, unknown>): { section?: string; report?: string } => ({
    section: typeof search.section === 'string' ? search.section : undefined,
    report: typeof search.report === 'string' ? search.report : undefined,
  }),
});
const localeIndexRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    if (params.locale === 'en' || params.locale === 'fa')
      return redirect({ to: '/$locale/data-platform', params, replace: true });
  },
});
const loginRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'login',
  component: LoginPage,
});
const configurationRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'data-platform',
  component: ConfigurationPanel,
});
const analyticsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'analytics',
  beforeLoad: ({ params, search }) => {
    if (params.locale === 'en' || params.locale === 'fa')
      return redirect({
        to: '/$locale/analytics/reports',
        params,
        search: { report: search.report },
        replace: true,
      });
  },
});
const reportsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'analytics/reports',
  component: ReportPage,
});
const kpisRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'analytics/kpis',
  component: AnalyticsKpisPage,
});
const dataRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'analytics/data',
  component: AnalyticsPublishedDataPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    localeRoute.addChildren([
      localeIndexRoute,
      loginRoute,
      configurationRoute,
      analyticsRoute,
      reportsRoute,
      kpisRoute,
      dataRoute,
    ]),
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
