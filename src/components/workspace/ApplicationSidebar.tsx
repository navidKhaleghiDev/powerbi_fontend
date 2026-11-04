import {
  Database,
  FileText,
  Gauge,
  GitBranch,
  Languages,
  LayoutDashboard,
  Menu,
  Table,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  configurationSection,
  configurationSections,
  type ConfigurationSection,
} from '@/lib/flows/navigation';

import { StatusBadge } from './StatusBadge';

const sectionIcons = {
  overview: LayoutDashboard,
  data: Table,
  sources: Database,
  mapping: GitBranch,
  flows: Workflow,
  metrics: Gauge,
} satisfies Record<ConfigurationSection, typeof Table>;

export const ApplicationSidebar = () => {
  const t = useTranslations('studio');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const { pathname } = useLocation();
  const [search] = useSearchParams();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const reporting = pathname.split('/').includes('analytics');
  const currentSection = configurationSection(search.get('section'));
  const itemClass = (active: boolean) =>
    `flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-normal transition-colors ${active ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <aside className="glass-surface mx-4 mt-4 min-w-0 rounded-2xl border p-3 lg:sticky lg:top-0 lg:mx-0 lg:mt-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:rounded-none lg:border-y-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-1 pb-3">
        <Link
          to={`/${locale}/${reporting ? 'analytics/reports' : 'data-platform'}`}
          className="min-w-0 text-xs leading-5 font-normal text-slate-900"
        >
          <span className="flex min-w-0 items-center gap-3 py-1">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <img
                src="/brand/netsep-mark.svg"
                alt={t('sidebar.netsepLogo')}
                width={25}
                height={32}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-5 font-normal">{tw('title')}</span>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                <img
                  src="/brand/power-bi.svg"
                  alt={t('sidebar.powerBiLogo')}
                  width={12}
                  height={14}
                  className="shrink-0 object-contain"
                />
                <span>{t('sidebar.powerBiName')}</span>
              </span>
            </span>
          </span>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 font-normal lg:hidden"
          aria-expanded={open}
          aria-controls="workspace-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <Menu size={15} aria-hidden="true" />
          {t('sidebar.menu')}
        </Button>
      </div>
      <div
        id="workspace-navigation"
        className={`${open ? 'block' : 'hidden'} pt-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4`}
      >
        <div className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <nav
            aria-label={t(reporting ? 'experience.analyticsViews' : 'configurationPanel')}
            className="grid gap-1"
          >
            {reporting
              ? (
                  [
                    { path: 'kpis', label: 'metric.chooseKpis', icon: Gauge },
                    { path: 'reports', label: 'metric.reportEditor', icon: FileText },
                    { path: 'data', label: 'dataBrowser.title', icon: Table },
                  ] as const
                ).map((page) => {
                  const href = `/${locale}/analytics/${page.path}`;
                  return (
                    <Link
                      key={page.path}
                      to={href}
                      aria-current={pathname === href ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={itemClass(pathname === href)}
                    >
                      <page.icon
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      <span>{t(page.label)}</span>
                    </Link>
                  );
                })
              : configurationSections.map((section) => {
                  const Icon = sectionIcons[section];
                  return (
                    <Link
                      key={section}
                      to={`/${locale}/data-platform?section=${section}`}
                      aria-current={currentSection === section ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={itemClass(currentSection === section)}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                      <span>{t(section)}</span>
                    </Link>
                  );
                })}
          </nav>
          {workspace.data?.flows.some((flow) => flow.sampleData) && (
            <div role="status" className="px-2">
              <StatusBadge tone="warning">{t('sampleDataBadge')}</StatusBadge>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-4 lg:mt-auto lg:shrink-0">
          <nav
            aria-label={t('sidebar.language')}
            className="flex gap-2 border-t border-slate-200 pt-3"
          >
            {(['fa', 'en'] as const).map((language) => {
              const path = pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${language}`);
              return (
                <Link
                  key={language}
                  to={`${path}${search.size ? `?${search.toString()}` : ''}`}
                  lang={language}
                  aria-current={locale === language ? 'true' : undefined}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-center text-xs font-normal ${locale === language ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Languages size={14} strokeWidth={1.5} aria-hidden="true" />
                  {t(language === 'fa' ? 'sidebar.persian' : 'sidebar.english')}
                </Link>
              );
            })}
          </nav>
          <nav className="border-t border-slate-200 pt-3" aria-label={t('configurationPanel')}>
            <Link
              className={itemClass(false)}
              to={`/${locale}/${reporting ? 'data-platform' : 'analytics/reports'}`}
            >
              {t(reporting ? 'configurationPanel' : 'metric.reportEditor')}
            </Link>
          </nav>
        </div>
      </div>
    </aside>
  );
};
