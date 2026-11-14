import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import { LayoutDashboard } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { analyticsRequest, type AnalyticsMetadata } from '@/features/datasets/api/analytics';
import { AnalyticsDatasets } from '@/features/datasets/organisms/AnalyticsDatasets';
import { Button, buttonVariants } from '@/shared/components/atoms/button';
import { IconTooltip } from '@/shared/components/molecules/icon-tooltip';

const DatasetWorkspace = ({
  mode,
  datasetId,
}: {
  mode: 'list' | 'create' | 'edit' | 'clone';
  datasetId?: number;
}) => {
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
    <section className="analytics-management dataset-workspace">
      <header className="flex justify-end">
        <IconTooltip label={t('titleDashboard')}>
          <Link
            to="/$locale/dashboard"
            params={{ locale }}
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
          >
            <LayoutDashboard aria-hidden="true" />
          </Link>
        </IconTooltip>
      </header>
      {metadata.isError ? (
        <div role="alert">
          <p>{metadata.error.message}</p>
          <Button onClick={() => void metadata.refetch()}>{t('retry')}</Button>
        </div>
      ) : metadata.data ? (
        <AnalyticsDatasets templates={metadata.data.templates} mode={mode} datasetId={datasetId} />
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </section>
  );
};

export const DatasetsPage = () => <DatasetWorkspace mode="list" />;
export const CreateDatasetPage = () => <DatasetWorkspace mode="create" />;
export const EditDatasetPage = () => {
  const { datasetId } = useParams({ strict: false });
  return <DatasetWorkspace mode="edit" datasetId={Number(datasetId)} />;
};
export const CloneDatasetPage = () => {
  const { datasetId } = useParams({ strict: false });
  return <DatasetWorkspace mode="clone" datasetId={Number(datasetId)} />;
};
