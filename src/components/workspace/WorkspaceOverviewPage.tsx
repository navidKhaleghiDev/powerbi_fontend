import { useTranslations } from 'use-intl';

import { CubeDataCard } from './CubeDataCard';

export const WorkspaceOverviewPage = () => {
  const t = useTranslations('studio');
  return (
    <section aria-label={t('design.overviewTitle')} className="w-full min-w-0 space-y-7">
      <CubeDataCard />
    </section>
  );
};
