import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/')({
  beforeLoad: ({ params }) => {
    if (params.locale === 'en' || params.locale === 'fa')
      return redirect({ to: '/$locale/login', params, replace: true });
  },
});
