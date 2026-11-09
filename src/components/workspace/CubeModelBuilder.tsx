import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { stringify } from 'yaml';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cubeManagementRequest } from '@/lib/cube-management';

import { CubeRelationships, type ModelRelationship, type ModelTable } from './CubeRelationships';

interface Props {
  tables: ModelTable[];
  table: string;
  columns: { name: string; type: string; primaryKey: boolean }[];
}
interface Measure {
  id: number;
  name: string;
  type: string;
  sql: string;
}
const types = ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'] as const;
const identifier = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const quoteColumn = (name: string) => `"${name.replaceAll('"', '""')}"`;

export const CubeModelBuilder = ({ table, columns, tables }: Props) => {
  const t = useTranslations('cubeBuilder');
  const client = useQueryClient();
  const relationsT = useTranslations('cubeRelationships');
  const [relationships, setRelationships] = useState<ModelRelationship[]>([]);
  const [primaryKey, setPrimaryKey] = useState(
    columns.filter((column) => column.primaryKey).length === 1
      ? (columns.find((column) => column.primaryKey)?.name ?? '')
      : '',
  );
  const [name, setName] = useState(table.split('.').at(-1) ?? '');
  const [measures, setMeasures] = useState<Measure[]>([
    { id: 0, name: 'count', type: 'count', sql: '' },
  ]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [nextId, setNextId] = useState(1);
  const model = {
    name,
    table,
    measures: measures.map((measure) => ({
      name: measure.name,
      type: measure.type,
      ...(measure.type === 'count' ? {} : { sql: quoteColumn(measure.sql) }),
    })),
    dimensions: dimensions.map((column) => ({
      name: column,
      type: 'string',
      sql: quoteColumn(column),
    })),
  };
  const names = [...model.measures, ...model.dimensions].map((member) => member.name.toLowerCase());
  const valid =
    identifier.test(name) &&
    measures.length > 0 &&
    measures.length <= 100 &&
    dimensions.length <= 100 &&
    [...model.measures, ...model.dimensions].every((member) => identifier.test(member.name)) &&
    new Set(names).size === names.length &&
    measures.every(
      (measure) =>
        measure.type === 'count' || columns.some((column) => column.name === measure.sql),
    );
  const dimensionType = (type: string) =>
    /bool/i.test(type)
      ? 'boolean'
      : /date|time/i.test(type)
        ? 'time'
        : /int|numeric|decimal|float|double|real/i.test(type)
          ? 'number'
          : 'string';
  const relatedTables = relationships.map((join) =>
    tables.find((entry) => `${entry.schema}.${entry.name}` === join.table),
  );
  const joinsValid =
    relationships.length === 0 ||
    (columns.some((column) => column.name === primaryKey && identifier.test(column.name)) &&
      !measures.some((measure) => measure.name.toLowerCase() === primaryKey.toLowerCase()) &&
      new Set([name.toLowerCase(), ...relationships.map((join) => join.cube.toLowerCase())])
        .size ===
        relationships.length + 1 &&
      relationships.every(
        (join, index) =>
          identifier.test(join.cube) &&
          columns.some((column) => column.name === join.source) &&
          relatedTables[index]?.columns.some((column) => column.name === join.target) &&
          relatedTables[index]?.columns.filter((column) => column.primaryKey).length === 1 &&
          relatedTables[index]?.columns.every((column) => identifier.test(column.name)),
      ));
  const yaml = stringify({
    cubes: [
      {
        name: model.name,
        sql_table: model.table,
        measures: model.measures.map((measure) => ({
          ...measure,
          ...(measure.sql && relationships.length ? { sql: `{CUBE}.${measure.sql}` } : {}),
        })),
        dimensions: relationships.length
          ? [
              {
                name: primaryKey,
                type: dimensionType(
                  columns.find((column) => column.name === primaryKey)?.type ?? '',
                ),
                sql: `{CUBE}.${quoteColumn(primaryKey)}`,
                primary_key: true,
              },
              ...model.dimensions
                .filter((dimension) => dimension.name !== primaryKey)
                .map((dimension) => ({ ...dimension, sql: `{CUBE}.${dimension.sql}` })),
            ]
          : model.dimensions,
        ...(relationships.length
          ? {
              joins: relationships.map((join) => ({
                name: join.cube,
                relationship: join.relationship,
                sql: `{CUBE}.${quoteColumn(join.source)} = {${join.cube}}.${quoteColumn(join.target)}`,
              })),
            }
          : {}),
      },
      ...relationships.map((join, index) => ({
        name: join.cube,
        sql_table: join.table,
        dimensions:
          relatedTables[index]?.columns.map((column) => ({
            name: column.name,
            type: dimensionType(column.type),
            sql: `{CUBE}.${quoteColumn(column.name)}`,
            ...(column.primaryKey ? { primary_key: true } : {}),
          })) ?? [],
      })),
    ],
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/yaml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.yml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const save = useMutation({
    mutationFn: () => cubeManagementRequest<{ name: string; filename: string }>('models', model),
  });
  const activation = useMutation({
    mutationFn: () =>
      cubeManagementRequest<{ active: boolean }>(
        `models/${encodeURIComponent(save.data?.name ?? '')}/status`,
      ),
    onSuccess: async (result) => {
      if (result.active) await client.invalidateQueries({ queryKey: ['cube'] });
    },
  });
  const busy = save.isPending || activation.isPending;
  const update = (id: number, patch: Partial<Measure>) =>
    setMeasures((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  return (
    <section
      className="space-y-4 rounded-lg border bg-muted/10 p-4"
      aria-label={t('modelTabs.generate')}
    >
      <h3 className="font-semibold">{t('modelTabs.generate')}</h3>
      <p className="text-sm text-muted-foreground">{t('creationHelp')}</p>
      <fieldset disabled={busy || save.isSuccess} className="space-y-4 disabled:opacity-70">
        <label className="block space-y-2">
          {t('cubeName')}
          <Input dir="ltr" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-2 font-medium">{t('measures')}</legend>
          {measures.map((measure) => (
            <div
              key={measure.id}
              className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-2"
            >
              <label>
                {t('memberName')}
                <Input
                  dir="ltr"
                  value={measure.name}
                  onChange={(event) => update(measure.id, { name: event.target.value })}
                />
              </label>
              <label>
                {t('type')}
                <select
                  className="block w-full rounded-md border bg-background p-2"
                  value={measure.type}
                  onChange={(event) => update(measure.id, { type: event.target.value })}
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              {measure.type !== 'count' && (
                <label>
                  {t('column')}
                  <select
                    className="block w-full rounded-md border bg-background p-2"
                    value={measure.sql}
                    onChange={(event) => update(measure.id, { sql: event.target.value })}
                  >
                    <option value="">{t('chooseColumn')}</option>
                    {columns.map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setMeasures((items) => items.filter((item) => item.id !== measure.id))
                }
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={measures.length >= 100}
            onClick={() => {
              setMeasures((items) => [...items, { id: nextId, name: '', type: 'sum', sql: '' }]);
              setNextId((value) => value + 1);
            }}
          >
            {t('add')}
          </Button>
        </fieldset>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 font-medium">{t('dimensions')}</legend>
          {columns
            .filter((column) => identifier.test(column.name))
            .map((column) => (
              <label key={column.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dimensions.includes(column.name)}
                  onChange={(event) =>
                    setDimensions((items) =>
                      event.target.checked
                        ? [...items, column.name]
                        : items.filter((item) => item !== column.name),
                    )
                  }
                />
                {column.name}
              </label>
            ))}
        </fieldset>
        <CubeRelationships
          tables={tables.filter((entry) => `${entry.schema}.${entry.name}` !== table)}
          columns={columns}
          value={relationships}
          onChange={setRelationships}
        />
        {relationships.length > 0 && (
          <label className="block">
            {relationsT('primaryKey')}
            <select
              className="block w-full rounded-md border bg-background p-2"
              value={primaryKey}
              onChange={(event) => setPrimaryKey(event.target.value)}
            >
              <option value="">{relationsT('choose')}</option>
              {columns
                .filter((column) => identifier.test(column.name))
                .map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </fieldset>
      {!save.isSuccess && (
        <>
          <p className="text-sm text-muted-foreground">{t('validation')}</p>
          <details>
            <summary className="cursor-pointer">{t('preview')}</summary>
            <pre dir="ltr" className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-sm">
              {yaml}
            </pre>
          </details>
          {relationships.length > 0 && <p role="status">{relationsT('exportHelp')}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={!valid || !joinsValid || busy}
            onClick={download}
          >
            {t('download')}
          </Button>
          <Button
            type="button"
            disabled={!valid || busy || relationships.length > 0}
            onClick={() => save.mutate()}
          >
            {busy ? t('working') : t('saveServer')}
          </Button>
        </>
      )}
      {save.isError && <p role="alert">{save.error.message}</p>}
      {save.data && (
        <div className="space-y-3">
          <p role="status">{t('savedServer', save.data)}</p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => activation.mutate()}
          >
            {t('checkActivation')}
          </Button>
        </div>
      )}
      {activation.isError && <p role="alert">{activation.error.message}</p>}
      {activation.data && (
        <p role="status">{t(activation.data.active ? 'activeServer' : 'pendingServer')}</p>
      )}
    </section>
  );
};
