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
  RadialLinearScale,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';
import { useLocale, useTranslations } from 'use-intl';

import { formatExactValue } from '@/shared/lib/format-exact-value';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
);

const chartColors = ['#d4d4d8', '#b7b7bd', '#9c9ca3', '#808087', '#e4e4e7', '#68686f'];
const glowFrames = new WeakMap<ChartJS, number>();
const lineGlow: Plugin<'line'> = {
  id: 'dashboardLineGlow',
  afterInit(chart) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let lastFrame = 0;
    const frame = (time: number) => {
      if (!document.hidden && time - lastFrame >= 66) {
        chart.draw();
        lastFrame = time;
      }
      glowFrames.set(chart, requestAnimationFrame(frame));
    };
    glowFrames.set(chart, requestAnimationFrame(frame));
  },
  afterDatasetsDraw(chart) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const line = chart.getDatasetMeta(0).dataset;
    if (!(line instanceof LineElement)) return;
    const ctx = chart.ctx;
    ctx.save();
    const color = chart.data.datasets[0]?.borderColor;
    ctx.shadowColor = typeof color === 'string' ? color : '#d4d4d8';
    ctx.shadowBlur = 3 + 5 * (0.5 + 0.5 * Math.sin(performance.now() / 550));
    line.draw(ctx, chart.chartArea);
    ctx.restore();
  },
  afterDestroy(chart) {
    const frame = glowFrames.get(chart);
    if (frame !== undefined) cancelAnimationFrame(frame);
    glowFrames.delete(chart);
  },
};
type VisualKind = 'bar' | 'line' | 'doughnut';
interface Props {
  kind: 'bar' | 'horizontalBar' | 'line' | 'pie' | 'radar' | 'heatmap';
  title: string;
  rows: Record<string, string | number | null>[];
  showValues?: boolean;
  dashboard?: boolean;
  chartColor?: string;
  categoryColors?: string[];
}

