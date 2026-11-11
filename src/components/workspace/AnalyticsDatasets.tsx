import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  analyticsRequest,
  type AnalyticsResult,
  type Dataset,
  type Metric,
  type Source,
} from '@/lib/analytics';

type Field = { id: string; name: string; column: string; type: 'date' | 'number' | 'string' };
export const AnalyticsDatasets = ({ templates }: { templates: Metric[] }) => {
  const t = useTranslations('analytics');
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
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [grain, setGrain] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [primaryKey, setPrimaryKey] = useState('');
  const [version, setVersion] = useState('');
  const [deleted, setDeleted] = useState('');
  const [history, setHistory] = useState('');
  const [recordedAt, setRecordedAt] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [unit, setUnit] = useState('IRR');
  const [timezone, setTimezone] = useState('Asia/Tehran');
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
  const columns = sources.data?.tables.find((table) => table.name === source)?.columns ?? [];
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['analytics-drafts'] }),
      client.invalidateQueries({ queryKey: ['analytics-metadata'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async () => {
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
      setTitle('');
      setSlug('');
      setEditingDataset(null);
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
    setTitle(dataset.title);
    setSlug(clone ? `${dataset.slug}-v${dataset.revision + 1}` : dataset.slug);
    setGrain(dataset.grain);
    setDescription(dataset.description);
    setSource(dataset.source_table ?? '');
    setPrimaryKey(dataset.primary_key ?? '');
    setVersion(dataset.version_column ?? '');
    setDeleted(dataset.deleted_column ?? '');
    setUnit(dataset.unit);
    setTimezone(dataset.timezone);
    setHistory('');
    setRecordedAt('');
    setHistoryStart('');
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
  const columnSelect = (
    label: string,
    value: string,
    change: (value: string) => void,
    required = false,
  ) => (
    <label>
      {label}
      <NativeSelect value={value} required={required} onChange={(e) => change(e.target.value)}>
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
    <div className="analytics-management">
      <p>{t('mappingHelp')}</p>
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
      <div className="analytics-dataset-list">
        {datasets.data?.map((dataset) => (
          <div key={dataset.id} className="analytics-dataset-row">
            <div>
              <strong>{dataset.title}</strong>
              <small>
                {dataset.slug} · {t(dataset.status === 'published' ? 'published' : 'draft')}
              </small>
            </div>
            <div>
              {dataset.status === 'draft' && !dataset.published_at && !dataset.history_table && (
                <Button variant="outline" onClick={() => loadDraft(dataset)}>
                  {t('edit')}
                </Button>
              )}
              <Button variant="outline" onClick={() => loadDraft(dataset, true)}>
                {t('newVersion')}
              </Button>
              {dataset.status === 'draft' &&
                !dataset.published_at &&
                !dataset.history_table &&
                !!dataset.version_column && (
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: dataset.id, operation: 'enable-history' })}
                  >
                    {t('enableHistory')}
                  </Button>
                )}
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate({ id: dataset.id, operation: 'preview' })}
              >
                {t('preview')}
              </Button>
              <Button
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    id: dataset.id,
                    operation: dataset.status === 'published' ? 'unpublish' : 'publish',
                  })
                }
              >
                {t(dataset.status === 'published' ? 'unpublish' : 'approvePublish')}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {preview && (
        <div role="status">
          <h3>{t('previewResult')}</h3>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
      {action.isError && <p role="alert">{action.error.message}</p>}
      <form
        className="analytics-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3>{t(editingDataset ? 'editDataset' : 'newDataset')}</h3>
        <p>{t('approvalHelp')}</p>
        <div className="analytics-form-grid">
          <label>
            {t('title')}
            <Input
              value={title}
              required
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {t('slug')}
            <Input
              value={slug}
              required
              pattern="[a-zA-Z0-9_-]+"
              maxLength={50}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label>
            {t('grain')}
            <Input
              value={grain}
              required
              maxLength={255}
              onChange={(e) => setGrain(e.target.value)}
            />
          </label>
          <label>
            {t('description')}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            {t('source')}
            <NativeSelect
              value={source}
              required
              onChange={(e) => {
                setSource(e.target.value);
                setPrimaryKey('');
                setVersion('');
                setDeleted('');
                setFields((items) => items.map((f) => ({ ...f, column: '' })));
              }}
            >
              <option value="">{t('selectSource')}</option>
              {sources.data?.tables.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.name} ({table.engine})
                </option>
              ))}
            </NativeSelect>
          </label>
          {columnSelect(t('primaryKey'), primaryKey, setPrimaryKey, true)}
          {columnSelect(t('versionColumn'), version, setVersion)}
          {columnSelect(t('deletedColumn'), deleted, setDeleted)}
          <label>
            {t('unit')}
            <Input value={unit} required maxLength={24} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label>
            {t('timezone')}
            <Input value={timezone} required onChange={(e) => setTimezone(e.target.value)} />
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
              <NativeSelect value={history} onChange={(e) => setHistory(e.target.value)}>
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
              <NativeSelect value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)}>
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
              <Input
                type="datetime-local"
                value={historyStart}
                onChange={(e) => setHistoryStart(e.target.value)}
              />
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
                    setFixedFilters((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              </label>
            ))}
        </div>
        <h4>{t('metrics')}</h4>
        <label>
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />{' '}
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
                <NativeSelect value={customField} onChange={(e) => setCustomField(e.target.value)}>
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
                <input
                  type="checkbox"
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
    </div>
  );
};
