import { createFileRoute, redirect } from '@tanstack/react-router';

import { CreateConsumerPage } from '../../../../components/workspace/CreateConsumerAction';
import { hasAccessToken } from '../../../../lib/api';

export const Route = createFileRoute('/$locale/cdc-connections/$connectorName/consumer')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CreateConsumerPage,
});
