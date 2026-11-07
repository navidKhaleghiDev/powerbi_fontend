import { Link } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { Typography } from '@/components/ui/typography';

export const WorkspaceHeader = () => {
  const locale = useLocale();
  const t = useTranslations('studio');
  return (
    <header className="workspace-header">
      <div className="workspace-header-copy">
        <Typography as="h1" variant="h4">
          {t('design.overviewTitle')}
        </Typography>
        <Typography variant="body3Medium">{t('design.sectionHelp.overview')}</Typography>
      </div>
      <Link
        to="/$locale/login"
        params={{ locale }}
        replace
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-raised"
      >
        <LogOut size={16} aria-hidden="true" />
        {t('logout')}
      </Link>
    </header>
  );
};
