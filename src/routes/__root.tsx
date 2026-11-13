import { createRootRoute, Outlet } from '@tanstack/react-router';

import { NotFound } from '../App';

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});
