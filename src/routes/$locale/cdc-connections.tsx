import { createFileRoute, redirect } from '@tanstack/react-router';

import { DataFlowsPage } from '../../components/workspace/DataFlowsPage';
import { hasAccessToken } from '../../lib/api';

export const Route = createFileRoute('/$locale/cdc-connections')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowsPage,
});
