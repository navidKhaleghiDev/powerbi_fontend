import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/data-platform')({
  beforeLoad: ({ params }) => redirect({ to: '/$locale/dashboard', params, replace: true }),
});
