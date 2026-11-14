import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from './App';
import { LoginPage } from './components/auth/LoginPage';
import { CreateConsumerPage } from './components/workspace/CreateConsumerAction';
import { DashboardPage } from './components/workspace/DashboardPage';
import { DataFlowPage } from './components/workspace/DataFlowPage';
import { DataFlowsPage } from './components/workspace/DataFlowsPage';
import {
  CloneDatasetPage,
  CreateDatasetPage,
  DatasetsPage,
  EditDatasetPage,
} from './components/workspace/DatasetsPage';
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
const datasetsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'datasets',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DatasetsPage,
});
const createDatasetRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'datasets/new',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CreateDatasetPage,
});
const editDatasetRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'datasets/$datasetId/edit',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: EditDatasetPage,
});
const cloneDatasetRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'datasets/$datasetId/clone',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CloneDatasetPage,
});
const dataFlowRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'data-flows/new',
  beforeLoad: ({ params }) =>
    redirect({ to: '/$locale/cdc-connections/new', params, replace: true }),
});
const createCdcConnectionRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'cdc-connections/new',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowPage,
});
const dataFlowsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'data-flows',
  beforeLoad: ({ params }) => redirect({ to: '/$locale/cdc-connections', params, replace: true }),
});
const cdcConnectionsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'cdc-connections',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowsPage,
});
const createConsumerRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: 'cdc-connections/$connectorName/consumer',
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CreateConsumerPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    localeRoute.addChildren([
      localeIndexRoute,
      loginRoute,
      overviewRoute,
      dashboardRoute,
      datasetsRoute,
      createDatasetRoute,
      editDatasetRoute,
      cloneDatasetRoute,
      dataFlowsRoute,
      cdcConnectionsRoute,
      createConsumerRoute,
      createCdcConnectionRoute,
      dataFlowRoute,
    ]),
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
