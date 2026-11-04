import { useLocation, useSearch } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Typography } from '@/components/ui/typography';
import { configurationSection } from '@/lib/flows/navigation';

export const WorkspaceHeader = () => {
  const t = useTranslations('studio');
  const { pathname } = useLocation();
  const search = useSearch({ from: '/$locale' });
  const reporting = pathname.split('/').includes('analytics');
  const section = configurationSection(search.section ?? null);
  const view = pathname.split('/').filter(Boolean).at(-1);
  const title = reporting
    ? t(
        view === 'kpis'
          ? 'metric.title'
          : view === 'data'
            ? 'dataBrowser.title'
            : 'design.analyticsTitle',
      )
    : t(
        section === 'overview'
          ? 'design.overviewTitle'
          : section === 'metrics'
            ? 'metric.title'
            : section === 'data'
              ? 'dataBrowser.title'
              : section,
      );
  const description = reporting
    ? t(
        view === 'kpis'
          ? 'metric.help'
          : view === 'data'
            ? 'dataBrowser.description'
            : 'design.analyticsHelp',
      )
    : t(
        section === 'metrics'
          ? 'metric.help'
          : section === 'data'
            ? 'dataBrowser.description'
            : `design.sectionHelp.${section}`,
      );

  return (
    <header className="workspace-header">
      <div className="workspace-header-copy">
        <Typography as="h1" variant="h4">
          {title}
        </Typography>
        <Typography variant="body3Medium">{description}</Typography>
      </div>
    </header>
  );
};
