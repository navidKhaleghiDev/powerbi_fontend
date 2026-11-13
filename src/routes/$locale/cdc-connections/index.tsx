import { createFileRoute } from '@tanstack/react-router';

import { DataFlowsPage } from '../../../components/workspace/DataFlowsPage';

export const Route = createFileRoute('/$locale/cdc-connections/')({
  component: DataFlowsPage,
});
