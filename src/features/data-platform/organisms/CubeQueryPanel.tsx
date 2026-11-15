import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'use-intl';

import {
  createCubeQueryFormSchema,
  type CubeQueryFormValues,
} from '@/features/data-platform/lib/cube-query-form-schema';
import { Button } from '@/shared/ui/atoms/button/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';
import { Radio } from '@/shared/ui/atoms/radio/radio';

import type { createCubeClient } from '@/features/data-platform/lib/cube';
import type { Query } from '@cubejs-client/core';

const WarehouseChart = lazy(() =>
  import('@/shared/components/organisms/WarehouseChart').then((module) => ({
    default: module.WarehouseChart,
  })),
);

interface Member {
  type?: string;
  name: string;
  title: string;
}
interface Props {
  client: ReturnType<typeof createCubeClient> | null;
  measures: Member[];
  dimensions: Member[];
  initialQuery?: Query | null;
  initialShowValues?: boolean;
  onShowValuesChange?: (show: boolean) => void;
  onApply?: (query: Query) => void;
  onVisualChange?: (visual: 'bar' | 'line' | 'table') => void;
}

export const CubeQueryPanel = ({
  client,
  measures,
  dimensions,
  initialQuery,
  initialShowValues = true,
  onShowValuesChange,
  onApply,
  onVisualChange,
}: Props) => {
  const t = useTranslations('cubeQuery');
  const d = useTranslations('dashboard');
  const [cube, setCube] = useState('');
  const [showValues, setShowValues] = useState(initialShowValues);
  const cubes = [...new Set([...measures, ...dimensions].map((item) => item.name.split('.')[0]))];
  const id = useId();
  const [memberSearch, setMemberSearch] = useState('');
  const [usedOnly, setUsedOnly] = useState(false);
  const [measure, setMeasure] = useState(initialQuery?.measures?.[0] ?? '');
  const [dimension, setDimension] = useState(initialQuery?.dimensions?.[0] ?? '');
  const initialTime = initialQuery?.timeDimensions?.[0];
  const initialRange =
    initialTime && 'dateRange' in initialTime && Array.isArray(initialTime.dateRange)
      ? initialTime.dateRange
      : [];
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors: formErrors },
  } = useForm<CubeQueryFormValues>({
    resolver: zodResolver(createCubeQueryFormSchema(t('validationError'))),
    defaultValues: {
      filter:
        initialQuery?.filters?.[0] && 'values' in initialQuery.filters[0]
          ? (initialQuery.filters[0].values?.[0] ?? '')
          : '',
      limit: initialQuery?.limit ?? 100,
      time: initialTime?.dimension ?? '',
      granularity:
        initialTime && 'granularity' in initialTime
          ? (initialTime.granularity ?? 'month')
          : 'month',
      from: initialRange[0] ?? '',
      to: initialRange[1] ?? '',
    },
  });
  const time = useWatch({ control, name: 'time' });
  const to = useWatch({ control, name: 'to' });
  const from = useWatch({ control, name: 'from' });
  const [visual, setVisual] = useState<'table' | 'line' | 'bar'>('table');
  const [submitted, setSubmitted] = useState<Query | null>(null);
  const query = useQuery({
    queryKey: ['cube-query', id, submitted],
    queryFn: async () => {
      if (!submitted || !client) throw new Error('No connection or query');
      const result = await client.load(submitted);
      return (result.rawData() as Record<string, unknown>[]).map((row) => ({
        id: crypto.randomUUID(),
        values: row,
      }));
    },
    enabled: submitted !== null && client !== null,
    retry: false,
    gcTime: 0,
    staleTime: 60_000,
  });
  const timeColumns =
    submitted?.timeDimensions?.flatMap((item) =>
      'granularity' in item && item.granularity ? [`${item.dimension}.${item.granularity}`] : [],
    ) ?? [];
  const columns = submitted
    ? [...(submitted.dimensions ?? []), ...timeColumns, ...(submitted.measures ?? [])]
    : [];
  const resultMeasure = submitted?.measures?.[0] ?? '';
  const labelColumn = submitted?.dimensions?.[0] ?? timeColumns[0];
  const chartRows = (query.data ?? []).map((row) => {
    const raw = row.values[resultMeasure];
    const numeric =
      (typeof raw === 'number' || typeof raw === 'string') && raw !== '' ? Number(raw) : NaN;
    const labelValue = labelColumn ? row.values[labelColumn] : resultMeasure;
    return {
      label:
        typeof labelValue === 'string' || typeof labelValue === 'number' ? String(labelValue) : '—',
      value:
        Number.isFinite(numeric) && Math.abs(numeric) <= Number.MAX_SAFE_INTEGER ? numeric : null,
    };
  });
  const renderValue = (value: unknown) =>
    value === null || value === undefined
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '—';
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-bold">
        {d('title')}
      </h3>
      <p className="text-sm text-slate-500">{d('description')}</p>
      <div className="grid min-h-[65vh] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-lg border bg-slate-100/20 p-3">
          <h4 className="font-semibold">{d('cubes')}</h4>
          <label className="block text-sm">
            {d('source')}
            <NativeSelect
              className="mt-1 w-full rounded-md border bg-white p-2"
              value={cube}
              onChange={(event) => {
                setCube(event.target.value);
                setMeasure('');
                setDimension('');
                setValue('time', '');
                setValue('filter', '');
                setSubmitted(null);
              }}
            >
              <option value="">{d('all')}</option>
              {cubes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block" htmlFor={`${id}-search`}>
            {t('memberSearch')}
          </label>
          <Input
            id={`${id}-search`}
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={usedOnly} onChange={(event) => setUsedOnly(event.target.checked)} />
            {t('usedOnly')}
          </label>
          <div className="max-h-[65vh] space-y-3 overflow-auto">
            {[...new Set([...measures, ...dimensions].map((item) => item.name.split('.')[0]))].map(
              (cubeName) => {
                const visible = (item: Member) =>
                  (!cube || cubeName === cube) &&
                  item.name.startsWith(`${cubeName}.`) &&
                  `${item.name} ${item.title}`.toLowerCase().includes(memberSearch.toLowerCase()) &&
                  (!usedOnly || [measure, dimension, time].includes(item.name));
                const cubeMeasures = measures.filter(visible);
                const cubeDimensions = dimensions.filter(visible);
                if (!cubeMeasures.length && !cubeDimensions.length) return null;
                return (
                  <details key={cubeName} open>
                    <summary
                      className="cursor-pointer rounded-md bg-zinc-300/10 p-2 font-medium text-zinc-300"
                      dir="ltr"
                    >
                      {cubeName}
                    </summary>
                    <fieldset className="mt-2 space-y-1">
                      <legend className="text-xs text-slate-500">{t('measure')}</legend>
                      {cubeMeasures.map((item) => (
                        <label
                          key={item.name}
                          className={`flex items-start gap-2 rounded-md p-2 text-sm ${measure === item.name ? 'bg-zinc-300/10' : ''}`}
                        >
                          <Radio
                            name={`${id}-measure`}
                            checked={measure === item.name}
                            onChange={() => setMeasure(item.name)}
                          />
                          <span className="min-w-0 break-all" dir="ltr">
                            # {item.title}
                            <small className="block text-slate-500">{item.name}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <fieldset className="mt-3 space-y-1">
                      <legend className="text-xs text-slate-500">{t('dimension')}</legend>
                      {cubeDimensions.map((item) => {
                        const isTime = item.type === 'time';
                        const checked = (isTime ? time : dimension) === item.name;
                        return (
                          <label
                            key={item.name}
                            className={`flex items-start gap-2 rounded-md p-2 text-sm ${checked ? 'bg-zinc-300/10' : ''}`}
                          >
                            <Checkbox
                              checked={checked}
                              onChange={() => {
                                if (isTime) setValue('time', checked ? '' : item.name);
                                else {
                                  setDimension(checked ? '' : item.name);
                                  setValue('filter', '');
                                }
                              }}
                            />
                            <span className="min-w-0 break-all" dir="ltr">
                              {isTime ? '◷' : '◇'} {item.title}
                              <small className="block text-slate-500">{item.name}</small>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  </details>
                );
              },
            )}
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button
              type="submit"
              form={`${id}-query-form`}
              disabled={!client || !measure || query.isFetching}
            >
              {onApply ? d('applyWidget') : t('run')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMeasure('');
                setDimension('');
                setValue('filter', '');
                setValue('time', '');
                setValue('from', '');
                setValue('to', '');
                setSubmitted(null);
              }}
            >
              {t('reset')}
            </Button>
            {(['table', 'line', 'bar'] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant={visual === kind ? 'default' : 'outline'}
                aria-pressed={visual === kind}
                onClick={() => {
                  setVisual(kind);
                  onVisualChange?.(kind);
                }}
              >
                {t(`visual.${kind}`)}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-lg border p-3 text-sm">
              <span className="mb-2 block font-semibold">{d('columns')}</span>
              <NativeSelect
                className="w-full rounded-md border bg-white p-2"
                value={dimension}
                onChange={(event) => {
                  setDimension(event.target.value);
                  setValue('filter', '');
                }}
              >
                <option value="">{t('none')}</option>
                {dimensions
                  .filter(
                    (item) => item.type !== 'time' && (!cube || item.name.startsWith(`${cube}.`)),
                  )
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.title}
                    </option>
                  ))}
              </NativeSelect>
            </label>
            <label className="rounded-lg border p-3 text-sm">
              <span className="mb-2 block font-semibold">{d('rows')}</span>
              <NativeSelect
                className="w-full rounded-md border bg-white p-2"
                value={measure}
                onChange={(event) => setMeasure(event.target.value)}
              >
                <option value="">{t('none')}</option>
                {measures
                  .filter((item) => !cube || item.name.startsWith(`${cube}.`))
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.title}
                    </option>
                  ))}
              </NativeSelect>
            </label>
            <section className="space-y-2 rounded-lg border p-3 text-sm">
              <h4 className="font-semibold">{d('marks')}</h4>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={showValues}
                  onChange={(event) => {
                    setShowValues(event.target.checked);
                    onShowValuesChange?.(event.target.checked);
                  }}
                />
                {d('values')}
              </label>
            </section>
            <section className="space-y-2 rounded-lg border p-3 text-sm">
              <h4 className="font-semibold">{d('suggestions')}</h4>
              <p className="text-slate-500">
                {d(time ? 'timeHint' : dimension ? 'categoryHint' : 'tableHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = time ? 'line' : dimension ? 'bar' : 'table';
                  setVisual(next);
                  onVisualChange?.(next);
                }}
              >
                {t(`visual.${time ? 'line' : dimension ? 'bar' : 'table'}`)}
              </Button>
            </section>
          </div>
          <details className="rounded-lg border p-3" open>
            <summary className="cursor-pointer font-medium">{t('filtersTitle')}</summary>
            <form
              id={`${id}-query-form`}
              className="grid gap-3 rounded-lg border bg-slate-100/10 p-3 sm:grid-cols-2"
              noValidate
              onSubmit={handleSubmit(({ filter, limit, time, granularity, from, to }) => {
                if (!client || !measure) return;
                const next: Query = {
                  measures: [measure],
                  dimensions: dimension ? [dimension] : [],
                  limit,
                  ...(time
                    ? {
                        timeDimensions: [
                          {
                            dimension: time,
                            granularity,
                            ...(from && to ? { dateRange: [from, to] } : {}),
                          },
                        ],
                      }
                    : {}),
                  ...(dimension && filter
                    ? { filters: [{ member: dimension, operator: 'equals', values: [filter] }] }
                    : {}),
                };
                if (onApply) {
                  onApply(next);
                  return;
                }
                if (JSON.stringify(next) === JSON.stringify(submitted)) void query.refetch();
                else setSubmitted(next);
              })}
            >
              <label>
                {t('filter')}
                <Input disabled={!dimension} {...register('filter')} />
              </label>
              <label>
                {t('limit')}
                <Input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  aria-invalid={!!formErrors.limit}
                  {...register('limit', { valueAsNumber: true })}
                />
                {formErrors.limit && <span role="alert">{t('validationError')}</span>}
              </label>
              <label>
                {t('timeDimension')}
                <NativeSelect
                  className="block w-full rounded-md border bg-white p-2"
                  {...register('time')}
                >
                  <option value="">{t('none')}</option>
                  {dimensions
                    .filter(
                      (item) => item.type === 'time' && (!cube || item.name.startsWith(`${cube}.`)),
                    )
                    .map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.title}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <label>
                {t('granularity')}
                <NativeSelect
                  disabled={!time}
                  className="block w-full rounded-md border bg-white p-2"
                  {...register('granularity')}
                >
                  {['day', 'week', 'month', 'quarter', 'year'].map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`units.${unit}`)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label>
                {t('from')}
                <Input
                  type="date"
                  disabled={!time}
                  required={!!to}
                  max={to || undefined}
                  aria-invalid={!!formErrors.from}
                  {...register('from')}
                />
                {formErrors.from && <span role="alert">{formErrors.from.message}</span>}
              </label>
              <label>
                {t('to')}
                <Input
                  type="date"
                  disabled={!time}
                  required={!!from}
                  min={from || undefined}
                  {...register('to')}
                />
              </label>
            </form>
          </details>
          <p className="text-sm text-slate-500">{t('note')}</p>
          {submitted && (
            <details>
              <summary>{t('json')}</summary>
              <pre dir="ltr" className="overflow-auto p-3 text-sm">
                {JSON.stringify(submitted, null, 2)}
              </pre>
            </details>
          )}
          {query.isFetching && <p role="status">{t('loading')}</p>}
          {query.isError && <p role="alert">{t('error', { message: query.error.message })}</p>}
          {!submitted && !onApply && (
            <p className="flex min-h-80 items-center justify-center rounded-lg border bg-slate-100/20 p-16 text-center text-slate-500">
              {t('start')}
            </p>
          )}
          {query.isSuccess &&
            visual !== 'table' &&
            (chartRows.some((row) => row.value !== null) ? (
              <Suspense fallback={<p role="status">{t('loading')}</p>}>
                <WarehouseChart kind={visual} title={resultMeasure} rows={chartRows} />
              </Suspense>
            ) : (
              <p>{t('chartUnavailable')}</p>
            ))}
          {query.isSuccess && (visual === 'table' || showValues) && (
            <div className="overflow-auto">
              <table className="w-full text-start text-sm">
                <caption>{t('results')}</caption>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th className="border p-2" key={column} scope="col">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.length ? (
                    query.data.map((row) => (
                      <tr key={row.id}>
                        {columns.map((column) => (
                          <td className="border p-2" key={column}>
                            {renderValue(row.values[column])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length}>{t('empty')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
