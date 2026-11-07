import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useId, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { createCubeClient } from '@/lib/cube';
import type { Query } from '@cubejs-client/core';

const WarehouseChart = lazy(() =>
  import('./WarehouseChart').then((module) => ({ default: module.WarehouseChart })),
);

interface Member {
  type?: string;
  name: string;
  title: string;
}
interface Props {
  client: ReturnType<typeof createCubeClient>;
  measures: Member[];
  dimensions: Member[];
}

export const CubeQueryPanel = ({ client, measures, dimensions }: Props) => {
  const t = useTranslations('cubeQuery');
  const id = useId();
  const [memberSearch, setMemberSearch] = useState('');
  const [usedOnly, setUsedOnly] = useState(false);
  const [measure, setMeasure] = useState('');
  const [dimension, setDimension] = useState('');
  const [filter, setFilter] = useState('');
  const [time, setTime] = useState('');
  const [granularity, setGranularity] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visual, setVisual] = useState<'table' | 'line' | 'bar'>('table');
  const [limit, setLimit] = useState(100);
  const [submitted, setSubmitted] = useState<Query | null>(null);
  const query = useQuery({
    queryKey: ['cube-query', id, submitted],
    queryFn: async () => {
      if (!submitted) throw new Error('No query');
      const result = await client.load(submitted);
      return (result.rawData() as Record<string, unknown>[]).map((row) => ({
        id: crypto.randomUUID(),
        values: row,
      }));
    },
    enabled: submitted !== null,
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
        {t('title')}
      </h3>
      <div className="grid min-h-[65vh] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <label className="block" htmlFor={`${id}-search`}>
            {t('memberSearch')}
          </label>
          <Input
            id={`${id}-search`}
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usedOnly}
              onChange={(event) => setUsedOnly(event.target.checked)}
            />
            {t('usedOnly')}
          </label>
          <div className="max-h-[65vh] space-y-3 overflow-auto">
            {[...new Set([...measures, ...dimensions].map((item) => item.name.split('.')[0]))].map(
              (cubeName) => {
                const visible = (item: Member) =>
                  item.name.startsWith(`${cubeName}.`) &&
                  `${item.name} ${item.title}`.toLowerCase().includes(memberSearch.toLowerCase()) &&
                  (!usedOnly || [measure, dimension, time].includes(item.name));
                const cubeMeasures = measures.filter(visible);
                const cubeDimensions = dimensions.filter(visible);
                if (!cubeMeasures.length && !cubeDimensions.length) return null;
                return (
                  <details key={cubeName} open>
                    <summary
                      className="cursor-pointer rounded-md bg-primary/10 p-2 font-medium text-primary"
                      dir="ltr"
                    >
                      {cubeName}
                    </summary>
                    <fieldset className="mt-2 space-y-1">
                      <legend className="text-xs text-muted-foreground">{t('measure')}</legend>
                      {cubeMeasures.map((item) => (
                        <label
                          key={item.name}
                          className={`flex items-start gap-2 rounded-md p-2 text-sm ${measure === item.name ? 'bg-primary/10' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`${id}-measure`}
                            checked={measure === item.name}
                            onChange={() => setMeasure(item.name)}
                          />
                          <span className="min-w-0 break-all" dir="ltr">
                            # {item.title}
                            <small className="block text-muted-foreground">{item.name}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <fieldset className="mt-3 space-y-1">
                      <legend className="text-xs text-muted-foreground">{t('dimension')}</legend>
                      {cubeDimensions.map((item) => {
                        const isTime = item.type === 'time';
                        const checked = (isTime ? time : dimension) === item.name;
                        return (
                          <label
                            key={item.name}
                            className={`flex items-start gap-2 rounded-md p-2 text-sm ${checked ? 'bg-primary/10' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (isTime) setTime(checked ? '' : item.name);
                                else {
                                  setDimension(checked ? '' : item.name);
                                  setFilter('');
                                }
                              }}
                            />
                            <span className="min-w-0 break-all" dir="ltr">
                              {isTime ? '◷' : '◇'} {item.title}
                              <small className="block text-muted-foreground">{item.name}</small>
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
            <Button type="submit" form={`${id}-query-form`} disabled={!measure || query.isFetching}>
              {t('run')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMeasure('');
                setDimension('');
                setFilter('');
                setTime('');
                setFrom('');
                setTo('');
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
                onClick={() => setVisual(kind)}
              >
                {t(`visual.${kind}`)}
              </Button>
            ))}
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">{t('filtersTitle')}</summary>
            <form
              id={`${id}-query-form`}
              className="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
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
                if (JSON.stringify(next) === JSON.stringify(submitted)) void query.refetch();
                else setSubmitted(next);
              }}
            >
              <label>
                {t('filter')}
                <Input
                  disabled={!dimension}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </label>
              <label>
                {t('limit')}
                <Input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                />
              </label>
              <label>
                {t('timeDimension')}
                <select
                  className="block w-full rounded-md border bg-background p-2"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                >
                  <option value="">{t('none')}</option>
                  {dimensions
                    .filter((item) => item.type === 'time')
                    .map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t('granularity')}
                <select
                  disabled={!time}
                  className="block w-full rounded-md border bg-background p-2"
                  value={granularity}
                  onChange={(event) => setGranularity(event.target.value)}
                >
                  {['day', 'week', 'month', 'quarter', 'year'].map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`units.${unit}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('from')}
                <Input
                  type="date"
                  disabled={!time}
                  required={!!to}
                  max={to || undefined}
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                {t('to')}
                <Input
                  type="date"
                  disabled={!time}
                  required={!!from}
                  min={from || undefined}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </form>
          </details>
          <p className="text-sm text-muted-foreground">{t('note')}</p>
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
          {!submitted && (
            <p className="flex min-h-80 items-center justify-center rounded-lg border bg-muted/20 p-16 text-center text-muted-foreground">
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
          {query.isSuccess && (
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
