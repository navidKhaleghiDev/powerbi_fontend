import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Database, Globe2, LayoutDashboard, LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { IconTooltip } from '@/components/ui/icon-tooltip';
import { clearAuthTokens } from '@/lib/api';
import { toast } from '@/lib/toast';

export const ApplicationSidebar = () => {
  const t = useTranslations('studio');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const d = useTranslations('dashboard');
  const otherLocale = locale === 'fa' ? 'en' : 'fa';
  const queryClient = useQueryClient();

  return (
    <aside className="workspace-rail">
      <IconTooltip label={t('design.brand')}>
        <Link
          to="/$locale/dashboard"
          params={{ locale }}
          className="workspace-rail-brand"
          aria-label={t('design.brand')}
        >
          <img src="/brand/netsep-logo.png" width={27} height={34} alt="" />
        </Link>
      </IconTooltip>
      <nav className="workspace-rail-links" aria-label={t('workspaceNavigation')}>
        <IconTooltip label={d('title')}>
          <Link
            to="/$locale/dashboard"
            params={{ locale }}
            className="workspace-rail-link"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'is-active', 'aria-current': 'page' }}
            aria-label={d('title')}
            data-label={d('title')}
          >
            <LayoutDashboard size={19} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
        <IconTooltip label={tw('cdcConnections')}>
          <Link
            to="/$locale/cdc-connections"
            params={{ locale }}
            className="workspace-rail-link"
            activeProps={{ className: 'is-active', 'aria-current': 'page' }}
            aria-label={tw('cdcConnections')}
            data-label={tw('cdcConnections')}
          >
            <Database size={19} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
      </nav>
      <div className="workspace-rail-footer">
        <IconTooltip label={t('logout')}>
          <Link
            to="/$locale/login"
            params={{ locale }}
            replace
            onClick={() => {
              clearAuthTokens();
              queryClient.clear();
              toast.success();
            }}
            className="workspace-rail-link workspace-rail-exit"
            aria-label={t('logout')}
          >
            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
        <IconTooltip label={tw('language')}>
          <Link
            className="workspace-rail-link"
            to="/$locale/dashboard"
            params={{ locale: otherLocale }}
            lang={otherLocale}
            aria-label={tw('language')}
            data-label={tw('language')}
          >
            <Globe2 size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
      </div>
    </aside>
  );
};
