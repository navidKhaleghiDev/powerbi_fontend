import { createFileRoute, redirect } from '@tanstack/react-router';

import { CreateConsumerPage } from '@/features/data-flows/pages/ConsumerPage';
import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/cdc-connections/$connectorName/consumer')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CreateConsumerPage,
});
