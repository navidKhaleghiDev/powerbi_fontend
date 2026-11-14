import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/features/dashboards/components/DashboardPage';

export const Route = createFileRoute('/$locale/dashboard')({
  component: DashboardPage,
});
