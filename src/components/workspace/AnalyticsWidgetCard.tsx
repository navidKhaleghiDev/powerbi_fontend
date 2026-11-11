import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { AppDialog } from '@/components/ui/app-dialog';
import { Button } from '@/components/ui/button';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { loadAnalytics, resolveMetric, type AnalyticsFilters, type Dataset } from '@/lib/analytics';
import { formatSolarPeriod } from '@/lib/solar-calendar';

import { AnalyticsRecords } from './AnalyticsRecords';

import type { DashboardWidget } from '@/lib/dashboard';

const WarehouseChart = lazy(() =>
  import('./WarehouseChart').then((module) => ({ default: module.WarehouseChart })),
);
export const AnalyticsWidgetCard = ({
  widget,
  datasets,
  filters,
  onEdit,
  onRemove,
  onDuplicate,
  onMove,
  first,
  last,
}: {
  widget: DashboardWidget;
  datasets: Dataset[];
  filters: AnalyticsFilters;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (offset: number) => void;
  first: boolean;
  last: boolean;
}) => {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const [records, setRecords] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const PreviousIcon = locale === 'fa' ? ArrowRight : ArrowLeft;
  const NextIcon = locale === 'fa' ? ArrowLeft : ArrowRight;
  const closeMenu = useCallback(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, []);
  const runMenuAction = (action: () => void) => {
    closeMenu();
    action();
  };
  useOutsideClick(menuRef, closeMenu);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        closeMenu();
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closeMenu]);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: widget.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: widget.id });
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );
  const selected = resolveMetric(datasets, widget.query?.measures?.[0] ?? '');
  const dimensions = widget.query?.dimensions ?? [];
  const result = useQuery({
    queryKey: [
      'dashboard-widget',
      'live',
      selected?.dataset.slug,
      selected?.dataset.revision,
      selected?.metric.key,
      dimensions,
      filters,
    ],
    queryFn: ({ signal }) => {
      if (!selected) throw new Error(t('unavailable'));
      return loadAnalytics(selected.dataset, selected.metric, dimensions, filters, signal);
    },
    enabled: !!selected,
    retry: false,
    staleTime: 60_000,
  });
  const data = result.data;
  const measure = widget.query?.measures?.[0] ?? '';
  const format = (value: string | number | null | undefined, key?: string) => {
    if (value == null) return '—';
    if (key && ['day', 'month', 'year'].includes(key) && filters.calendar === 'persian')
      return formatSolarPeriod(String(value), key, locale);
    // Decimal strings stay exact; do not round them through a JS number conversion.
    if (typeof value === 'number')
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
    return String(value);
  };
  const chartRows = (data?.rows ?? []).map((row) => {
    const value = row[measure] == null ? NaN : Number(row[measure]);
    return {
      label: dimensions.map((key) => format(row[key], key)).join(' / '),
      value: Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : null,
    };
  });
  const download = () => {
    if (!data) return;
    const cell = (value: string | number | null | undefined) => {
      const text = String(value ?? '');
      return `"${(/^[\s]*[-=+@]/u.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
    };
    const csv = [
      data.columns.map((c) => cell(c.key)).join(','),
      ...data.rows.map((row) => data.columns.map((c) => cell(row[c.key])).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dashboard-data.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <article
      ref={setNodeRef}
      data-dragging={isDragging || undefined}
      data-drop-target={(isOver && !isDragging) || undefined}
      data-table-width={widget.tableWidth ?? 'full'}
      className={`bi-widget bi-widget-${widget.size} bi-widget-visual-${widget.visual}`}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
    >
      <header className="bi-widget-heading">
        <Button
          {...attributes}
          {...listeners}
          variant="ghost"
          size="sm"
          aria-label={t('dragWidget')}
        >
          ⠿
        </Button>
        <div>
          <h2>{widget.title || selected?.metric.title}</h2>
          <small>
            {selected?.dataset.title} ·{' '}
            {selected?.metric.aggregation === 'count' ? '' : selected?.dataset.unit}
          </small>
        </div>
        <div className="bi-widget-actions">
          <details ref={menuRef} className="bi-widget-menu">
            <summary aria-label={t('actions')} title={t('actions')}>
              <MoreVertical aria-hidden="true" />
            </summary>
            <div className="analytics-widget-menu">
              <Button variant="ghost" size="sm" onClick={() => runMenuAction(onEdit)}>
                <Pencil aria-hidden="true" />
                {t('edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={first}
                onClick={() => runMenuAction(() => onMove(-1))}
              >
                <PreviousIcon aria-hidden="true" />
                {t('moveEarlier')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={last}
                onClick={() => runMenuAction(() => onMove(1))}
              >
                <NextIcon aria-hidden="true" />
                {t('moveLater')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => runMenuAction(onDuplicate)}>
                <Copy aria-hidden="true" />
                {t('duplicate')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!selected}
                onClick={() => runMenuAction(() => void result.refetch())}
              >
                <RefreshCw aria-hidden="true" />
                {t('refresh')}
              </Button>
              {data && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runMenuAction(() => setRecords(true))}
                  >
                    <FileText aria-hidden="true" />
                    {t('records')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => runMenuAction(download)}>
                    <Download aria-hidden="true" />
                    {t('export')}
                  </Button>
                </>
              )}
              <Button
                className="bi-widget-action-danger"
                variant="ghost"
                size="sm"
                onClick={() => runMenuAction(onRemove)}
              >
                <Trash2 aria-hidden="true" />
                {t('remove')}
              </Button>
            </div>
          </details>
        </div>
      </header>
      <div className="bi-widget-content">
        {!selected ? (
          <p>{t('unavailable')}</p>
        ) : result.isError ? (
          <div role="alert">
            <p>{result.error.message}</p>
            <Button onClick={() => void result.refetch()}>{t('retry')}</Button>
          </div>
        ) : result.isPending ? (
          <p role="status">{t('loading')}</p>
        ) : !data?.rows.length ? (
          <p>{t('empty')}</p>
        ) : widget.visual === 'card' ? (
          <div className="bi-kpi">
            <strong>{format(data.rows[0]?.[measure])}</strong>
          </div>
        ) : widget.visual === 'table' ? (
          <div className="bi-table-scroll">
            <table>
              <caption className="sr-only">{widget.title}</caption>
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th scope="col" key={c.key}>
                      {c.key === measure ? selected.metric.title : c.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={dimensions.map((d) => String(row[d])).join('|') || 'total'}>
                    {data.columns.map((c) => (
                      <td key={c.key}>{format(row[c.key], c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : chartRows.some((r) => r.value !== null) ? (
          <Suspense fallback={<p>{t('loading')}</p>}>
            <WarehouseChart
              dashboard
              kind={widget.visual}
              title={widget.title}
              rows={chartRows}
              showValues={widget.showValues ?? false}
              chartColor={widget.chartColor}
              categoryColors={widget.categoryColors}
            />
          </Suspense>
        ) : (
          <p>{t('precision')}</p>
        )}
      </div>
      {data && (
        <footer className="analytics-widget-footer">
          <small>
            {t('queriedAt', { time: new Date(data.meta.queried_at).toLocaleString(locale) })}
            {data.meta.truncated ? ` · ${t('truncated')}` : ''}
          </small>
        </footer>
      )}
      <AppDialog
        open={records}
        className="bi-edit-dialog analytics-dialog"
        onClose={() => setRecords(false)}
      >
        <header>
          <h2>{t('records')}</h2>
          <Button variant="ghost" onClick={() => setRecords(false)}>
            {t('close')}
          </Button>
        </header>
        {records && selected && (
          <AnalyticsRecords
            key={JSON.stringify([selected.dataset.slug, selected.metric.key, filters])}
            dataset={selected.dataset}
            metric={selected.metric}
            filters={filters}
          />
        )}
      </AppDialog>
    </article>
  );
};
