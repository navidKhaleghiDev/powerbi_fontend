import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Database, Plus, RefreshCw, Save, Trash2, Workflow } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import { useAssistantPage } from '@/features/assistant/lib/context';
import {
  createAnalyticsFilterSchema,
  type AnalyticsFilterValues,
} from '@/features/dashboards/lib/analytics-filter-schema';
import {
  loadSampleAnalytics,
  readSampleDashboard,
  sampleAnalyticsMetadata,
  saveSampleDashboard,
  type SampleDashboard,
} from '@/features/dashboards/lib/dashboard-demo';
import {
  createWidgetFormSchema,
  type WidgetFormValues,
} from '@/features/dashboards/lib/widget-form-schema';
import { DashboardPane } from '@/features/dashboards/molecules/DashboardPane';
import { AnalyticsWidgetCard } from '@/features/dashboards/organisms/AnalyticsWidgetCard';
import { DashboardChat } from '@/features/dashboards/organisms/DashboardChat';
import {
  defaultAnalyticsFilters,
  metricId,
  resolveMetric,
  type AnalyticsFilters,
  type AnalyticsMetadata,
  type AnalyticsResult,
} from '@/features/datasets/api/analytics';
import { LiveKpiOverview } from '@/features/kpis/organisms/LiveKpiOverview';
import { AppDialog } from '@/shared/components/molecules/app-dialog';
import { IconTooltip } from '@/shared/components/molecules/icon-tooltip';
import { Button, buttonVariants } from '@/shared/ui/atoms/button/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';

