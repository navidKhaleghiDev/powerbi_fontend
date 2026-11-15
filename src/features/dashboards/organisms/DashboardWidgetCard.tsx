import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Pencil,
  MoreVertical,
  RefreshCw,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { loadDemoQuery, type DemoFilters } from '@/features/dashboards/lib/sales-demo';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';
import { formatSolarPeriod } from '@/shared/lib/solar-calendar';
import { Button } from '@/shared/ui/atoms/button/button';

import type { DashboardWidget } from '@/features/dashboards/lib/dashboard';

const WarehouseChart = lazy(() =>
  import('@/shared/components/organisms/WarehouseChart').then((module) => ({
    default: module.WarehouseChart,
  })),
);
interface Props {
  widget: DashboardWidget;
  filters: DemoFilters;
  selected?: boolean;
  onSelect?: () => void;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onTableWidthChange: (width: 'half' | 'full') => void;
  onMove: (offset: number) => void;
}
export const DashboardWidgetCard = ({
  widget,
  filters,
  first,
  selected,
  onSelect,
  last,
  onEdit,
  onRemove,
  onDuplicate,
  onTableWidthChange,
  onMove,
}: Props) => {
  const t = useTranslations('dashboard');
  const q = useTranslations('cubeQuery');
  const demo = useTranslations('salesDemo');
  const locale = useLocale();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const PreviousIcon = locale === 'fa' ? ArrowRight : ArrowLeft;
  const NextIcon = locale === 'fa' ? ArrowLeft : ArrowRight;
  const moveWidget = (offset: number) => {
    if (menuRef.current) menuRef.current.open = false;
    onMove(offset);
    menuRef.current?.querySelector('summary')?.focus();
  };
  useOutsideClick(
    menuRef,
    useCallback(() => {
      if (menuRef.current) menuRef.current.open = false;
    }, []),
  );
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);
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
  const result = useQuery({
    queryKey: ['dashboard-widget', 'sales-demo', filters, widget.id, widget.query],
    queryFn: async () => {
      if (!widget.query) throw new Error('No query');
      const data = await loadDemoQuery(widget.query, filters);
      return data.map((values) => ({ id: crypto.randomUUID(), values }));
    },
    enabled: !!widget.query,
    retry: false,
    staleTime: 60_000,
    gcTime: 0,
  });
  const query = widget.query;
  const measure = query?.measures?.[0] ?? '';
  const time = query?.timeDimensions?.[0];
  const label =
    (query?.dimensions?.[0] && ['day', 'month', 'year'].includes(query.dimensions[0])
      ? (filters.timeGrain ?? query.dimensions[0])
      : query?.dimensions?.[0]) ??
    (time && 'granularity' in time && time.granularity
      ? `${time.dimension}.${time.granularity}`
      : measure);
  const columns = [...new Set((result.data ?? []).flatMap((row) => Object.keys(row.values)))];
  const rows = (result.data ?? []).map(({ values: row }) => {
    const raw = row[measure];
    const original =
      typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? Number(raw) : NaN;
    const value = original;
    return {
      label:
        ['day', 'month', 'year'].includes(label) && typeof row[label] === 'string'
          ? formatSolarPeriod(String(row[label]), label, locale)
          : typeof row[label] === 'string' &&
              ['customer', 'product', 'status', 'incomeType', 'paymentTerms'].includes(label)
            ? demo(`values.${String(row[label])}`)
            : typeof row[label] === 'string' || typeof row[label] === 'number'
              ? String(row[label])
              : '—',
      value: Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : null,
    };
  });
  const valueText = (value: unknown) =>
    value == null
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '—';
  const exportCsv = () => {
    if (!result.data?.length) return;
    const csvCell = (value: unknown) => {
      let text = value == null ? '' : valueText(value);
      if (typeof value !== 'number' && /^\s*[-=+@]/u.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns.map((column) => csvCell(demo(`fields.${column}`))).join(','),
      ...result.data.map(({ values }) =>
        columns
          .map((column) => {
            const value = values[column];
            if (['day', 'month', 'year'].includes(column) && typeof value === 'string')
              return csvCell(formatSolarPeriod(value, column, locale));
            if (
              ['customer', 'product', 'status', 'incomeType', 'paymentTerms'].includes(column) &&
              typeof value === 'string'
            )
              return csvCell(demo(`values.${value}`));
            return csvCell(value);
          })
          .join(','),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-dashboard-data.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (menuRef.current) menuRef.current.open = false;
  };
  return (
    <article
      ref={setNodeRef}
      data-selected={selected || undefined}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest('button,input,select,summary,a')
        )
          onSelect?.();
      }}
      data-dragging={isDragging || undefined}
      data-drop-target={(isOver && !isDragging) || undefined}
      className={`bi-widget bi-widget-${widget.size} bi-widget-visual-${widget.visual}`}
      data-income-card={
        widget.visual === 'card' &&
        [
          'income',
          'formalIncome',
          'informalIncome',
          'cashIncome',
          'creditIncome',
          'incomeReturns',
        ].includes(measure)
          ? true
          : undefined
      }
      data-expense-card={
        widget.visual === 'card' &&
        ['expenses', 'latestExpenses', 'expenseReturns'].includes(measure)
          ? true
          : undefined
      }
      data-table-width={widget.visual === 'table' ? (widget.tableWidth ?? 'half') : undefined}
      data-chart-width={
        ['bar', 'horizontalBar', 'line', 'pie', 'radar', 'heatmap'].includes(widget.visual)
          ? widget.chartWidth
          : undefined
      }
      aria-label={widget.title}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <header className="bi-widget-heading">
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="bi-widget-drag"
          {...attributes}
          {...listeners}
          aria-label={t('dragWidget', { name: widget.title })}
          title={t('dragHint')}
        >
          <GripVertical size={15} aria-hidden="true" />
        </Button>
        <div>
          <h2>{widget.title}</h2>
        </div>
        <div className="bi-widget-actions">
          {result.isFetching && (
            <span className="bi-widget-refresh-status" role="status" aria-label={q('loading')}>
              <RefreshCw aria-hidden="true" />
            </span>
          )}
          <details ref={menuRef} className="bi-widget-menu">
            <summary aria-label={t('moreActions')} title={t('moreActions')}>
              <MoreVertical aria-hidden="true" />
            </summary>
            <div>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil />
                {t('editWidget')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!query || result.isFetching}
                onClick={() => void result.refetch()}
              >
                <RefreshCw className={result.isFetching ? 'animate-spin' : ''} />
                {t('refreshWidget')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!result.data?.length || result.isFetching}
                onClick={exportCsv}
              >
                <Download />
                {t('exportCsv')}
              </Button>
              {widget.visual === 'table' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTableWidthChange(widget.tableWidth === 'full' ? 'half' : 'full')}
                >
                  {t(widget.tableWidth === 'full' ? 'tableHalfWidth' : 'tableFullWidth')}
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={first} onClick={() => moveWidget(-1)}>
                <PreviousIcon aria-hidden="true" />
                {t('moveEarlier')}
              </Button>
              <Button variant="ghost" size="sm" disabled={last} onClick={() => moveWidget(1)}>
                <NextIcon aria-hidden="true" />
                {t('moveLater')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy />
                {t('duplicate')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 />
                {t('remove')}
              </Button>
            </div>
          </details>
        </div>
      </header>
      <div className="bi-widget-content" aria-busy={result.isFetching}>
        {!query ? (
          <Button
            variant="ghost"
            size="auto"
            type="button"
            className="bi-configure"
            onClick={onEdit}
          >
            <span className="bi-configure-icon">＋</span>
            <strong>{t('configure')}</strong>
            <span>{demo('editorHint')}</span>
          </Button>
        ) : result.isError ? (
          <div className="bi-widget-state" role="alert">
            <p>{q('error', { message: result.error.message })}</p>
            <Button variant="outline" onClick={() => void result.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : result.isPending ? (
          <p className="bi-widget-state" role="status">
            {q('loading')}
          </p>
        ) : !result.data.length ? (
          <p>{demo('unavailable')}</p>
        ) : widget.visual === 'card' ? (
          <div className="bi-kpi">
            <strong>
              {rows[0]?.value == null
                ? '—'
                : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rows[0].value)}
            </strong>
          </div>
        ) : widget.visual === 'table' ? (
          <div className="bi-table-scroll">
            <table>
              <caption className="sr-only">{widget.title}</caption>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {demo(`fields.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column}>
                        {['day', 'month', 'year'].includes(column) &&
                        typeof row.values[column] === 'string'
                          ? formatSolarPeriod(String(row.values[column]), column, locale)
                          : [
                                'customer',
                                'product',
                                'status',
                                'incomeType',
                                'paymentTerms',
                              ].includes(column)
                            ? demo(`values.${String(row.values[column])}`)
                            : typeof row.values[column] === 'number'
                              ? new Intl.NumberFormat(locale).format(row.values[column])
                              : valueText(row.values[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows.some((row) => row.value !== null) ? (
          <Suspense
            fallback={
              <p className="bi-widget-state" role="status">
                {q('loading')}
              </p>
            }
          >
            <WarehouseChart
              dashboard
              showValues={false}
              kind={widget.visual}
              title={widget.title}
              rows={rows}
              chartColor={widget.chartColor}
              categoryColors={widget.categoryColors}
            />
          </Suspense>
        ) : (
          <p>{q('chartUnavailable')}</p>
        )}
      </div>
    </article>
  );
};
