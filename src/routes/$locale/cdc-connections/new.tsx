import { createFileRoute, redirect } from '@tanstack/react-router';

import { DataFlowPage } from '../../../components/workspace/DataFlowPage';
import { hasAccessToken } from '../../../lib/api';

export const Route = createFileRoute('/$locale/cdc-connections/new')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DataFlowPage,
});
