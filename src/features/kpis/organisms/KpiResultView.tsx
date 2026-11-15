import { Suspense, lazy } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import type { KpiChartType, KpiResult } from '@/features/kpis/api/kpi-api';

const display = (value: unknown): string =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);

const WarehouseChart = lazy(() =>
  import('@/shared/components/organisms/WarehouseChart').then((module) => ({
    default: module.WarehouseChart,
  })),
);

export const KpiResultView = ({
  result,
  title,
  kind,
}: {
  result: KpiResult;
  title: string;
  kind: KpiChartType;
}) => {
  const t = useTranslations('kpis');
  const locale = useLocale();
  if (!result.x.length) return <p role="status">{t('noResults')}</p>;
  const rows = result.x.map((x, index) => ({
    label: display(x),
    value: typeof result.y[index] === 'number' ? result.y[index] : Number(result.y[index]),
  }));
  if (kind === 'number' && Number.isFinite(rows[0]?.value))
    return (
      <strong className="text-3xl font-semibold">
        {new Intl.NumberFormat(locale).format(rows[0]?.value ?? 0)}
      </strong>
    );
  if (kind !== 'table' && kind !== 'number' && rows.every((row) => Number.isFinite(row.value)))
    return (
      <Suspense fallback={<p role="status">{t('loading')}</p>}>
        <WarehouseChart kind={kind === 'pie' ? 'pie' : kind} title={title} rows={rows} dashboard />
      </Suspense>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-start">{t('dimension')}</th>
            <th className="p-2 text-start">{t('value')}</th>
          </tr>
        </thead>
        <tbody>
          {result.x.map((x, index) => (
            <tr
              key={`${display(x)}-${display(result.y[index])}`}
              className="border-t border-slate-200"
            >
              <td className="p-2">{display(x)}</td>
              <td className="p-2">{display(result.y[index])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
