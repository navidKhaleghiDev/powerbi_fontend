import { createFileRoute, redirect } from '@tanstack/react-router';

import { CreateDatasetPage } from '@/features/datasets/pages/DatasetsPage';
import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/datasets/new')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken())
      return redirect({ to: '/$locale/login', params: { locale: params.locale }, replace: true });
  },
  component: CreateDatasetPage,
});
