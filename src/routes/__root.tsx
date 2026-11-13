import { createRootRoute, Outlet } from '@tanstack/react-router';

import { NotFound } from '../app/app-shell';

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});
