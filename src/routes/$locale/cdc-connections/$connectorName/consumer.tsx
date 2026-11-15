import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/features/auth/api/auth-api';
import { CreateConsumerPage } from '@/features/data-flows/pages/ConsumerPage';

export const Route = createFileRoute('/$locale/cdc-connections/$connectorName/consumer')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: CreateConsumerPage,
});
