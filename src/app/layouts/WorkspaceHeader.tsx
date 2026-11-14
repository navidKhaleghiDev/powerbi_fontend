import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { Typography } from '@/shared/components/ui/typography';
import { toast } from '@/shared/lib/toast';
import { clearAuthTokens } from '@/shared/network/api';

export const WorkspaceHeader = () => {
  const locale = useLocale();
  const t = useTranslations('studio');
  const d = useTranslations('dashboard');
  const c = useTranslations('cube');
  const queryClient = useQueryClient();
  const dashboard = useLocation().pathname.replace(/\/$/, '').endsWith('/dashboard');
  return (
    <header className="workspace-header">
      <div className="workspace-header-copy">
        <Typography as="h1" variant="h4">
          {dashboard ? d('title') : c('tabs.model')}
        </Typography>
        <Typography variant="body3Medium">
          {dashboard ? d('description') : t('design.sectionHelp.overview')}
        </Typography>
      </div>
      <Link
        to="/$locale/login"
        params={{ locale }}
        replace
        onClick={() => {
          clearAuthTokens();
          queryClient.clear();
          toast.success();
        }}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
      >
        <LogOut size={16} aria-hidden="true" />
        {t('logout')}
      </Link>
    </header>
  );
};
