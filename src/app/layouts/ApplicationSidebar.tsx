import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Database, Globe2, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { AppDialog } from '@/shared/components/ui/app-dialog';
import { IconTooltip } from '@/shared/components/ui/icon-tooltip';
import { toast } from '@/shared/lib/toast';
import { clearAuthTokens } from '@/shared/network/api';

export const ApplicationSidebar = () => {
  const t = useTranslations('studio');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const d = useTranslations('dashboard');
  const otherLocale = locale === 'fa' ? 'en' : 'fa';
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="workspace-topbar">
      <button
        type="button"
        className="workspace-menu-button"
        onClick={() => setOpen(true)}
        aria-label={t('sidebar.menu')}
        aria-haspopup="dialog"
      >
        <Menu size={22} />
      </button>
      <span className="workspace-topbar-title">{t('design.brand')}</span>
      <AppDialog open={open} onClose={close} className="workspace-drawer">
        <div className="workspace-drawer-heading">
          <h2>{t('workspaceNavigation')}</h2>
          <button
            type="button"
            className="workspace-menu-button"
            onClick={close}
            aria-label={t('sidebar.menu')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-drawer-content" onClick={close}>
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
            <IconTooltip label={t('cdcConnections')}>
              <Link
                to="/$locale/cdc-connections"
                params={{ locale }}
                className="workspace-rail-link"
                activeProps={{ className: 'is-active', 'aria-current': 'page' }}
                aria-label={t('cdcConnections')}
                data-label={t('cdcConnections')}
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
        </div>
      </AppDialog>
    </header>
  );
};
