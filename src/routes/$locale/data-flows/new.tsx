import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/data-flows/new')({
  beforeLoad: ({ params }) =>
    redirect({ to: '/$locale/cdc-connections/new', params, replace: true }),
});
