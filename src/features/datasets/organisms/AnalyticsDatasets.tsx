import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CheckCircle2,
  CircleStop,
  Copy,
  Database,
  Eye,
  FilePenLine,
  History,
  Layers3,
  Plus,
  Rocket,
} from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import {
  analyticsRequest,
  type AnalyticsResult,
  type Dataset,
  type Metric,
  type Source,
} from '@/features/datasets/api/analytics';
import {
  createCustomMetricSchema,
  createDatasetFieldsSchema,
  createDatasetFormSchema,
  type DatasetFormValues,
} from '@/features/datasets/lib/dataset-form-schema';
import { IconTooltip } from '@/shared/components/molecules/icon-tooltip';
import { Button, buttonVariants } from '@/shared/ui/atoms/button/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';

type Field = { id: string; name: string; column: string; type: 'date' | 'number' | 'string' };
export const AnalyticsDatasets = ({
  templates,
  mode = 'list',
  datasetId,
}: {
  templates: Metric[];
  mode?: 'list' | 'create' | 'edit' | 'clone';
  datasetId?: number;
}) => {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const navigate = useNavigate();
  const client = useQueryClient();
  const sources = useQuery({
    queryKey: ['analytics-sources'],
    queryFn: ({ signal }) =>
      analyticsRequest<{ tables: Source[] }>('sources/', undefined, undefined, signal),
    retry: false,
  });
  const datasets = useQuery({
    queryKey: ['analytics-drafts'],
    queryFn: ({ signal }) => analyticsRequest<Dataset[]>('datasets/', undefined, undefined, signal),
    retry: false,
  });
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DatasetFormValues>({
    resolver: zodResolver(createDatasetFormSchema(t('required'), t('invalid'))),
    defaultValues: {
      title: '',
      slug: '',
      grain: '',
      description: '',
      source: '',
      primaryKey: '',
      version: '',
      deleted: '',
      history: '',
      recordedAt: '',
      historyStart: '',
      unit: 'IRR',
      timezone: 'Asia/Tehran',
    },
  });
  const source = useWatch({ control, name: 'source' });
  const history = useWatch({ control, name: 'history' });
  const [fields, setFields] = useState<Field[]>([
    { id: 'date', name: 'date', column: '', type: 'date' },
    { id: 'amount', name: 'amount', column: '', type: 'number' },
  ]);
  const [keys, setKeys] = useState<string[]>(['income']);
  const [custom, setCustom] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [aggregation, setAggregation] = useState<Metric['aggregation']>('sum');
  const [customField, setCustomField] = useState('amount');
  const [fixedFilters, setFixedFilters] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<AnalyticsResult | null>(null);
  const loadedDataset = useRef<number | null>(null);
  const columns = sources.data?.tables.find((table) => table.name === source)?.columns ?? [];
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['analytics-drafts'] }),
      client.invalidateQueries({ queryKey: ['analytics-metadata'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async ({
      title,
      slug,
      grain,
      description,
      source,
      primaryKey,
      version,
      deleted,
      history,
      recordedAt,
      historyStart,
      unit,
      timezone,
    }: DatasetFormValues) => {
      if (!createDatasetFieldsSchema(t('required'), t('invalid')).safeParse(fields).success)
        throw new Error(t('invalid'));
      if (
        custom &&
        !createCustomMetricSchema(t('required')).safeParse({
          key: customKey,
          title: customTitle,
          description: customDescription,
        }).success
      )
        throw new Error(t('required'));
      if (new Set(fields.map((field) => field.name)).size !== fields.length)
        throw new Error(t('duplicateFields'));
      const mapping = Object.fromEntries(
        fields
          .filter((f) => f.name && f.column)
          .map(({ name, column, type }) => [name, { column, type }]),
      );
      const inclusions = Object.fromEntries(
        Object.entries(fixedFilters)
          .filter(([key, value]) => value.trim() && mapping[key]?.type === 'string')
          .map(([key, value]) => [
            key,
            value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          ]),
      );
      const allowed = ['day', 'month', 'year', ...Object.keys(mapping)];
      const metrics: Metric[] = custom
        ? [
            {
              key: customKey,
              title: customTitle,
              description: customDescription,
              aggregation,
              field: aggregation === 'count' ? '' : customField,
              filters: inclusions,
              dimensions: allowed,
            },
          ]
        : templates
            .filter((m) => keys.includes(m.key))
            .map((metric) => ({
              ...metric,
              filters: Object.fromEntries(
                [...new Set([...Object.keys(inclusions), ...Object.keys(metric.filters)])].map(
                  (key) => [
                    key,
                    inclusions[key] && metric.filters[key]
                      ? inclusions[key].filter((value) => metric.filters[key].includes(value))
                      : (metric.filters[key] ?? inclusions[key]),
                  ],
                ),
              ),
              dimensions: metric.dimensions.filter((dimension) => allowed.includes(dimension)),
            }));
      return analyticsRequest<Dataset>(
        editingDataset ? `datasets/${editingDataset.id}/` : 'datasets/',
        {
          ...(editingDataset ? { revision: editingDataset.revision } : {}),
          slug,
          title,
          grain,
          description,
          source_table: source,
          primary_key: primaryKey,
          version_column: version,
          deleted_column: deleted,
          history_table: history,
          recorded_at_column: recordedAt,
          history_start: historyStart ? new Date(historyStart).toISOString() : null,
          timezone,
          unit,
          mapping,
          metrics,
        },
        editingDataset ? 'PUT' : 'POST',
      );
    },
    onSuccess: async () => {
      await refresh();
      reset();
      setEditingDataset(null);
      await navigate({ to: '/$locale/datasets', params: { locale } });
    },
  });
  const action = useMutation({
    mutationFn: async ({
      id,
      operation,
    }: {
      id: number;
      operation: 'preview' | 'publish' | 'unpublish' | 'enable-history';
    }) => {
      if (operation === 'preview') {
        setPreview(await analyticsRequest<AnalyticsResult>(`datasets/${id}/preview/`, {}));
      } else await analyticsRequest<Dataset>(`datasets/${id}/${operation}/`, {});
    },
    onSuccess: refresh,
  });
  const loadDraft = (dataset: Dataset, clone = false) => {
    setEditingDataset(clone ? null : dataset);
    reset({
      title: dataset.title,
      slug: clone ? `${dataset.slug}-v${dataset.revision + 1}` : dataset.slug,
      grain: dataset.grain,
      description: dataset.description,
      source: dataset.source_table ?? '',
      primaryKey: dataset.primary_key ?? '',
      version: dataset.version_column ?? '',
      deleted: dataset.deleted_column ?? '',
      unit: dataset.unit,
      timezone: dataset.timezone,
      history: '',
      recordedAt: '',
      historyStart: '',
    });
    setFields(
      Object.entries(dataset.mapping)
        .map(([name, field]) => ({
          id: crypto.randomUUID(),
          name,
          column: field.column ?? '',
          type: field.type,
        }))
        .sort((a, b) => (a.name === 'date' ? -1 : b.name === 'date' ? 1 : 0)),
    );
    const first = dataset.metrics[0];
    const preset = templates.find((metric) => metric.key === first?.key);
    setFixedFilters(
      Object.fromEntries(
        Object.entries(first?.filters ?? {})
          .filter(([key]) => !preset?.filters[key])
          .map(([key, values]) => [key, values.join(', ')]),
      ),
    );
    const isCustom = !!first && !templates.some((item) => item.key === first.key);
    setCustom(isCustom);
    setKeys(dataset.metrics.map((metric) => metric.key));
    if (first) {
      setCustomKey(first.key);
      setCustomTitle(first.title);
      setCustomDescription(first.description);
      setAggregation(first.aggregation);
      setCustomField(first.field);
    }
  };
  const loadDraftRef = useRef(loadDraft);
  useEffect(() => {
    loadDraftRef.current = loadDraft;
  });
  useEffect(() => {
    if ((mode !== 'edit' && mode !== 'clone') || !datasetId || loadedDataset.current === datasetId)
      return;
    const dataset = datasets.data?.find((item) => item.id === datasetId);
    if (!dataset) return;
    loadedDataset.current = datasetId;
    const frame = window.requestAnimationFrame(() =>
      loadDraftRef.current(dataset, mode === 'clone'),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [datasetId, datasets.data, mode]);
  const columnSelect = (
    label: string,
    value: string,
    change: (value: string) => void,
    required = false,
    inputProps?: ComponentProps<'select'>,
  ) => (
    <label>
      {label}
      <NativeSelect
        {...inputProps}
        value={value}
        required={required}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">{t('selectColumn')}</option>
        {columns.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name} ({c.type})
          </option>
        ))}
      </NativeSelect>
    </label>
  );
  return (
    <div className="analytics-management analytics-datasets-page">
      {mode === 'list' && (
        <header className="analytics-datasets-hero">
          <div className="analytics-datasets-hero-icon" aria-hidden="true">
            <Layers3 />
          </div>
          <div>
            <p className="analytics-datasets-eyebrow">ClickHouse · Semantic layer</p>
            <h1>{t('manageDatasets')}</h1>
            <p>{t('mappingHelp')}</p>
          </div>
          <div className="analytics-datasets-summary" aria-label={t('manageDatasets')}>
            <span>
              <strong>{datasets.data?.length ?? 0}</strong>
              {t('total')}
            </span>
            <span>
              <strong>
                {datasets.data?.filter((dataset) => dataset.status === 'published').length ?? 0}
              </strong>
              {t('published')}
            </span>
            <span>
              <strong>
                {datasets.data?.filter((dataset) => dataset.status !== 'published').length ?? 0}
              </strong>
              {t('draft')}
            </span>
          </div>
        </header>
      )}
      {(sources.isError || datasets.isError) && (
        <p role="alert">
          {sources.error?.message ?? datasets.error?.message}
          <Button
            onClick={() => {
              void sources.refetch();
              void datasets.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </p>
      )}
      {mode === 'list' && (
        <section className="analytics-dataset-registry" aria-labelledby="dataset-registry-title">
          <div className="analytics-section-heading">
            <div>
              <span>
                <Database aria-hidden="true" />
              </span>
              <div>
                <h2 id="dataset-registry-title">{t('manageDatasets')}</h2>
                <p>{t('approvalHelp')}</p>
              </div>
            </div>
            <Link
              to="/$locale/datasets/new"
              params={{ locale }}
              className={buttonVariants({ variant: 'default' })}
            >
              <Plus aria-hidden="true" />
              {t('newDataset')}
            </Link>
          </div>
          <div className="analytics-dataset-table-wrap">
            <table className="analytics-dataset-table">
              <thead>
                <tr>
                  <th scope="col">{t('title')}</th>
                  <th scope="col">{t('source')}</th>
                  <th scope="col">
                    {t('published')} / {t('draft')}
                  </th>
                  <th scope="col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {datasets.data?.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>
                      <div className="analytics-dataset-identity">
                        <span className="analytics-dataset-icon" aria-hidden="true">
                          {dataset.status === 'published' ? <CheckCircle2 /> : <FilePenLine />}
                        </span>
                        <div>
                          <strong>{dataset.title}</strong>
                          <small>{dataset.slug}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label={t('source')}>
                      <span className="analytics-table-code">{dataset.source_table}</span>
                    </td>
                    <td data-label={`${t('published')} / ${t('draft')}`}>
                      <span className={`analytics-status-badge is-${dataset.status ?? 'draft'}`}>
                        {t(dataset.status === 'published' ? 'published' : 'draft')}
                      </span>
                      <small>v{dataset.revision}</small>
                    </td>
                    <td data-label={t('actions')}>
                      <div className="analytics-dataset-actions">
                        {dataset.status === 'draft' &&
                          !dataset.published_at &&
                          !dataset.history_table && (
                            <IconTooltip label={t('edit')}>
                              <Link
                                to="/$locale/datasets/$datasetId/edit"
                                params={{ locale, datasetId: String(dataset.id) }}
                                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                              >
                                <FilePenLine aria-hidden="true" />
                              </Link>
                            </IconTooltip>
                          )}
                        <IconTooltip label={t('newVersion')}>
                          <Link
                            to="/$locale/datasets/$datasetId/clone"
                            params={{ locale, datasetId: String(dataset.id) }}
                            className={buttonVariants({ variant: 'outline', size: 'icon' })}
                          >
                            <Copy aria-hidden="true" />
                          </Link>
                        </IconTooltip>
                        {dataset.status === 'draft' &&
                          !dataset.published_at &&
                          !dataset.history_table &&
                          !!dataset.version_column && (
                            <IconTooltip label={t('enableHistory')}>
                              <Button
                                variant="outline"
                                size="icon"
                                disabled={action.isPending}
                                onClick={() =>
                                  action.mutate({ id: dataset.id, operation: 'enable-history' })
                                }
                              >
                                <History aria-hidden="true" />
                              </Button>
                            </IconTooltip>
                          )}
                        <IconTooltip label={t('preview')}>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={action.isPending}
                            onClick={() => action.mutate({ id: dataset.id, operation: 'preview' })}
                          >
                            <Eye aria-hidden="true" />
                          </Button>
                        </IconTooltip>
                        <IconTooltip
                          label={t(dataset.status === 'published' ? 'unpublish' : 'approvePublish')}
                        >
                          <Button
                            size="icon"
                            variant={dataset.status === 'published' ? 'outline' : 'default'}
                            disabled={action.isPending}
                            onClick={() =>
                              action.mutate({
                                id: dataset.id,
                                operation: dataset.status === 'published' ? 'unpublish' : 'publish',
                              })
                            }
                          >
                            {dataset.status === 'published' ? (
                              <CircleStop aria-hidden="true" />
                            ) : (
                              <Rocket aria-hidden="true" />
                            )}
                          </Button>
                        </IconTooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!datasets.isLoading && !datasets.data?.length && (
              <div className="analytics-dataset-empty">
                <Database aria-hidden="true" />
                <strong>{t('noDatasets')}</strong>
                <p>{t('noDatasetsAdmin')}</p>
              </div>
            )}
          </div>
        </section>
      )}
      {preview && (
        <div className="analytics-preview-result" role="status">
          <h3>{t('previewResult')}</h3>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
      {action.isError && <p role="alert">{action.error.message}</p>}
      {mode !== 'list' && (
        <form
          id="dataset-editor"
          className="analytics-form analytics-dataset-editor"
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
        >
          <div className="analytics-editor-heading">
            <span aria-hidden="true">
              <FilePenLine />
            </span>
            <div>
              <p className="analytics-datasets-eyebrow">
                {editingDataset
                  ? `${editingDataset.slug} · v${editingDataset.revision}`
                  : t('draft')}
              </p>
              <h2>{t(editingDataset ? 'editDataset' : 'newDataset')}</h2>
              <p>{t('approvalHelp')}</p>
            </div>
            <Link
              to="/$locale/datasets"
              params={{ locale }}
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('manageDatasets')}
            </Link>
          </div>
          <div className="analytics-form-grid">
            <label>
              {t('title')}
              <Input maxLength={160} aria-invalid={!!errors.title} {...register('title')} />
              {errors.title && <span role="alert">{errors.title.message}</span>}
            </label>
            <label>
              {t('slug')}
              <Input
                pattern="[a-zA-Z0-9_-]+"
                maxLength={50}
                aria-invalid={!!errors.slug}
                {...register('slug')}
              />
              {errors.slug && <span role="alert">{errors.slug.message}</span>}
            </label>
            <label>
              {t('grain')}
              <Input maxLength={255} aria-invalid={!!errors.grain} {...register('grain')} />
              {errors.grain && <span role="alert">{errors.grain.message}</span>}
            </label>
            <label>
              {t('description')}
              <Input {...register('description')} />
            </label>
            <label>
              {t('source')}
              <NativeSelect
                aria-invalid={!!errors.source}
                {...register('source', {
                  onChange: () => {
                    setValue('primaryKey', '');
                    setValue('version', '');
                    setValue('deleted', '');
                    setFields((items) => items.map((f) => ({ ...f, column: '' })));
                  },
                })}
              >
                <option value="">{t('selectSource')}</option>
                {sources.data?.tables.map((table) => (
                  <option key={table.name} value={table.name}>
                    {table.name} ({table.engine})
                  </option>
                ))}
              </NativeSelect>
              {errors.source && <span role="alert">{errors.source.message}</span>}
            </label>
            <Controller
              control={control}
              name="primaryKey"
              render={({ field }) =>
                columnSelect(t('primaryKey'), field.value, field.onChange, true, {
                  name: field.name,
                  ref: field.ref,
                  onBlur: field.onBlur,
                  'aria-invalid': !!errors.primaryKey,
                })
              }
            />
            {errors.primaryKey && <span role="alert">{errors.primaryKey.message}</span>}
            <Controller
              control={control}
              name="version"
              render={({ field }) =>
                columnSelect(t('versionColumn'), field.value, field.onChange, false, {
                  name: field.name,
                  ref: field.ref,
                  onBlur: field.onBlur,
                })
              }
            />
            <Controller
              control={control}
              name="deleted"
              render={({ field }) =>
                columnSelect(t('deletedColumn'), field.value, field.onChange, false, {
                  name: field.name,
                  ref: field.ref,
                  onBlur: field.onBlur,
                })
              }
            />
            <label>
              {t('unit')}
              <Input maxLength={24} aria-invalid={!!errors.unit} {...register('unit')} />
              {errors.unit && <span role="alert">{errors.unit.message}</span>}
            </label>
            <label>
              {t('timezone')}
              <Input aria-invalid={!!errors.timezone} {...register('timezone')} />
              {errors.timezone && <span role="alert">{errors.timezone.message}</span>}
            </label>
          </div>
          <h4>{t('mapping')}</h4>
          <p>{t('mappingTypes')}</p>
          {fields.map((field, index) => (
            <div className="analytics-mapping-row" key={field.id}>
              <Input
                aria-label={t('logicalField')}
                value={field.name}
                required
                disabled={index === 0}
                pattern="[A-Za-z_][A-Za-z0-9_]*"
                onChange={(e) =>
                  setFields((items) =>
                    items.map((f, i) => (i === index ? { ...f, name: e.target.value } : f)),
                  )
                }
              />
              <NativeSelect
                aria-label={t('type')}
                value={field.type}
                disabled={index === 0}
                onChange={(e) =>
                  setFields((items) =>
                    items.map((f, i) =>
                      i === index ? { ...f, type: e.target.value as Field['type'] } : f,
                    ),
                  )
                }
              >
                <option value="date">{t('date')}</option>
                <option value="number">{t('number')}</option>
                <option value="string">{t('string')}</option>
              </NativeSelect>
              <NativeSelect
                aria-label={t('sourceColumn')}
                value={field.column}
                required
                onChange={(e) =>
                  setFields((items) =>
                    items.map((f, i) => (i === index ? { ...f, column: e.target.value } : f)),
                  )
                }
              >
                <option value="">{t('selectColumn')}</option>
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </NativeSelect>
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFields((items) => items.filter((_, i) => i !== index))}
                >
                  {t('remove')}
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setFields((items) => [
                ...items,
                { id: crypto.randomUUID(), name: '', column: '', type: 'string' },
              ])
            }
          >
            {t('addField')}
          </Button>
          <details>
            <summary>{t('historyConfiguration')}</summary>
            <p>{t('historyHelp')}</p>
            <div className="analytics-form-grid">
              <label>
                {t('historyTable')}
                <NativeSelect {...register('history')}>
                  <option value="">{t('disabled')}</option>
                  {sources.data?.tables
                    .filter((table) => table.engine === 'MergeTree')
                    .map((table) => (
                      <option key={table.name} value={table.name}>
                        {table.name}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <label>
                {t('recordedAt')}
                <NativeSelect {...register('recordedAt')}>
                  <option value="">{t('selectColumn')}</option>
                  {sources.data?.tables
                    .find((table) => table.name === history)
                    ?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <label>
                {t('historyStart')}
                <Input type="datetime-local" {...register('historyStart')} />
              </label>
            </div>
          </details>
          <h4>{t('inclusionRules')}</h4>
          <p>{t('inclusionHelp')}</p>
          <div className="analytics-form-grid">
            {fields
              .filter((field) => field.type === 'string' && field.name)
              .map((field) => (
                <label key={field.id}>
                  {field.name}
                  <Input
                    value={fixedFilters[field.name] ?? ''}
                    placeholder={t('inclusionPlaceholder')}
                    onChange={(event) =>
                      setFixedFilters((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
          </div>
          <h4>{t('metrics')}</h4>
          <label>
            <Checkbox checked={custom} onChange={(e) => setCustom(e.target.checked)} />{' '}
            {t('customMetric')}
          </label>
          {custom ? (
            <div className="analytics-form-grid">
              <label>
                {t('metricKey')}
                <Input required value={customKey} onChange={(e) => setCustomKey(e.target.value)} />
              </label>
              <label>
                {t('title')}
                <Input
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </label>
              <label>
                {t('definition')}
                <Input
                  required
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                />
              </label>
              <label>
                {t('aggregation')}
                <NativeSelect
                  value={aggregation}
                  onChange={(e) => setAggregation(e.target.value as Metric['aggregation'])}
                >
                  {(['sum', 'count', 'avg', 'min', 'max'] as const).map((a) => (
                    <option value={a} key={a}>
                      {t(a)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {aggregation !== 'count' && (
                <label>
                  {t('logicalField')}
                  <NativeSelect
                    value={customField}
                    onChange={(e) => setCustomField(e.target.value)}
                  >
                    {fields
                      .filter((f) => f.type === 'number')
                      .map((f) => (
                        <option value={f.name} key={f.name}>
                          {f.name}
                        </option>
                      ))}
                  </NativeSelect>
                </label>
              )}
            </div>
          ) : (
            <div className="analytics-template-list">
              {templates.map((metric) => (
                <label key={metric.key}>
                  <Checkbox
                    checked={keys.includes(metric.key)}
                    onChange={(e) =>
                      setKeys((items) =>
                        e.target.checked
                          ? [...items, metric.key]
                          : items.filter((key) => key !== metric.key),
                      )
                    }
                  />
                  <span>
                    {metric.title}
                    <small>{metric.description}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {save.isError && <p role="alert">{save.error.message}</p>}
          <Button disabled={save.isPending || (!custom && !keys.length)}>
            {t(save.isPending ? 'saving' : 'saveDraft')}
          </Button>
        </form>
      )}
    </div>
  );
};
