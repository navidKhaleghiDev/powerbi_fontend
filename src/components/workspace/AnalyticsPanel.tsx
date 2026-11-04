import { Link } from '@tanstack/react-router';
import { useState, lazy, Suspense } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWarehouseWidget, useWorkspace, useWorkspaceAction } from '@/hooks/useWorkspace';
import { formatExactValue } from '@/lib/flows/display';
import { metricCatalog, metricReadiness } from '@/lib/flows/metrics';
import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { Field, Notice, buttonClass, inputClass, secondaryClass } from './FormParts';

import type {
  Aggregation,
  ChartKind,
  DataFlow,
  ReportWidget,
  SavedReport,
  MetricBinding,
  WorkspaceState,
} from '@/lib/flows/types';

const WarehouseChart = lazy(() =>
  import('./WarehouseChart').then((module) => ({ default: module.WarehouseChart })),
);
const WarehouseMap = lazy(() =>
  import('./WarehouseMap').then((module) => ({ default: module.WarehouseMap })),
);
const downloadRows = (rows: Record<string, string | number | null>[]) => {
  const columns = Object.keys(rows[0] ?? {});
  const cell = (value: string | number | null) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'warehouse-analysis.csv';
  link.click();
  URL.revokeObjectURL(url);
};
interface WidgetProps {
  widget: ReportWidget;
  onRemove: () => void;
  editable: boolean;
  binding?: MetricBinding;
  onMove: (direction: number) => void;
}
const WarehouseWidget = ({ widget, onRemove, onMove, editable, binding }: WidgetProps) => {
  const t = useTranslations('studio');
  const locale = useLocale();
  const result = useWarehouseWidget(widget);
  const rows = result.data?.rows ?? [];
  const visualTitle = t.has(`metric.catalog.${widget.title}.name`)
    ? t(`metric.catalog.${widget.title}.name`)
    : widget.title;
  return (
    <article className="glass-surface w-full min-w-0 rounded-2xl border border-border-default bg-surface-default p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-text-primary">{visualTitle}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {binding ? t('metric.approved') : t(`aggregate.${widget.aggregation}`)} ·{' '}
            {binding ? binding.currency || t('rows') : widget.measure || t('rows')}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="auto"
              className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-raised"
              aria-label={t('moveUp')}
              onClick={() => onMove(-1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="auto"
              className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-raised"
              aria-label={t('moveDown')}
              onClick={() => onMove(1)}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="auto"
              className="text-xs text-text-secondary hover:text-text-primary"
              onClick={onRemove}
            >
              {t('removeWidget')}
            </Button>
          </div>
        )}
      </header>
      {result.isPending ? (
        <LoadingSkelton isLoading className="h-64" />
      ) : result.error ? (
        <Notice error={result.error} />
      ) : !rows.length ? (
        <p className="py-16 text-center text-text-secondary">
          {t(widget.kind === 'map' ? 'gis.noCoordinates' : 'noRows')}
        </p>
      ) : widget.kind === 'map' ? (
        <Suspense fallback={<LoadingSkelton isLoading className="h-96" />}>
          <WarehouseMap rows={rows} title={visualTitle} basemap={widget.basemap} />
        </Suspense>
      ) : widget.kind === 'kpi' ? (
        <div className="border-s-2 border-brand-200 py-6 ps-5">
          <p className="text-2xl font-medium tracking-tight break-words text-text-primary tabular-nums sm:text-[2rem] xl:text-[2rem]">
            {formatExactValue(rows[0]?.value, locale)}
          </p>
          <p className="mt-3 text-sm text-text-secondary">{t('allRows')}</p>
        </div>
      ) : widget.kind === 'table' ? (
        <div className="max-h-[65dvh] overflow-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((key) => (
                  <th key={key} className="border-b p-3 text-start">
                    {key === 'label' ? widget.dimension : widget.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={JSON.stringify([row.label])}>
                  {Object.entries(row).map(([column, value]) => (
                    <td key={column} className="border-b border-border-default p-3">
                      {String(value ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Suspense fallback={<LoadingSkelton isLoading className="h-96" />}>
          <WarehouseChart kind={widget.kind} title={visualTitle} rows={rows} />
        </Suspense>
      )}
      {result.data && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3 text-xs text-text-secondary">
          <span>{t('groupLimit', { count: result.data.limit })}</span>
          <Button
            variant="ghost"
            size="auto"
            className="font-medium text-text-info"
            onClick={() => downloadRows(rows)}
            disabled={!rows.length}
          >
            {t('exportResults')}
          </Button>
        </footer>
      )}
      {binding && (
        <details className="mt-4 rounded-xl bg-surface-raised p-3 text-xs leading-6 text-text-secondary">
          <summary className="cursor-pointer font-medium">{t('metric.lineage')}</summary>
          <p className="mt-2 whitespace-pre-wrap">{binding.definition}</p>
          <p>{binding.currency}</p>
          {binding.validatedAt && (
            <p>
              {t('metric.validationEvidence', {
                actual: binding.actual || '',
                at: binding.validatedAt,
              })}
            </p>
          )}
        </details>
      )}
      {result.data?.publishedAt && (
        <p className="mt-2 text-xs text-text-secondary">
          {t('publishedAt')}{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(result.data.publishedAt))}
        </p>
      )}
    </article>
  );
};
interface WidgetFormProps {
  flows: DataFlow[];
  bindings: MetricBinding[];
  onAdd: (widget: ReportWidget) => void;
}
const WidgetForm = ({ flows, bindings, onAdd }: WidgetFormProps) => {
  const t = useTranslations('studio');
  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    formState: { errors },
  } = useForm<{
    latitudeField: string;
    longitudeField: string;
    basemap: 'none' | 'openstreetmap';
    title: string;
    bindingId: string;
    filterField: string;
    filterValue: string;
    dateField: string;
    dateFrom: string;
    dateTo: string;
    flowId: string;
    kind: ChartKind;
    dimension: string;
    measure: string;
    aggregation: Aggregation;
  }>({
    defaultValues: {
      title: '',
      latitudeField: '',
      longitudeField: '',
      basemap: 'none',
      bindingId: '',
      filterField: '',
      filterValue: '',
      dateField: '',
      dateFrom: '',
      dateTo: '',
      flowId: flows[0]?.id || '',
      kind: 'bar',
      dimension: '',
      measure: '',
      aggregation: 'count',
    },
  });
  const [flowId, aggregation, bindingId, kind] = useWatch({
    control,
    name: ['flowId', 'aggregation', 'bindingId', 'kind'],
  });
  const selected = flows.find((flow) => flow.id === flowId);
  const numericFields =
    selected?.columns.filter((column) =>
      ['Int64', 'Float64', 'Decimal(18,2)'].includes(column.type),
    ) || [];
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onAdd({
            ...values,
            bindingId: values.kind === 'map' ? '' : values.bindingId,
            id:
              globalThis.crypto?.randomUUID?.() ||
              `visual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
          });
          reset({ ...values, title: '' });
        })(event);
      }}
      className="space-y-4"
    >
      <h2 className="font-medium">{t('visualizations')}</h2>
      <Field label={t('widgetTitle')}>
        <Input className={inputClass} {...register('title', { required: true, maxLength: 100 })} />
      </Field>
      <Field label={t('dataset')}>
        <select className={inputClass} {...register('flowId', { required: true })}>
          {flows.map((flow) => (
            <option value={flow.id} key={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('metric.approvedBinding')}>
        <select className={inputClass} disabled={kind === 'map'} {...register('bindingId')}>
          <option value="">{t('metric.explorationOnly')}</option>
          {bindings
            .filter(
              (binding) =>
                binding.flowId === selected?.id &&
                binding.approvedAt &&
                binding.validatedLoadId === selected?.activeLoadId,
            )
            .map((binding) => (
              <option key={binding.id} value={binding.id}>
                {t(`metric.catalog.${binding.metricId}.name`)}
              </option>
            ))}
        </select>
      </Field>
      <Field label={t('visualType')}>
        <select className={inputClass} {...register('kind')}>
          {['bar', 'line', 'pie', 'table', 'kpi', 'map'].map((kind) => (
            <option key={kind} value={kind}>
              {t(`chart.${kind}`)}
            </option>
          ))}
        </select>
      </Field>
      {kind === 'map' && (
        <div className="space-y-4 rounded-xl border border-brand-200 bg-surface-info-subtle/50 p-4">
          <p className="text-xs leading-6 text-text-info">{t('gis.configureHelp')}</p>
          <Field
            label={t('gis.latitude')}
            error={errors.latitudeField ? t('errors.invalid') : undefined}
          >
            <select
              className={inputClass}
              {...register('latitudeField', {
                required: kind === 'map',
                validate: (value) =>
                  kind !== 'map' || numericFields.some((field) => field.target === value),
              })}
            >
              <option value="">{t('gis.selectField')}</option>
              {numericFields.map((field) => (
                <option key={field.target} value={field.target}>
                  {field.target}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('gis.longitude')}
            error={errors.longitudeField ? t('errors.invalid') : undefined}
          >
            <select
              className={inputClass}
              {...register('longitudeField', {
                required: kind === 'map',
                validate: (value) =>
                  kind !== 'map' ||
                  (value !== getValues('latitudeField') &&
                    numericFields.some((field) => field.target === value)),
              })}
            >
              <option value="">{t('gis.selectField')}</option>
              {numericFields.map((field) => (
                <option key={field.target} value={field.target}>
                  {field.target}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('gis.basemap')}>
            <select className={inputClass} {...register('basemap')}>
              <option value="none">{t('gis.offline')}</option>
              <option value="openstreetmap">OpenStreetMap</option>
            </select>
          </Field>
          <p className="text-xs leading-6 text-text-secondary">{t('gis.tilesHelp')}</p>
        </div>
      )}
      <Field label={t(kind === 'map' ? 'gis.label' : 'groupBy')}>
        <select className={inputClass} {...register('dimension')}>
          <option value="">{t('allRows')}</option>
          {selected?.columns.map((c) => (
            <option key={c.target}>{c.target}</option>
          ))}
        </select>
      </Field>
      <Field label={t('calculation')}>
        <select className={inputClass} {...register('aggregation')}>
          {['count', 'sum', 'avg'].map((value) => (
            <option key={value} value={value}>
              {t(`aggregate.${value}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('measure')}>
        <select
          className={inputClass}
          disabled={aggregation === 'count' || (!!bindingId && kind !== 'map')}
          {...register('measure', {
            required: aggregation !== 'count' && (!bindingId || kind === 'map'),
          })}
        >
          <option value="">{t('selectMeasure')}</option>
          {selected?.columns
            .filter((c) => c.type !== 'String' && c.type !== 'Date')
            .map((c) => (
              <option key={c.target}>{c.target}</option>
            ))}
        </select>
      </Field>
      <details className="rounded-xl border border-border-default p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('visualFilters')}</summary>
        <div className="mt-3 space-y-3">
          <Field label={t('filterField')}>
            <select className={inputClass} {...register('filterField')}>
              <option value="">{t('noFilter')}</option>
              {selected?.columns
                .filter((column) => column.type === 'String')
                .map((column) => (
                  <option key={column.target}>{column.target}</option>
                ))}
            </select>
          </Field>
          <Field label={t('filterValue')}>
            <Input className={inputClass} {...register('filterValue')} />
          </Field>
          <Field label={t('dateField')}>
            <select className={inputClass} {...register('dateField')}>
              <option value="">{t('noFilter')}</option>
              {selected?.columns
                .filter((column) => column.type === 'Date')
                .map((column) => (
                  <option key={column.target}>{column.target}</option>
                ))}
            </select>
          </Field>
          <Field label={t('fromDate')}>
            <Input type="date" className={inputClass} {...register('dateFrom')} />
          </Field>
          <Field label={t('toDate')}>
            <Input type="date" className={inputClass} {...register('dateTo')} />
          </Field>
        </div>
      </details>
      <Button variant="ghost" size="auto" className={`${buttonClass} w-full`}>
        {t('addVisual')}
      </Button>
      <p className="text-xs leading-6 text-text-secondary">{t('queryHelp')}</p>
    </form>
  );
};
interface Props {
  initialReportId?: string;
}
export const AnalyticsPanel = ({ initialReportId }: Props) => {
  const workspace = useWorkspace();
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  const initialReport =
    workspace.data.reports.find((report) => report.id === initialReportId) ??
    (!initialReportId && workspace.data.flows.some((flow) => flow.sampleData)
      ? workspace.data.reports[0]
      : undefined);
  return (
    <AnalyticsEditor
      key={initialReport?.id || 'new'}
      initialReport={initialReport}
      state={workspace.data}
    />
  );
};

const AnalyticsEditor = ({
  initialReport,
  state,
}: {
  initialReport?: SavedReport;
  state: WorkspaceState;
}) => {
  const t = useTranslations('studio');
  const locale = useLocale();
  const save = useWorkspaceAction<SavedReport>();
  const [widgets, setWidgets] = useState<ReportWidget[]>(() => initialReport?.widgets || []);
  const [reportId, setReportId] = useState<string | undefined>(initialReport?.id);
  const { register, handleSubmit, setValue } = useForm<{ name: string }>({
    defaultValues: { name: initialReport?.name || '' },
  });
  const selectedReport = state.reports.find((report) => report.id === reportId);
  const editable = !selectedReport;
  const visibleWidgets =
    !editable && selectedReport?.publishedWidgets ? selectedReport.publishedWidgets : widgets;
  const mockReport =
    !!selectedReport &&
    state.flows.some(
      (flow) =>
        flow.sampleData && selectedReport.widgets.some((widget) => widget.flowId === flow.id),
    );
  const degraded =
    !mockReport &&
    selectedReport?.publishedAt &&
    selectedReport.publishedWidgets?.some((widget) => {
      const binding = state.bindings.find((item) => item.id === widget.bindingId);
      const spec = metricCatalog.find((item) => item.id === binding?.metricId);
      return !spec || metricReadiness(spec, binding, state.flows) !== 'ready';
    });
  const flows = state.flows.filter((flow) => !!flow.activeLoadId);
  const move = (id: string, direction: number) =>
    setWidgets((current) => {
      const items = [...current];
      const from = items.findIndex((w) => w.id === id);
      const to = from + direction;
      if (to < 0 || to >= items.length) return current;
      [items[from], items[to]] = [items[to], items[from]];
      return items;
    });
  return (
    <div className="w-full min-w-0 space-y-5">
      {selectedReport && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${degraded ? 'bg-surface-warning-subtle text-text-warning' : 'bg-surface-raised text-text-secondary'}`}
        >
          {t(
            degraded
              ? 'reportDegraded'
              : mockReport
                ? 'sampleDataBadge'
                : selectedReport.publishedAt
                  ? 'reportPublished'
                  : 'reportDraft',
          )}
        </p>
      )}
      <section id="analytics-content" aria-label={t('metric.reportEditor')}>
        {!flows.length ? (
          <div className="glass-surface rounded-2xl border border-dashed border-border-default bg-surface-default p-12 text-center">
            <h2 className="text-base font-medium">{t('noPublishedData')}</h2>
            <p className="mx-auto my-4 max-w-lg text-sm leading-7 text-text-secondary">
              {t('design.noPublishedDataHelp')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-[calc(100dvh-18rem)] w-full min-w-0 flex-col gap-4">
            <details className="rounded-2xl bg-slate-900 p-4 text-white">
              <summary className="cursor-pointer text-sm font-medium">
                {t('reports')} · {state.reports.length}
              </summary>
              <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                <div>
                  <h2 className="mb-4 text-xs font-medium tracking-wider text-text-secondary uppercase">
                    {t('reports')}
                  </h2>
                  <Button
                    variant="ghost"
                    size="auto"
                    className="mb-4 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
                    onClick={() => {
                      setReportId(undefined);
                      setWidgets([]);
                      setValue('name', '');
                    }}
                  >
                    {t('newReport')}
                  </Button>
                  {state.reports.map((report) => (
                    <Button
                      variant="ghost"
                      size="auto"
                      key={report.id}
                      aria-pressed={report.id === reportId}
                      className={`mb-2 w-full rounded-lg px-3 py-2 text-start text-sm break-words ${report.id === reportId ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
                      onClick={() => {
                        setReportId(report.id);
                        setWidgets(report.widgets);
                        setValue('name', report.name);
                      }}
                    >
                      {report.name}
                    </Button>
                  ))}
                </div>
                <div>
                  <h2 className="mb-3 text-xs font-medium tracking-wider text-text-secondary uppercase">
                    {t('publishedDatasets')}
                  </h2>
                  {flows.map((flow) => (
                    <div key={flow.id} className="mb-3 rounded-lg border border-slate-700 p-3">
                      <p className="text-sm font-medium">{flow.name}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {t('publishedRows', { count: flow.rowCount ?? 0 })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
            {editable && (
              <details className="glass-surface rounded-2xl border border-border-default bg-surface-default p-5">
                <summary className="cursor-pointer text-sm font-medium text-text-primary">
                  {t('visualizations')}
                </summary>
                <div className="mt-5">
                  <WidgetForm
                    flows={flows}
                    bindings={state.bindings}
                    onAdd={(widget) =>
                      setWidgets((current) =>
                        current.length < 12 ? [...current, widget] : current,
                      )
                    }
                  />
                </div>
              </details>
            )}
            <section className="w-full min-w-0 rounded-2xl border border-border-default bg-surface-raised p-4 sm:p-5">
              {editable ? (
                <form
                  className="mb-5 flex flex-wrap items-end gap-3"
                  onSubmit={handleSubmit(({ name }) =>
                    save.mutate(
                      { path: 'reports', body: { id: reportId, name, widgets } },
                      { onSuccess: (report) => setReportId(report.id) },
                    ),
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <Field label={t('reportName')}>
                      <Input
                        className={inputClass}
                        {...register('name', { required: true, maxLength: 100 })}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="default"
                    size="auto"
                    className={buttonClass}
                    disabled={save.isPending || !widgets.length || !editable}
                  >
                    {t('saveReport')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="auto"
                    type="button"
                    className={secondaryClass}
                    disabled={!reportId || save.isPending || !editable}
                    onClick={() => save.mutate({ path: `reports/${reportId}/publish`, body: {} })}
                  >
                    {t('publishReport')}
                  </Button>
                </form>
              ) : (
                <h2 className="mb-5 text-base font-medium text-text-primary">
                  {selectedReport?.name || t('reports')}
                </h2>
              )}
              <Notice error={save.error} success={save.isSuccess} />
              <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                {visibleWidgets.map((widget) => (
                  <WarehouseWidget
                    key={widget.id}
                    widget={widget}
                    editable={editable}
                    binding={state.bindings.find((binding) => binding.id === widget.bindingId)}
                    onRemove={() => setWidgets((items) => items.filter((w) => w.id !== widget.id))}
                    onMove={(direction) => move(widget.id, direction)}
                  />
                ))}
              </div>
              {!visibleWidgets.length && (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-default p-8 text-center">
                  <p className="text-base font-medium text-text-primary">
                    {t('experience.canvasTitle')}
                  </p>
                  <p className="mt-3 max-w-md text-sm leading-7 text-text-secondary">
                    {t(editable ? 'emptyCanvas' : 'experience.selectReport')}
                  </p>
                  {editable && (
                    <Button asChild variant="outline" className={`${secondaryClass} mt-5`}>
                      <Link to="/$locale/analytics/kpis" params={{ locale }}>
                        {t('metric.chooseKpis')}
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
};
