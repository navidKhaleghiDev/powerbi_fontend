import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/cdc-connections')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: Outlet,
});
