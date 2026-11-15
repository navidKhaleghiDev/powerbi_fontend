import { createFileRoute } from '@tanstack/react-router';

import { KpiDashboardsPage } from '@/features/kpis/pages/KpiDashboardsPage';

export const Route = createFileRoute('/$locale/kpis/')({ component: KpiDashboardsPage });
