import { createFileRoute, redirect } from '@tanstack/react-router';

import { DataFlowPage } from '@/features/data-flows/components/DataFlowPage';
import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/cdc-connections/new')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowPage,
});
