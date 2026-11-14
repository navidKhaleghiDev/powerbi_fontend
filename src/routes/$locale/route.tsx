import { createFileRoute, notFound } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from '@/app/App';

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    // TanStack Router uses this thrown value to render the route's 404 boundary.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (params.locale !== 'en' && params.locale !== 'fa') throw notFound();
  },
  component: LocaleWorkspace,
  notFoundComponent: NotFound,
});
