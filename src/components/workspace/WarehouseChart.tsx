import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useLocale, useTranslations } from 'use-intl';

import { formatExactValue } from '@/lib/flows/display';

import type { AnalyticsResult } from '@/lib/flows/types';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const colors = ['#14b8a6', '#81c995', '#cd8185', '#b5a5d4', '#dac38d', '#8fbcc5'];
type VisualKind = 'bar' | 'line' | 'doughnut';
interface Props {
  kind: 'bar' | 'line' | 'pie';
  title: string;
  rows: AnalyticsResult['rows'];
}

export const WarehouseChart = ({ kind, title, rows }: Props) => {
  const locale = useLocale();
  const t = useTranslations('studio');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) setFontFamily(getComputedStyle(document.body).fontFamily);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  const rtl = locale === 'fa';
  const labels = rows.map((row) => String(row.label ?? t('allRows')));
  const values = rows.map((row) => {
    if (row.value === null || row.value === undefined || row.value === '') return null;
    const value = Number(row.value);
    return Number.isFinite(value) ? value : null;
  });
  const number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const font = { family: fontFamily, size: 12 };
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    locale,
    layout: { padding: { top: 12, bottom: 8 } },
    plugins: {
      legend: {
        display: false,
        position: 'bottom' as const,
        rtl,
        textDirection: rtl ? 'rtl' : 'ltr',
        labels: { color: '#475569', padding: 20, usePointStyle: true, boxWidth: 10, font },
      },
      tooltip: {
        rtl,
        textDirection: rtl ? 'rtl' : 'ltr',
        backgroundColor: '#0f172a',
        titleFont: font,
        bodyFont: font,
        padding: 12,
        cornerRadius: 10,
        displayColors: kind === 'pie',
        callbacks: {
          label: (context: { dataIndex: number }) =>
            `${title}: ${formatExactValue(rows[context.dataIndex]?.value, locale)}`,
        },
      },
    },
  } satisfies ChartOptions<VisualKind>;
  const cartesian = {
    ...common,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#64748b',
          font,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
          callback: (_value: string | number, index: number) => {
            const label = labels[index] || '';
            return label.length > 22 ? `${label.slice(0, 21)}…` : label;
          },
        },
      },
      y: {
        beginAtZero: true,
        position: rtl ? ('right' as const) : ('left' as const),
        grid: { color: '#f1f5f9' },
        border: { display: false },
        ticks: {
          color: '#64748b',
          font,
          maxTicksLimit: 7,
          padding: 10,
          callback: (value: string | number) => number.format(Number(value)),
        },
      },
    },
  } satisfies ChartOptions<'bar' | 'line'>;
  const canShowDistribution =
    values.every((value) => value !== null && value >= 0) &&
    values.some((value) => value !== null && value > 0);
  const canvasProps = { role: 'img', 'aria-label': title };

  return (
    <div className="space-y-4">
      <div
        className="workspace-chart-canvas relative h-[clamp(16rem,35dvh,25rem)] w-full min-w-0"
        dir={rtl ? 'rtl' : 'ltr'}
      >
        {kind === 'bar' ? (
          <Bar
            {...canvasProps}
            options={cartesian}
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values,
                  backgroundColor: '#14b8a6',
                  hoverBackgroundColor: '#0d9488',
                  borderRadius: 9,
                  maxBarThickness: 64,
                },
              ],
            }}
          />
        ) : kind === 'line' ? (
          <Line
            {...canvasProps}
            options={cartesian}
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values,
                  borderColor: '#14b8a6',
                  backgroundColor: '#14b8a624',
                  fill: true,
                  tension: 0.35,
                  borderWidth: 2,
                  pointRadius: values.length > 60 ? 0 : 2.5,
                  pointHoverRadius: 6,
                  pointHitRadius: 12,
                  spanGaps: false,
                },
              ],
            }}
          />
        ) : canShowDistribution ? (
          <Doughnut
            {...canvasProps}
            options={{ ...common, cutout: '68%' }}
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values.map((value) => value ?? 0),
                  backgroundColor: labels.map((_, index) => colors[index % colors.length]),
                  borderColor: '#ffffff',
                  borderWidth: 2,
                  hoverOffset: 8,
                },
              ],
            }}
          />
        ) : (
          <p
            role="status"
            className="flex h-full items-center justify-center rounded-xl bg-surface-raised p-6 text-center text-sm leading-7 text-text-secondary"
          >
            {t('charts.noDistribution')}
          </p>
        )}
      </div>
      {kind === 'pie' && canShowDistribution && (
        <ul
          aria-label={t('charts.categories')}
          className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3"
        >
          {rows.map((row, index) => (
            <li
              key={JSON.stringify([row.label])}
              className="flex min-w-0 items-start gap-2 rounded-lg bg-surface-raised px-3 py-2 text-xs leading-6"
            >
              <span
                aria-hidden="true"
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="min-w-0 flex-1 break-words text-text-secondary" dir="auto">
                {labels[index]}
              </span>
              <span className="shrink-0 font-medium text-text-primary tabular-nums" dir="auto">
                {formatExactValue(row.value, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <details className="rounded-xl border border-border-default bg-surface-raised p-3 text-sm">
        <summary className="cursor-pointer font-medium text-text-secondary">
          {t('charts.viewValues')}
        </summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3 text-start">
                  {t('charts.category')}
                </th>
                <th scope="col" className="p-3 text-start">
                  {title}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={JSON.stringify([row.label])} className="border-t border-border-default">
                  <th scope="row" className="p-3 text-start font-normal" dir="auto">
                    {labels[index]}
                  </th>
                  <td className="p-3 text-end tabular-nums" dir="auto">
                    {row.value == null
                      ? t('dataBrowser.null')
                      : formatExactValue(row.value, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