import type {
  DashboardSheet,
  DashboardWidget,
  WidgetVisual,
} from '@/features/dashboards/lib/dashboard';

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
    queryFn: () => Promise.resolve(sampleAnalyticsMetadata),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => Promise.resolve(readSampleDashboard()),
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
  saved: SampleDashboard;
}) => {
  const t = useTranslations('analytics');
  const d = useTranslations('dashboard');
  const studio = useTranslations('studio');
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
  const {
    control: filterControl,
    setValue: setFilterValue,
    handleSubmit: handleFiltersSubmit,
    formState: { errors: filterErrors },
  } = useForm<AnalyticsFilterValues>({
    resolver: zodResolver(createAnalyticsFilterSchema(t('required'))),
    defaultValues: defaultAnalyticsFilters(),
  });
  const filters = useWatch({ control: filterControl }) as AnalyticsFilters;
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const widgets = sheets.find((sheet) => sheet.id === active)?.widgets ?? [];
  const updateWidgets = (transform: (current: DashboardWidget[]) => DashboardWidget[]) =>
    setSheets((items) =>
      items.map((sheet) =>
        sheet.id === active ? { ...sheet, widgets: transform(sheet.widgets) } : sheet,
      ),
    );
  const changeFilter = (
    key: keyof AnalyticsFilters,
    value: string | AnalyticsFilters['values'],
  ) => {
    if (key === 'values') setFilterValue('values', value as AnalyticsFilters['values']);
    else if (key === 'calendar') setFilterValue('calendar', value as AnalyticsFilters['calendar']);
    else if (key === 'mode') setFilterValue('mode', value as AnalyticsFilters['mode']);
    else setFilterValue(key, value as string, { shouldValidate: true });
  };
  const save = useMutation({
    mutationFn: () => Promise.resolve(saveSampleDashboard(sheets, revision)),
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
    queryFn: ({ signal }) => {
      if (!firstMetric || !firstWidget) throw new Error(t('unavailable'));
      return loadSampleAnalytics(
        firstMetric.dataset,
        firstMetric.metric,
        firstWidget.query?.dimensions ?? [],
        appliedFilters,
        signal,
      );
    },
    enabled: false,
    retry: false,
  });
  useAssistantPage({
    page: 'dashboard',
    source: 'synthetic',
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
          <span className="bi-sample-badge">{d('sampleBadge')}</span>
        </div>
        <div className="bi-toolbar-actions">
          <IconTooltip label={studio('cdcConnections')}>
            <Link
              to="/$locale/cdc-connections"
              params={{ locale }}
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
            >
              <Workflow aria-hidden="true" />
            </Link>
          </IconTooltip>
          <IconTooltip label={t('addWidget')}>
            <Button
              variant="outline"
              size="icon"
              onClick={newWidget}
              disabled={!metadata.datasets.length}
            >
              <Plus aria-hidden="true" />
            </Button>
          </IconTooltip>
          <IconTooltip label={t('refresh')}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['dashboard-widget'] })}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </IconTooltip>
          <IconTooltip label={t(save.isPending ? 'saving' : 'saveDashboard')}>
            <Button size="icon" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              <Save aria-hidden="true" />
            </Button>
          </IconTooltip>
          {metadata.can_manage && (
            <IconTooltip label={t('manageDatasets')}>
              <Link
                to="/$locale/datasets"
                params={{ locale }}
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
              >
                <Database aria-hidden="true" />
              </Link>
            </IconTooltip>
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
      <LiveKpiOverview />
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
            <IconTooltip label={t('addSheet')}>
              <Button
                variant="ghost"
                size="icon"
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
                <Plus aria-hidden="true" />
              </Button>
            </IconTooltip>
            <IconTooltip label={t('deleteSheet')}>
              <Button
                variant="ghost"
                size="icon"
                className="bi-delete-sheet"
                disabled={sheets.length <= 1}
                onClick={() => {
                  const current = sheets.find((sheet) => sheet.id === active);
                  if (!current || sheets.length <= 1) return;
                  // eslint-disable-next-line no-alert
                  if (!window.confirm(t('confirmDeleteSheet', { name: current.name }))) return;
                  const remaining = sheets.filter((sheet) => sheet.id !== active);
                  setSheets(remaining);
                  setActive(remaining[0].id);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </IconTooltip>
            <small>{t(dirty ? 'unsaved' : 'saved')}</small>
          </footer>
        </div>
        <DashboardPane title={d('filtersTitle')} className="analytics-filter-pane" defaultCollapsed>
          <form
            className="analytics-filters"
            noValidate
            onSubmit={handleFiltersSubmit(setAppliedFilters)}
          >
            <label>
              {t('from')}
              <Input
                type="date"
                aria-invalid={!!filterErrors.from}
                value={filters.from}
                onChange={(e) => changeFilter('from', e.target.value)}
                required
              />
              {filterErrors.from && <span role="alert">{filterErrors.from.message}</span>}
            </label>
            <label>
              {t('toExclusive')}
              <Input
                type="date"
                aria-invalid={!!filterErrors.to}
                value={filters.to}
                onChange={(e) => changeFilter('to', e.target.value)}
                required
              />
              {filterErrors.to && <span role="alert">{filterErrors.to.message}</span>}
            </label>
            <label>
              {t('calendar')}
              <NativeSelect
                value={filters.calendar}
                onChange={(e) => changeFilter('calendar', e.target.value)}
              >
                <option value="persian">{t('persian')}</option>
                <option value="gregorian">{t('gregorian')}</option>
              </NativeSelect>
            </label>
            <label>
              {t('dataView')}
              <NativeSelect
                value={filters.mode}
                onChange={(e) => changeFilter('mode', e.target.value)}
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
                  aria-invalid={!!filterErrors.knownAt}
                  value={filters.knownAt}
                  onChange={(e) => changeFilter('knownAt', e.target.value)}
                />
                {filterErrors.knownAt && <span role="alert">{filterErrors.knownAt.message}</span>}
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
            <p className="analytics-help">
              {t('timeHelp')}
              {filters.mode === 'historical' ? ` ${t('historicalHelp')}` : ''} {t('dateInputHelp')}
            </p>
            <Button type="submit">{t('applyFilters')}</Button>
          </form>
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
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<WidgetFormValues>({
    resolver: zodResolver(createWidgetFormSchema(t('required'), t('invalid'))),
    defaultValues: {
      measure: widget.query?.measures?.[0] ?? '',
      dimension: widget.query?.dimensions?.[0] ?? '',
      visual: widget.visual,
      title: widget.title,
      color: widget.chartColor ?? '#d4d4d8',
      showValues: widget.showValues ?? false,
    },
  });
  const measure = useWatch({ control, name: 'measure' });
  const visual = useWatch({ control, name: 'visual' });
  const selected = resolveMetric(metadata.datasets, measure);
  return (
    <form
      className="analytics-form"
      noValidate
      onSubmit={handleSubmit(({ measure, dimension, visual, title, color, showValues }) => {
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
      })}
    >
      <label>
        {t('metric')}
        <NativeSelect
          aria-invalid={!!errors.measure}
          {...register('measure', { onChange: () => setValue('dimension', '') })}
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
        {errors.measure && <span role="alert">{errors.measure.message}</span>}
      </label>
      <p>{selected?.metric.description}</p>
      <label>
        {t('visual')}
        <NativeSelect {...register('visual')}>
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
          <NativeSelect aria-invalid={!!errors.dimension} {...register('dimension')}>
            <option value="">{t('total')}</option>
            {selected?.metric.dimensions.map((field) => (
              <option key={field} value={field}>
                {['day', 'month', 'year'].includes(field) ? t(field) : field}
              </option>
            ))}
          </NativeSelect>
          {errors.dimension && <span role="alert">{errors.dimension.message}</span>}
        </label>
      )}
      <label>
        {t('title')}
        <Input maxLength={160} aria-invalid={!!errors.title} {...register('title')} />
        {errors.title && <span role="alert">{errors.title.message}</span>}
      </label>
      <label>
        {t('chartColor')}
        <Input type="color" aria-invalid={!!errors.color} {...register('color')} />
        {errors.color && <span role="alert">{errors.color.message}</span>}
      </label>
      <label>
        <Checkbox {...register('showValues')} />
        {t('showValues')}
      </label>
      <Button disabled={!selected}>{t('apply')}</Button>
    </form>
  );
};
