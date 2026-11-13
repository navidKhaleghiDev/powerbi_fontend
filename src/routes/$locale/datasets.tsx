import { createFileRoute, redirect } from '@tanstack/react-router';

import { DatasetsPage } from '../../components/workspace/DatasetsPage';
import { hasAccessToken } from '../../lib/api';

export const Route = createFileRoute('/$locale/datasets')({
  beforeLoad: ({ params }) => {
    if (!hasAccessToken()) return redirect({ to: '/$locale/login', params, replace: true });
  },
  component: DatasetsPage,
});
