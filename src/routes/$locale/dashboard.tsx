import { createFileRoute, redirect } from '@tanstack/react-router';

import { DashboardPage } from '../../components/workspace/DashboardPage';
import { hasAccessToken } from '../../lib/api';

export const Route = createFileRoute('/$locale/dashboard')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DashboardPage,
});
