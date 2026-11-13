import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/data-flows')({
  beforeLoad: ({ params }) => redirect({ to: '/$locale/cdc-connections', params, replace: true }),
});
