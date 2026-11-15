import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { loadSampleAnalytics } from '@/features/dashboards/lib/dashboard-demo';
import { Button } from '@/shared/ui/atoms/button/button';

import type { AnalyticsFilters, Dataset, Metric } from '@/features/datasets/api/analytics';

export const AnalyticsRecords = ({
  dataset,
  metric,
  filters,
}: {
  dataset: Dataset;
  metric: Metric;
  filters: AnalyticsFilters;
}) => {
  const t = useTranslations('analytics');
  const [cursors, setCursors] = useState<string[]>(['']);
  const cursor = cursors[cursors.length - 1];
  const result = useQuery({
    queryKey: ['analytics-records', dataset.slug, dataset.revision, metric.key, filters, cursor],
    queryFn: ({ signal }) =>
      loadSampleAnalytics(dataset, metric, [], filters, signal, { details: true, cursor }),
    retry: false,
  });
  return (
    <div className="analytics-form">
      <p>{t('recordsHelp')}</p>
      {result.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : result.isError ? (
        <p role="alert">
          {result.error.message}
          <Button onClick={() => void result.refetch()}>{t('retry')}</Button>
        </p>
      ) : (
        <div className="bi-table-scroll">
          <table>
            <caption>
              {dataset.title} — {metric.title}
            </caption>
            <thead>
              <tr>
                {result.data.columns.map((column) => (
                  <th scope="col" key={column.key}>
                    {column.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.rows.map((row) => (
                <tr key={String(row._record_id)}>
                  {result.data.columns.map((column) => (
                    <td key={column.key}>{row[column.key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!result.data.rows.length && <p>{t('empty')}</p>}
        </div>
      )}
      <div>
        <Button
          variant="outline"
          disabled={cursors.length <= 1 || result.isFetching}
          onClick={() => setCursors((items) => items.slice(0, -1))}
        >
          {t('previous')}
        </Button>
        <Button
          variant="outline"
          disabled={!result.data?.meta.next_cursor || result.isFetching}
          onClick={() => {
            const next = result.data?.meta.next_cursor;
            if (next) setCursors((items) => [...items, next]);
          }}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
};
