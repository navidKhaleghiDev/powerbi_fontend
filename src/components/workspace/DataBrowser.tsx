import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePublishedDataPreview } from '@/hooks/useWorkspace';
import { formatExactValue } from '@/lib/flows/display';
import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { Field, inputClass, Notice, secondaryClass } from './FormParts';

import type { DataFlow, WorkspaceState } from '@/lib/flows/types';

interface PublishedRowsProps {
  flow: DataFlow;
}
const PublishedRows = ({ flow }: PublishedRowsProps) => {
  const t = useTranslations('studio');
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const numericColumns = new Set(
    flow.columns
      .filter(
        (column) =>
          column.target !== flow.primaryKey &&
          ['Int64', 'Float64', 'Decimal(18,2)'].includes(column.type),
      )
      .map((column) => column.target),
  );
  const preview = usePublishedDataPreview(flow.id, flow.activeLoadId || '', page);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-slate-600">
          {t('dataBrowser.snapshot', { rows: flow.rowCount || 0 })}
        </p>
        <Button
          variant="outline"
          size="auto"
          className={secondaryClass}
          disabled={preview.isFetching}
          onClick={() => void preview.refetch()}
        >
          {t('dataBrowser.refresh')}
        </Button>
      </div>
      {preview.isPending ? (
        <LoadingSkelton isLoading className="h-64" />
      ) : preview.error ? (
        <Notice error={preview.error} />
      ) : preview.data ? (
        <>
          <p className="text-xs text-slate-500">
            {t('dataBrowser.queriedAt', {
              time: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(preview.data.queriedAt)),
            })}
          </p>
          <div
            tabIndex={0}
            role="region"
            aria-label={t('dataBrowser.title')}
            className="published-rows-scroll max-h-[36rem] overflow-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <table className="w-full text-start text-[13px]">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {preview.data.columns.map((column) => (
                    <th
                      scope="col"
                      key={column}
                      className={`px-4 py-3 font-medium whitespace-nowrap ${numericColumns.has(column) ? 'text-end' : 'text-start'}`}
                      dir={numericColumns.has(column) ? 'ltr' : 'auto'}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.data.rows.length ? (
                  preview.data.rows.map((row, index) => (
                    <tr key={String(row[flow.primaryKey] ?? index)} className="hover:bg-teal-50/50">
                      {preview.data?.columns.map((column) => (
                        <td
                          key={column}
                          className={`px-4 py-3 whitespace-nowrap ${numericColumns.has(column) ? 'text-end tabular-nums' : ''}`}
                          dir={numericColumns.has(column) ? 'ltr' : 'auto'}
                        >
                          {row[column] === null
                            ? t('dataBrowser.null')
                            : numericColumns.has(column)
                              ? formatExactValue(row[column], locale)
                              : String(row[column] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={preview.data.columns.length}
                      className="p-8 text-center text-slate-500"
                    >
                      {t('noRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="auto"
              className={secondaryClass}
              disabled={page === 0 || preview.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              {t('dataBrowser.previous')}
            </Button>
            <span className="text-[13px]">{t('dataBrowser.page', { page: page + 1 })}</span>
            <Button
              variant="outline"
              size="auto"
              className={secondaryClass}
              disabled={!preview.data.hasMore || page >= 1999 || preview.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('dataBrowser.next')}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{t('dataBrowser.limit')}</p>
        </>
      ) : null}
    </div>
  );
};
interface Props {
  state: WorkspaceState;
}
export const DataBrowser = ({ state }: Props) => {
  const t = useTranslations('studio');
  const [selectedId, setSelectedId] = useState('');
  const flows = state.flows.filter((flow) => !!flow.activeLoadId);
  const selected = flows.find((flow) => flow.id === selectedId) || flows[0];
  return (
    <Card
      role="region"
      aria-label={t('dataBrowser.title')}
      className="gap-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-base font-medium">{t('dataBrowser.title')}</h2>
        <p className="mt-2 text-[13px] leading-7 text-slate-500">{t('dataBrowser.description')}</p>
      </div>
      {!selected ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <h3 className="font-medium">{t('dataBrowser.empty')}</h3>
          <p className="mt-2 text-[13px] leading-7 text-slate-500">{t('dataBrowser.emptyHelp')}</p>
        </div>
      ) : (
        <>
          <Field label={t('dataset')}>
            <select
              className={inputClass}
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[13px] text-slate-500">
            {t('dataBrowser.grain', { grain: selected.grain })}
          </p>
          <PublishedRows key={selected.id + selected.activeLoadId} flow={selected} />
        </>
      )}
    </Card>
  );
};
