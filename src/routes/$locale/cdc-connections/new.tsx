import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/features/auth/api/auth-api';
import { DataFlowPage } from '@/features/data-flows/pages/DataFlowPage';

export const Route = createFileRoute('/$locale/cdc-connections/new')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowPage,
});
