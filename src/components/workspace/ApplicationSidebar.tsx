import { Link, useLocation, useSearch } from '@tanstack/react-router';
import {
  CodeXml,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  LayoutDashboard,
  LogIn,
  Table,
  Workflow,
} from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { IconTooltip } from '@/components/ui/icon-tooltip';
import { configurationSection } from '@/lib/flows/navigation';

const destinations = [
  { id: 'overview', icon: LayoutDashboard, label: 'design.overviewTab', panel: 'configuration' },
  { id: 'sources', icon: Database, label: 'sources', panel: 'configuration' },
  { id: 'mapping', icon: GitBranch, label: 'mapping', panel: 'configuration' },
  { id: 'flows', icon: Workflow, label: 'flows', panel: 'configuration' },
  { id: 'reports', icon: LayoutDashboard, label: 'design.analyticsTitle', panel: 'analytics' },
  { id: 'kpis', icon: Gauge, label: 'metric.chooseKpis', panel: 'analytics' },
  { id: 'data', icon: Table, label: 'dataBrowser.title', panel: 'analytics' },
  { id: 'metrics', icon: FileText, label: 'metrics', panel: 'configuration' },
  { id: 'data', icon: Table, label: 'design.dataTab', panel: 'configuration' },
] as const;

export const ApplicationSidebar = () => {
  const t = useTranslations('studio');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const { pathname } = useLocation();
  const search = useSearch({ from: '/$locale' });
  const otherLocale = locale === 'fa' ? 'en' : 'fa';
  const otherPath = pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${otherLocale}`);
  const reporting = pathname.split('/').includes('analytics');
  const section = configurationSection(search.section ?? null);

  return (
    <aside className="workspace-rail">
      <IconTooltip label={t('design.brand')}>
        <Link
          to={reporting ? '/$locale/analytics/reports' : '/$locale/data-platform'}
          params={{ locale }}
          search={reporting ? {} : { section: 'overview' }}
          className="workspace-rail-brand"
          aria-label={t('design.brand')}
        >
          <img src="/brand/netsep-logo.png" width={27} height={34} alt="" />
        </Link>
      </IconTooltip>
      <nav
        className="workspace-rail-links"
        aria-label={t(reporting ? 'analyticsPanel' : 'configurationPanel')}
      >
        {destinations
          .filter((item) => item.panel === (reporting ? 'analytics' : 'configuration'))
          .map(({ id, icon: Icon, label, panel }) => {
            const href =
              panel === 'analytics'
                ? `/${locale}/analytics/${id}`
                : `/${locale}/data-platform?section=${id}`;
            const active =
              panel === 'analytics'
                ? pathname.replace(/\/$/, '') === href
                : !reporting && section === id;
            return (
              <IconTooltip key={`${panel}-${id}`} label={t(label)}>
                <Link
                  to={href.split('?')[0]}
                  search={Object.fromEntries(new URLSearchParams(href.split('?')[1]))}
                  className={`workspace-rail-link ${active ? 'is-active' : ''}`}
                  aria-label={t(label)}
                  aria-current={active ? 'page' : undefined}
                  data-label={t(label)}
                >
                  <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </IconTooltip>
            );
          })}
      </nav>
      <div className="workspace-rail-footer">
        <IconTooltip label={t('design.switchPanel')}>
          <Link
            to="/$locale/login"
            params={{ locale }}
            className="workspace-rail-link workspace-rail-exit"
            aria-label={t('design.switchPanel')}
            data-label={t('design.switchPanel')}
          >
            <LogIn size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </IconTooltip>
        {!reporting ? (
          <IconTooltip label={t('design.csvShortcut')}>
            <Link
              to="/$locale/data-platform"
              params={{ locale }}
              search={{ section: 'mapping' }}
              className="workspace-rail-link workspace-rail-shortcut"
              aria-label={t('design.csvShortcut')}
              data-label={t('design.csvShortcut')}
            >
              <CodeXml size={20} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </IconTooltip>
        ) : null}
        <IconTooltip label={tw('language')}>
          <Link
            className="workspace-rail-link"
            to={otherPath}
            search={search}
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