export const WarehouseChart = ({
  kind,
  title,
  rows,
  showValues = true,
  dashboard = false,
  chartColor,
  categoryColors,
}: Props) => {
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

  const defaultColor =
    kind === 'bar' || kind === 'horizontalBar'
      ? '#d4d4d8'
      : kind === 'radar'
        ? '#b7b7bd'
        : kind === 'heatmap'
          ? '#9c9ca3'
          : '#d4d4d8';
  const primary = chartColor ?? (dashboard ? '#5279fa' : defaultColor);
  const colors =
    categoryColors ??
    (kind === 'pie' ? ['#8b65ff', '#3267ff', '#5bdab5', '#f5b75c', '#ef7197'] : chartColors);
  const rtl = locale === 'fa';
  const labels = rows.map((row) => String(row.label ?? t('allRows')));
  const values = rows.map((row) => {
    if (row.value === null || row.value === undefined || row.value === '') return null;
    const value = Number(row.value);
    return Number.isFinite(value) ? value : null;
  });
  const number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const font = { family: fontFamily, size: dashboard ? 10 : 12 };
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
        labels: { color: '#d4d4d8', padding: 20, usePointStyle: true, boxWidth: 10, font },
      },
      tooltip: {
        rtl,
        textDirection: rtl ? 'rtl' : 'ltr',
        backgroundColor: dashboard ? '#202023' : '#0f172a',
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
          color: dashboard ? '#85858f' : '#d4d4d8',
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
        grid: { color: dashboard ? 'rgba(255,255,255,0.06)' : '#3d3d42' },
        border: { display: false },
        ticks: {
          color: dashboard ? '#85858f' : '#d4d4d8',
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
  const finiteValues = values.filter((value): value is number => value !== null);
  const minimum = Math.min(...finiteValues);
  const range = Math.max(...finiteValues) - minimum || 1;

  return (
    <div className="space-y-4">
      <div
        className="workspace-chart-canvas relative h-[clamp(16rem,35dvh,25rem)] w-full min-w-0"
        dir={rtl ? 'rtl' : 'ltr'}
      >
        {kind === 'heatmap' ? (
          <div className="bi-heatmap" role="list" aria-label={title}>
            {rows.map((row, index) => {
              const value = values[index];
              const intensity = value == null ? 0 : (value - minimum) / range;
              return (
                <div
                  className="bi-heatmap-cell"
                  role="listitem"
                  key={JSON.stringify([row.label, index])}
                  style={{
                    backgroundColor:
                      value == null
                        ? '#202023'
                        : `${primary}${Math.round((0.12 + intensity * 0.55) * 255)
                            .toString(16)
                            .padStart(2, '0')}`,
                  }}
                  title={`${labels[index]}: ${formatExactValue(row.value, locale)}`}
                >
                  <span>{labels[index]}</span>
                  <strong>{formatExactValue(row.value, locale)}</strong>
                </div>
              );
            })}
          </div>
        ) : kind === 'radar' ? (
          <Radar
            {...canvasProps}
            options={{
              ...common,
              scales: {
                r: {
                  beginAtZero: true,
                  ticks: { display: false },
                  grid: { color: dashboard ? 'rgba(255,255,255,0.06)' : '#3d3d42' },
                  angleLines: { color: '#3d3d42' },
                  pointLabels: { color: '#d4d4d8', font },
                },
              },
            }}
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values,
                  borderColor: primary,
                  backgroundColor: `${primary}37`,
                  pointBackgroundColor: primary,
                  borderWidth: 2,
                  pointRadius: 3,
                },
              ],
            }}
          />
        ) : kind === 'bar' || kind === 'horizontalBar' ? (
          <Bar
            {...canvasProps}
            options={
              kind === 'horizontalBar'
                ? {
                    ...cartesian,
                    indexAxis: 'y',
                    scales: {
                      x: { ...cartesian.scales.y, position: 'bottom' },
                      y: { ...cartesian.scales.x, position: rtl ? 'right' : 'left' },
                    },
                  }
                : cartesian
            }
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values,
                  backgroundColor: `${primary}bb`,
                  hoverBackgroundColor: primary,
                  borderRadius: dashboard ? 3 : 9,
                  maxBarThickness: dashboard ? 38 : 64,
                },
              ],
            }}
          />
        ) : kind === 'line' ? (
          <Line
            {...canvasProps}
            plugins={dashboard ? [lineGlow] : []}
            options={cartesian}
            data={{
              labels,
              datasets: [
                {
                  label: title,
                  data: values,
                  borderColor: primary,
                  backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!dashboard || !chartArea) return `${primary}28`;
                    const gradient = ctx.createLinearGradient(
                      0,
                      chartArea.top,
                      0,
                      chartArea.bottom,
                    );
                    gradient.addColorStop(0, `${primary}38`);
                    gradient.addColorStop(1, `${primary}00`);
                    return gradient;
                  },
                  fill: true,
                  tension: dashboard ? 0 : 0.35,
                  borderWidth: 2,
                  pointRadius: dashboard
                    ? values.map((_, index) => (index === values.length - 1 ? 4 : 0))
                    : values.length > 60
                      ? 0
                      : 2.5,
                  pointBackgroundColor: '#171719',
                  pointBorderWidth: 2,
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
                  borderColor: 'transparent',
                  borderWidth: 0,
                  borderRadius: 7,
                  spacing: 4,
                  hoverOffset: 5,
                },
              ],
            }}
          />
        ) : (
          <p
            role="status"
            className="flex h-full items-center justify-center rounded-xl bg-slate-50 p-6 text-center text-sm leading-7 text-slate-600"
          >
            {t('charts.noDistribution')}
          </p>
        )}
        {kind === 'pie' && canShowDistribution && (
          <div className="donut-center" aria-live="polite">
            <strong>
              {number.format(values.reduce<number>((sum, value) => sum + (value ?? 0), 0))}
            </strong>
            <span>{t('allRows')}</span>
          </div>
        )}
      </div>
      {kind === 'pie' && canShowDistribution && (
        <ul aria-label={t('charts.categories')} className="donut-reference-legend">
          {rows.map((row, index) => (
            <li
              key={JSON.stringify([row.label])}
              className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6"
            >
              <span
                aria-hidden="true"
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="min-w-0 flex-1 break-words text-slate-600" dir="auto">
                {labels[index]}
              </span>
              <span className="shrink-0 font-medium text-slate-900 tabular-nums" dir="auto">
                {formatExactValue(row.value, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {showValues && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-600">
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
                  <tr key={JSON.stringify([row.label])} className="border-t border-slate-200">
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
      )}
    </div>
  );
};
