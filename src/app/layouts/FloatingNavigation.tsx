import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChartNoAxesCombined,
  Database,
  Globe2,
  LayoutDashboard,
  LogOut,
  Workflow,
} from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { clearAuthTokens } from '@/features/auth/api/auth-api';
import { toast } from '@/shared/lib/toast';

export const FloatingNavigation = () => {
  const locale = useLocale();
  const t = useTranslations('studio');
  const analytics = useTranslations('analytics');
  const kpis = useTranslations('kpis');
  const workspace = useTranslations('workspace');
  const queryClient = useQueryClient();
  const items = [
    { to: '/$locale/dashboard', label: analytics('titleDashboard'), Icon: LayoutDashboard },
    { to: '/$locale/cdc-connections', label: t('cdcConnections'), Icon: Workflow },
    { to: '/$locale/datasets', label: analytics('manageDatasets'), Icon: Database },
    { to: '/$locale/kpis', label: kpis('title'), Icon: ChartNoAxesCombined },
  ] as const;

  return (
    <footer className="floating-navigation-footer">
      <nav className="floating-navigation" aria-label={t('workspaceNavigation')}>
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            params={{ locale }}
            className="floating-navigation-item"
            activeProps={{ className: 'is-active', 'aria-current': 'page' }}
            aria-label={label}
          >
            <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
            <span className="floating-navigation-label" aria-hidden="true">
              {label}
            </span>
          </Link>
        ))}
        <span className="floating-navigation-divider" aria-hidden="true" />
        <Link
          to="/$locale/dashboard"
          params={{ locale: locale === 'fa' ? 'en' : 'fa' }}
          className="floating-navigation-item"
          aria-label={workspace('language')}
        >
          <Globe2 size={21} strokeWidth={1.7} aria-hidden="true" />
          <span className="floating-navigation-label" aria-hidden="true">
            {workspace('language')}
          </span>
        </Link>
        <Link
          to="/$locale/login"
          params={{ locale }}
          replace
          className="floating-navigation-item floating-navigation-exit"
          aria-label={t('logout')}
          onClick={() => {
            clearAuthTokens();
            queryClient.clear();
            toast.success();
          }}
        >
          <LogOut size={21} strokeWidth={1.7} aria-hidden="true" />
          <span className="floating-navigation-label" aria-hidden="true">
            {t('logout')}
          </span>
        </Link>
      </nav>
    </footer>
  );
};
