import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Database, Plus, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { AppDialog } from '@/components/ui/app-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  analyticsRequest,
  defaultAnalyticsFilters,
  metricId,
  resolveMetric,
  type AnalyticsFilters,
  type AnalyticsMetadata,
  type AnalyticsResult,
} from '@/lib/analytics';
import { useAssistantPage } from '@/lib/assistant/context';

import { AnalyticsWidgetCard } from './AnalyticsWidgetCard';
import { DashboardChat } from './DashboardChat';
import { DashboardPane } from './DashboardPane';

import type { DashboardSheet, DashboardWidget, WidgetVisual } from '@/lib/dashboard';

interface SavedDashboard {
  sheets: DashboardSheet[];
  revision: number;
}
const visuals: WidgetVisual[] = [
  'card',
  'bar',
  'horizontalBar',
  'line',
  'pie',
  'radar',
  'heatmap',
  'table',
];

export const DashboardPage = () => {
  const t = useTranslations('analytics');
  const metadata = useQuery({
    queryKey: ['analytics-metadata'],
    queryFn: ({ signal }) =>
      analyticsRequest<AnalyticsMetadata>('metadata/', undefined, undefined, signal),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: ({ signal }) =>
      analyticsRequest<SavedDashboard>('dashboard/', undefined, undefined, signal),
    retry: false,
  });
  if (metadata.isError || dashboard.isError)
    return (
      <section className="analytics-loading" role="alert">
        <h1>{t('titleDashboard')}</h1>
        <p>{metadata.error?.message ?? dashboard.error?.message}</p>
        <Button
          onClick={() => {
            void metadata.refetch();
            void dashboard.refetch();
          }}
        >
          {t('retry')}
        </Button>
      </section>
    );
  if (!metadata.data || !dashboard.data)
    return (
      <section className="analytics-loading" role="status">
        {t('loading')}
      </section>
    );
  return <LiveDashboard metadata={metadata.data} saved={dashboard.data} />;
};

