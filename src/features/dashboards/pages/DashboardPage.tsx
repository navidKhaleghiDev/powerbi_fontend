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
import { PanelsTopLeft, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import { useAssistantPage } from '@/features/assistant/lib/context';
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
import { WidgetEditorActions } from '@/features/dashboards/molecules/WidgetEditorActions';
import { AnalyticsWidgetCard } from '@/features/dashboards/organisms/AnalyticsWidgetCard';
import { DashboardChat } from '@/features/dashboards/organisms/DashboardChat';
import { KpiWidgetEditor } from '@/features/dashboards/organisms/KpiWidgetEditor';
import {
  defaultAnalyticsFilters,
  metricId,
  resolveMetric,
  type AnalyticsFilters,
  type AnalyticsMetadata,
  type AnalyticsResult,
} from '@/features/datasets/api/analytics';
import { createKpiSheet } from '@/features/kpis/api/kpi-api';
import { AppDialog } from '@/shared/components/molecules/app-dialog';
import { IconTooltip } from '@/shared/components/molecules/icon-tooltip';
import { Button, buttonVariants } from '@/shared/ui/atoms/button/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';
import { Textarea } from '@/shared/ui/atoms/textarea/textarea';
import { DialogAction } from '@/shared/ui/molecules/dialog/dialog-action';

import type {
  DashboardSheet,
  DashboardWidget,
  WidgetVisual,
} from '@/features/dashboards/lib/dashboard';

const widgetDrawerVariants = {
  initial: { opacity: 0, transform: 'translateX(-100%)' },
  animate: { opacity: 1, transform: 'translateX(0)' },
  exit: { opacity: 0, transform: 'translateX(-100%)' },
};

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
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetDescription, setSheetDescription] = useState('');
  const createSheet = useMutation({
    mutationFn: createKpiSheet,
    retry: false,
    onSuccess: (created) => {
      const sheet: DashboardSheet = {
        id: `server-sheet-${created.id}`,
        serverId: created.id,
        name: created.title,
        description: created.description ?? '',
        widgets: [],
      };
      setSheets((items) => [...items, sheet]);
      setActive(sheet.id);
      setSheetDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['kpi-sheets'] });
    },
  });
  const [active, setActive] = useState(sheets[0]?.id ?? '');
  const [revision, setRevision] = useState(saved.revision);
  const [savedContent, setSavedContent] = useState(JSON.stringify(saved.sheets));
  const [appliedFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const editWidget = (widget: DashboardWidget) => {
    setEditing(widget);
    setEditorOpen(true);
  };
  const widgets = sheets.find((sheet) => sheet.id === active)?.widgets ?? [];
  const updateWidgets = (transform: (current: DashboardWidget[]) => DashboardWidget[]) =>
    setSheets((items) =>
      items.map((sheet) =>
        sheet.id === active ? { ...sheet, widgets: transform(sheet.widgets) } : sheet,
      ),
    );
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
    editWidget({ id: crypto.randomUUID(), title: '', visual: 'card', size: 'small', query: null });
  return (
    <section className="bi-dashboard">
      <nav className="bi-toolbar" aria-label={t('titleDashboard')}>
        <div className="bi-toolbar-title">
          <strong>{t('titleDashboard')}</strong>
        </div>
        <div className="bi-toolbar-actions">
          <IconTooltip label={t('addWidget')}>
            <DialogAction variant="outline" size="icon" onOpen={newWidget}>
              <Plus aria-hidden="true" />
            </DialogAction>
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
              <DialogAction onOpen={newWidget}>{t('addWidget')}</DialogAction>
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
                    onEdit={() => editWidget(widget)}
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
                  title={sheet.description || undefined}
                  aria-description={sheet.description || undefined}
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
                  setSheetTitle(`${t('defaultSheet')} ${sheets.length + 1}`);
                  setSheetDescription('');
                  createSheet.reset();
                  setSheetDialogOpen(true);
                }}
                disabled={sheets.length >= 20 || createSheet.isPending}
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
        <DashboardChat />
      </div>
      <AppDialog
        open={sheetDialogOpen}
        className="bi-edit-dialog"
        onClose={() => {
          if (!createSheet.isPending) setSheetDialogOpen(false);
        }}
      >
        <header>
          <h2>{d('createSheet')}</h2>
        </header>
        <form
          className="analytics-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sheetTitle.trim() || createSheet.isPending) return;
            createSheet.mutate({ title: sheetTitle.trim(), description: sheetDescription.trim() });
          }}
          aria-busy={createSheet.isPending}
        >
          <Input
            label={d('sheetName')}
            value={sheetTitle}
            maxLength={100}
            required
            disabled={createSheet.isPending}
            onChange={(event) => setSheetTitle(event.target.value)}
          />
          <label>
            {d('sheetDescription')}
            <Textarea
              value={sheetDescription}
              disabled={createSheet.isPending}
              onChange={(event) => setSheetDescription(event.target.value)}
            />
          </label>
          {createSheet.isError && <p role="alert">{createSheet.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={createSheet.isPending}
              onClick={() => setSheetDialogOpen(false)}
            >
              {d('cancelSheet')}
            </Button>
            <Button type="submit" disabled={!sheetTitle.trim() || createSheet.isPending}>
              {createSheet.isPending ? t('loading') : d('createSheet')}
            </Button>
          </div>
        </form>
      </AppDialog>
      <AppDialog
        open={editorOpen}
        className="bi-edit-dialog bi-widget-drawer"
        variants={widgetDrawerVariants}
        onClose={() => setEditorOpen(false)}
        onAfterClose={() => setEditing(null)}
      >
        <div className="bi-widget-drawer-heading">
          <span className="bi-widget-drawer-icon" aria-hidden="true">
            <PanelsTopLeft size={24} />
          </span>
          <h2 className="sr-only">{t('configureWidget')}</h2>
        </div>
        {editing && (
          <DashboardWidgetEditor
            key={editing.id}
            widget={editing}
            onCancel={() => setEditorOpen(false)}
            metadata={metadata}
            visualLabel={(value) => d(`visuals.${value}`)}
            onApply={(widget) => {
              updateWidgets((items) =>
                items.some((item) => item.id === widget.id)
                  ? items.map((item) => (item.id === widget.id ? widget : item))
                  : [...items, widget],
              );
              setEditorOpen(false);
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
  onCancel,
}: {
  widget: DashboardWidget;
  metadata: AnalyticsMetadata;
  visualLabel: (value: WidgetVisual) => string;
  onApply: (widget: DashboardWidget) => void;
  onCancel: () => void;
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
      <div className="bi-widget-drawer-content">
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
      </div>
      <WidgetEditorActions onCancel={onCancel} disabled={!selected} />
    </form>
  );
};

const DashboardWidgetEditor = (props: Parameters<typeof WidgetEditor>[0]) =>
  props.widget.kpiQuery || !props.widget.query ? (
    <KpiWidgetEditor widget={props.widget} onApply={props.onApply} onCancel={props.onCancel} />
  ) : (
    <WidgetEditor {...props} />
  );
