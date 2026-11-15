import { Activity } from 'lucide-react';
import { Suspense, lazy, useId } from 'react';
import { useTranslations } from 'use-intl';

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
  const gradientId = useId();
  if (!result.x.length) return <p role="status">{t('noResults')}</p>;
  const rows = result.x.map((x, index) => ({
    label: display(x),
    value: typeof result.y[index] === 'number' ? result.y[index] : Number(result.y[index]),
  }));
  if (kind === 'number') {
    const values = rows.map((row) => row.value);
    const finite = values.filter(Number.isFinite);
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const points = values.map((value, index) => ({
      x: 6 + (index * 148) / Math.max(values.length - 1, 1),
      y: max === min ? 40 : 70 - ((value - min) * 58) / (max - min),
      value,
    }));
    const path = points
      .map((point, index) =>
        Number.isFinite(point.value)
          ? `${index && Number.isFinite(points[index - 1]?.value) ? 'L' : 'M'} ${point.x} ${point.y}`
          : '',
      )
      .join(' ');
    return (
      <div className="kpi-reference-layout">
        <div className="kpi-reference-icon" aria-hidden="true">
          <Activity />
        </div>
        <div className="kpi-reference-copy">
          <span>{title}</span>
          <strong>{display(result.y[0])}</strong>
        </div>
        {finite.length > 1 && (
          <svg
            className="kpi-reference-sparkline"
            viewBox="0 0 160 84"
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="currentColor" stopOpacity="0.25" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L ${points.at(-1)?.x} 82 L 6 82 Z`} fill={`url(#${gradientId})`} />
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    );
  }
  if (kind !== 'table' && rows.every((row) => Number.isFinite(row.value)))
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