const LiveDashboard = ({
  metadata,
  saved,
}: {
  metadata: AnalyticsMetadata;
  saved: SavedDashboard;
}) => {
  const t = useTranslations('analytics');
  const d = useTranslations('dashboard');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [sheets, setSheets] = useState<DashboardSheet[]>(() =>
    saved.sheets.length
      ? saved.sheets
      : [{ id: crypto.randomUUID(), name: t('defaultSheet'), widgets: [] }],
  );
  const [active, setActive] = useState(sheets[0]?.id ?? '');
  const [revision, setRevision] = useState(saved.revision);
  const [savedContent, setSavedContent] = useState(JSON.stringify(saved.sheets));
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const widgets = sheets.find((sheet) => sheet.id === active)?.widgets ?? [];
  const updateWidgets = (transform: (current: DashboardWidget[]) => DashboardWidget[]) =>
    setSheets((items) =>
      items.map((sheet) =>
        sheet.id === active ? { ...sheet, widgets: transform(sheet.widgets) } : sheet,
      ),
    );
  const changeFilter = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => analyticsRequest<SavedDashboard>('dashboard/', { sheets, revision }, 'PUT'),
    onSuccess: (value) => {
      setRevision(value.revision);
      setSavedContent(JSON.stringify(value.sheets));
      queryClient.setQueryData(['analytics-dashboard'], value);
    },
  });
  const firstWidget = widgets[0];
  const firstMetric = resolveMetric(metadata.datasets, firstWidget?.query?.measures?.[0] ?? '');
  const context = useQuery<AnalyticsResult>({
    queryKey: [
      'dashboard-widget',
      'live',
      firstMetric?.dataset.slug,
      firstMetric?.dataset.revision,
      firstMetric?.metric.key,
      firstWidget?.query?.dimensions ?? [],
      appliedFilters,
    ],
    enabled: false,
  });
  useAssistantPage({
    page: 'dashboard',
    source: 'clickhouse',
    sheet: { id: active, name: sheets.find((sheet) => sheet.id === active)?.name ?? '' },
    selectedWidgetId: firstWidget?.id ?? null,
    selectedData: {
      widgetId: firstWidget?.id ?? null,
      status: context.isError ? 'error' : context.data ? 'available' : 'unavailable',
      fetchedAt: context.data?.meta.queried_at ?? null,
      fetching: context.isFetching,
      rows: (context.data?.rows ?? [])
        .slice(0, 8)
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).filter(
              (entry): entry is [string, string | number] =>
                typeof entry[1] === 'string' || typeof entry[1] === 'number',
            ),
          ),
        ),
      truncated: (context.data?.rows.length ?? 0) > 8 || !!context.data?.meta.truncated,
    },
    filters: {
      from: appliedFilters.from,
      toExclusive: appliedFilters.to,
      calendar: appliedFilters.calendar,
      mode: appliedFilters.mode,
      knownAt: appliedFilters.knownAt,
    },
    widgets: widgets.slice(0, 15).map((widget) => ({
      id: widget.id,
      title: widget.title,
      visual: widget.visual,
      measures: widget.query?.measures ?? [],
      dimensions: widget.query?.dimensions ?? [],
    })),
  });
  const dirty = JSON.stringify(sheets) !== savedContent;
  const newWidget = () =>
    setEditing({ id: crypto.randomUUID(), title: '', visual: 'card', size: 'small', query: null });
  const used = widgets.flatMap((widget) => {
    const selected = resolveMetric(metadata.datasets, widget.query?.measures?.[0] ?? '');
    return selected ? [selected] : [];
  });
  const categoricalFields = [
    ...new Set(
      used.flatMap(({ dataset, metric }) =>
        metric.dimensions.filter((field) => dataset.mapping[field]?.type === 'string'),
      ),
    ),
  ];
  return (
    <section className="bi-dashboard">
      <nav className="bi-toolbar" aria-label={t('titleDashboard')}>
        <div className="bi-toolbar-title">
          <strong>{t('titleDashboard')}</strong>
          <span className="analytics-live-badge">{t('live')}</span>
        </div>
        <div className="bi-toolbar-actions">
          <Button variant="outline" onClick={newWidget} disabled={!metadata.datasets.length}>
            <Plus aria-hidden="true" />
            {t('addWidget')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['dashboard-widget'] })}
          >
            <RefreshCw aria-hidden="true" />
            {t('refresh')}
          </Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save aria-hidden="true" />
            {t(save.isPending ? 'saving' : 'saveDashboard')}
          </Button>
          {metadata.can_manage && (
            <Link
              to="/$locale/datasets"
              params={{ locale }}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Database aria-hidden="true" />
              {t('manageDatasets')}
            </Link>
          )}
        </div>
      </nav>
      {save.isError && (
        <p className="analytics-alert" role="alert">
          {save.error.message}{' '}
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('reload')}
          </Button>
        </p>
      )}
      <div className="bi-board-layout">
        <div className="bi-canvas-area">
          {!metadata.datasets.length ? (
            <div className="bi-empty-board">
              <h2>{t('noDatasets')}</h2>
              <p>{t(metadata.can_manage ? 'noDatasetsAdmin' : 'noDatasetsUser')}</p>
              {metadata.can_manage && (
                <Link to="/$locale/datasets" params={{ locale }} className={buttonVariants()}>
                  {t('manageDatasets')}
                </Link>
              )}
            </div>
          ) : !widgets.length ? (
            <div className="bi-empty-board">
              <h2>{t('noWidgets')}</h2>
              <Button onClick={newWidget}>{t('addWidget')}</Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active: dragged, over }) => {
                if (!over || dragged.id === over.id) return;
                updateWidgets((items) => {
                  const next = [...items];
                  const from = next.findIndex((item) => item.id === dragged.id);
                  const to = next.findIndex((item) => item.id === over.id);
                  if (from < 0 || to < 0) return items;
                  const moved = next.splice(from, 1)[0];
                  if (moved) next.splice(to, 0, moved);
                  return next;
                });
              }}
            >
              <div className="bi-widget-grid">
                {widgets.map((widget, index) => (
                  <AnalyticsWidgetCard
                    key={widget.id}
                    widget={widget}
                    datasets={metadata.datasets}
                    filters={appliedFilters}
                    first={index === 0}
                    last={index === widgets.length - 1}
                    onDuplicate={() =>
                      updateWidgets((items) => [...items, { ...widget, id: crypto.randomUUID() }])
                    }
                    onMove={(offset) =>
                      updateWidgets((items) => {
                        const next = [...items];
                        const target = index + offset;
                        if (target < 0 || target >= next.length) return items;
                        [next[index], next[target]] = [next[target], next[index]];
                        return next;
                      })
                    }
                    onEdit={() => setEditing(widget)}
                    onRemove={() =>
                      updateWidgets((items) => items.filter((item) => item.id !== widget.id))
                    }
                  />
                ))}
              </div>
            </DndContext>
          )}
          <footer className="bi-canvas-footer">
            <div className="bi-sheet-tabs" role="tablist" aria-label={t('sheets')}>
              {sheets.map((sheet) => (
                <Button
                  variant="ghost"
                  key={sheet.id}
                  role="tab"
                  aria-selected={active === sheet.id}
                  onClick={() => setActive(sheet.id)}
                >
                  {sheet.name}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const sheet = {
                  id: crypto.randomUUID(),
                  name: `${t('defaultSheet')} ${sheets.length + 1}`,
                  widgets: [],
                };
                setSheets((items) => [...items, sheet]);
                setActive(sheet.id);
              }}
              disabled={sheets.length >= 20}
            >
              {t('addSheet')}
            </Button>
            <Input
              aria-label={t('sheetName')}
              value={sheets.find((sheet) => sheet.id === active)?.name ?? ''}
              onChange={(e) =>
                setSheets((items) =>
                  items.map((sheet) =>
                    sheet.id === active ? { ...sheet, name: e.target.value } : sheet,
                  ),
                )
              }
            />
            <small>{t(dirty ? 'unsaved' : 'saved')}</small>
          </footer>
        </div>
        <DashboardPane title={d('filtersTitle')} className="analytics-filter-pane">
          <form
            className="analytics-filters"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedFilters(filters);
            }}
          >
            <label>
              {t('from')}
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => changeFilter('from', e.target.value)}
                required
              />
            </label>
            <label>
              {t('toExclusive')}
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => changeFilter('to', e.target.value)}
                required
              />
            </label>
            <label>
              {t('calendar')}
              <NativeSelect
                value={filters.calendar}
                onChange={(e) =>
                  changeFilter('calendar', e.target.value as AnalyticsFilters['calendar'])
                }
              >
                <option value="persian">{t('persian')}</option>
                <option value="gregorian">{t('gregorian')}</option>
              </NativeSelect>
            </label>
            <label>
              {t('dataView')}
              <NativeSelect
                value={filters.mode}
                onChange={(e) => changeFilter('mode', e.target.value as AnalyticsFilters['mode'])}
              >
                <option value="latest">{t('latest')}</option>
                <option value="historical">{t('historical')}</option>
              </NativeSelect>
            </label>
            {filters.mode === 'historical' && (
              <label>
                {t('knownAt')}
                <Input
                  required
                  type="datetime-local"
                  value={filters.knownAt}
                  onChange={(e) => changeFilter('knownAt', e.target.value)}
                />
              </label>
            )}
            {categoricalFields.map((field) => (
              <label key={field}>
                {field}
                <Input
                  value={filters.values[field] ?? ''}
                  placeholder={t('allValues')}
                  onChange={(e) =>
                    changeFilter('values', { ...filters.values, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <Button type="submit">{t('applyFilters')}</Button>
          </form>
          <p className="analytics-help">
            {t('timeHelp')}
            {filters.mode === 'historical' ? ` ${t('historicalHelp')}` : ''} {t('dateInputHelp')}
          </p>
        </DashboardPane>
        <DashboardChat />
      </div>
      <AppDialog open={!!editing} className="bi-edit-dialog" onClose={() => setEditing(null)}>
        <header>
          <h2>{t('configureWidget')}</h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            {t('close')}
          </Button>
        </header>
        {editing && (
          <WidgetEditor
            key={editing.id}
            widget={editing}
            metadata={metadata}
            visualLabel={(value) => d(`visuals.${value}`)}
            onApply={(widget) => {
              updateWidgets((items) =>
                items.some((item) => item.id === widget.id)
                  ? items.map((item) => (item.id === widget.id ? widget : item))
                  : [...items, widget],
              );
              setEditing(null);
            }}
          />
        )}
      </AppDialog>
    </section>
  );
};

const WidgetEditor = ({
  widget,
  metadata,
  visualLabel,
  onApply,
}: {
  widget: DashboardWidget;
  metadata: AnalyticsMetadata;
  visualLabel: (value: WidgetVisual) => string;
  onApply: (widget: DashboardWidget) => void;
}) => {
  const t = useTranslations('analytics');
  const [measure, setMeasure] = useState(widget.query?.measures?.[0] ?? '');
  const [dimension, setDimension] = useState(widget.query?.dimensions?.[0] ?? '');
  const [visual, setVisual] = useState<WidgetVisual>(widget.visual);
  const [title, setTitle] = useState(widget.title);
  const [color, setColor] = useState(widget.chartColor ?? '#0d9488');
  const [showValues, setShowValues] = useState(widget.showValues ?? false);
  const selected = resolveMetric(metadata.datasets, measure);
  return (
    <form
      className="analytics-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected) return;
        onApply({
          ...widget,
          title: title || selected.metric.title,
          chartColor: color,
          showValues,
          visual,
          size: visual === 'card' ? 'small' : visual === 'table' ? 'wide' : 'medium',
          query: {
            measures: [measure],
            dimensions: visual === 'card' || !dimension ? [] : [dimension],
          },
        });
      }}
    >
      <label>
        {t('metric')}
        <NativeSelect
          value={measure}
          required
          onChange={(e) => {
            setMeasure(e.target.value);
            setDimension('');
          }}
        >
          <option value="">{t('selectMetric')}</option>
          {metadata.datasets.map((dataset) => (
            <optgroup key={dataset.slug} label={dataset.title}>
              {dataset.metrics.map((metric) => (
                <option key={metric.key} value={metricId(dataset, metric)}>
                  {metric.title}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </label>
      <p>{selected?.metric.description}</p>
      <label>
        {t('visual')}
        <NativeSelect value={visual} onChange={(e) => setVisual(e.target.value as WidgetVisual)}>
          {visuals.map((value) => (
            <option key={value} value={value}>
              {visualLabel(value)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {visual !== 'card' && (
        <label>
          {t('groupBy')}
          <NativeSelect
            value={dimension}
            required={visual !== 'table'}
            onChange={(e) => setDimension(e.target.value)}
          >
            <option value="">{t('total')}</option>
            {selected?.metric.dimensions.map((field) => (
              <option key={field} value={field}>
                {['day', 'month', 'year'].includes(field) ? t(field) : field}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <label>
        {t('title')}
        <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        {t('chartColor')}
        <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={showValues}
          onChange={(event) => setShowValues(event.target.checked)}
        />
        {t('showValues')}
      </label>
      <Button disabled={!selected}>{t('apply')}</Button>
    </form>
  );
};
