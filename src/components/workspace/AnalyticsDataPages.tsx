import { useTranslations } from 'use-intl';

import { useWorkspace } from '@/hooks/useWorkspace';
import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { DataBrowser } from './DataBrowser';
import { Notice } from './FormParts';
import { MetricCatalogPanel } from './MetricCatalogPanel';

export const AnalyticsKpisPage = () => {
  const t = useTranslations('studio');
  const workspace = useWorkspace();
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  return (
    <section className="w-full min-w-0" aria-label={t('metric.chooseKpis')}>
      <MetricCatalogPanel state={workspace.data} />
    </section>
  );
};

export const AnalyticsPublishedDataPage = () => {
  const t = useTranslations('studio');
  const workspace = useWorkspace();
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  return (
    <section className="w-full min-w-0" aria-label={t('dataBrowser.title')}>
      <DataBrowser state={workspace.data} />
    </section>
  );
};
