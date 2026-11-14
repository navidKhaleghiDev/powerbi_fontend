import { createFileRoute, redirect } from '@tanstack/react-router';

import { DatasetsPage } from '@/features/datasets/pages/DatasetsPage';
import { hasAccessToken } from '@/shared/network/api';

export const Route = createFileRoute('/$locale/datasets')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DatasetsPage,
});
