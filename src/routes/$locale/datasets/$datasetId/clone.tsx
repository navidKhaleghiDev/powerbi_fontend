import { createFileRoute, redirect } from '@tanstack/react-router';

import { CloneDatasetPage } from '@/features/datasets/pages/DatasetsPage';
import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/datasets/$datasetId/clone')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken())
      return redirect({ to: '/$locale/login', params: { locale: params.locale }, replace: true });
  },
  component: CloneDatasetPage,
});
