import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cubeManagementRequest } from '@/lib/cube-management';

import { CubeModelBuilder } from './CubeModelBuilder';

interface DatabaseTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; primaryKey: boolean }[];
}
export const CubeTableBrowser = () => {
  const t = useTranslations('cubeTables');
  const locale = useLocale();
  const id = useId();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const query = useQuery({
    queryKey: ['cube-management', 'tables'],
    staleTime: 30_000,
    gcTime: Infinity,
    retry: 2,
    queryFn: () => cubeManagementRequest<{ tables: DatabaseTable[] }>('tables'),
  });
  const tables = query.data?.tables ?? [];
  const filtered = tables.filter((table) =>
    `${table.schema}.${table.name}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  const current = tables.find((table) => `${table.schema}.${table.name}` === selected);
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`} className="font-bold">
        {t('title')}
      </h4>
      {query.isPending && <p role="status">{t('loading')}</p>}
      {query.isError && (
        <div className="space-y-2">
          <p role="alert">{t('error', { message: query.error.message })}</p>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      )}
      {query.isSuccess && (
        <>
          <label htmlFor={`${id}-search`}>{t('search')}</label>
          <Input
            id={`${id}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <nav
              className="max-h-[60vh] overflow-auto rounded-lg border p-2"
              aria-label={t('table')}
            >
              {[...new Set(filtered.map((table) => table.schema))].map((schema) => (
                <details key={schema} open>
                  <summary className="cursor-pointer p-2 font-medium" dir="ltr">
                    {schema}
                  </summary>
                  {filtered
                    .filter((table) => table.schema === schema)
                    .map((table) => (
                      <button
                        type="button"
                        key={table.name}
                        aria-current={selected === `${schema}.${table.name}` ? 'true' : undefined}
                        onClick={() => setSelected(`${schema}.${table.name}`)}
                        className={`block w-full rounded-md p-2 text-start text-sm break-all ${selected === `${schema}.${table.name}` ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                        dir="ltr"
                      >
                        {table.name} ({new Intl.NumberFormat(locale).format(table.columns.length)})
                      </button>
                    ))}
                </details>
              ))}
            </nav>
            <div className="min-w-0 space-y-3 rounded-lg border p-4">
              {!current && <p className="p-12 text-center text-muted-foreground">{t('choose')}</p>}
              {!filtered.length && <p>{t('empty')}</p>}
              {current && (
                <>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-start text-sm">
                      <caption dir="ltr">
                        {current.schema}.{current.name}
                      </caption>
                      <thead>
                        <tr>
                          {['column', 'type', 'primaryKey'].map((key) => (
                            <th className="border p-2" key={key} scope="col">
                              {t(key)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {current.columns.map((column) => (
                          <tr key={column.name}>
                            <td dir="ltr" className="border p-2">
                              {column.name}
                            </td>
                            <td dir="ltr" className="border p-2">
                              {column.type}
                            </td>
                            <td className="border p-2">{column.primaryKey ? t('yes') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <CubeModelBuilder
                    key={`${current.schema}.${current.name}`}
                    table={`${current.schema}.${current.name}`}
                    columns={current.columns}
                    tables={tables}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
