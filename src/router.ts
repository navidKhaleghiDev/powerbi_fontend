import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from './App';
import { LoginPage } from './components/auth/LoginPage';
import { DashboardPage } from './components/workspace/DashboardPage';
import { hasAccessToken } from './lib/api';

const rootRoute = createRootRoute({ notFoundComponent: NotFound });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    return redirect({ to: '/$locale/login', params: { locale: 'fa' }, replace: true });
  },
});
const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$locale',
  component: LocaleWorkspace,
  notFoundComponent: NotFound,
});
const localeIndexRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    if (params.locale === 'en' || params.locale === 'fa')
      return redirect({ to: '/$locale/login', params, replace: true });
  },
});
const loginRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'login',
  component: LoginPage,
});
const overviewRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'data-platform',
  beforeLoad: ({ params }) => redirect({ to: '/$locale/dashboard', params, replace: true }),
});

const dashboardRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'dashboard',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DashboardPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    localeRoute.addChildren([localeIndexRoute, loginRoute, overviewRoute, dashboardRoute]),
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
