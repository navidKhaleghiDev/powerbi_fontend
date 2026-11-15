import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasAccessToken } from '@/features/auth/api/auth-api';
import { EditDatasetPage } from '@/features/datasets/pages/DatasetsPage';

export const Route = createFileRoute('/$locale/datasets/$datasetId/edit')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken())
      return redirect({ to: '/$locale/login', params: { locale: params.locale }, replace: true });
  },
  component: EditDatasetPage,
});
