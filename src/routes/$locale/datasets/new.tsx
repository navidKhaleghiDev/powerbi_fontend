import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/features/auth/api/auth-api';
import { CreateDatasetPage } from '@/features/datasets/pages/DatasetsPage';

export const Route = createFileRoute('/$locale/datasets/new')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken())
      return redirect({ to: '/$locale/login', params: { locale: params.locale }, replace: true });
  },
  component: CreateDatasetPage,
});
