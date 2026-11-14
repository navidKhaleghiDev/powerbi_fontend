import { createFileRoute } from '@tanstack/react-router';

import { DataFlowsPage } from '@/features/data-flows/components/DataFlowsPage';

export const Route = createFileRoute('/$locale/cdc-connections/')({
  component: DataFlowsPage,
});
