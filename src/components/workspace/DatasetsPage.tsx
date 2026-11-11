import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';
import { useLocale, useTranslations } from 'use-intl';

import { Button, buttonVariants } from '@/components/ui/button';
import { analyticsRequest, type AnalyticsMetadata } from '@/lib/analytics';

import { AnalyticsDatasets } from './AnalyticsDatasets';

export const DatasetsPage = () => {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const metadata = useQuery({
    queryKey: ['analytics-metadata'],
    queryFn: ({ signal }) =>
      analyticsRequest<AnalyticsMetadata>('metadata/', undefined, undefined, signal),
    retry: false,
  });

  if (metadata.data && !metadata.data.can_manage)
    return <Navigate to="/$locale/dashboard" params={{ locale }} replace />;

  return (
    <section className="analytics-management">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t('manageDatasets')}</h1>
        <Link
          to="/$locale/dashboard"
          params={{ locale }}
          className={buttonVariants({ variant: 'outline' })}
        >
          {t('titleDashboard')}
        </Link>
      </header>
      {metadata.isError ? (
        <div role="alert">
          <p>{metadata.error.message}</p>
          <Button onClick={() => void metadata.refetch()}>{t('retry')}</Button>
        </div>
      ) : metadata.data ? (
        <AnalyticsDatasets templates={metadata.data.templates} />
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </section>
  );
};
