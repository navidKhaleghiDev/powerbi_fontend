import { createFileRoute } from '@tanstack/react-router';

import { LocaleWorkspace, NotFound } from '../../App';

export const Route = createFileRoute('/$locale')({
  component: LocaleWorkspace,
  notFoundComponent: NotFound,
});
