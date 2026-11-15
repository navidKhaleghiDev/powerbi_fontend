import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/features/auth/api/auth-api';
import { DatasetsPage } from '@/features/datasets/pages/DatasetsPage';

export const Route = createFileRoute('/$locale/datasets')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DatasetsPage,
});
