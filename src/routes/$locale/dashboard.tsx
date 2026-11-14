import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/features/dashboards/pages/DashboardPage';

export const Route = createFileRoute('/$locale/dashboard')({
  component: DashboardPage,
});
