import { createFileRoute } from '@tanstack/react-router';

import { KpiDashboardPage } from '@/features/kpis/pages/KpiDashboardPage';

export const Route = createFileRoute('/$locale/kpis/$dashboardId')({ component: KpiDashboardPage });
