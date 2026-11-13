import { createFileRoute } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from '../../app/app-shell';

export const Route = createFileRoute('/$locale')({
  component: LocaleWorkspace,
  notFoundComponent: NotFound,
});
