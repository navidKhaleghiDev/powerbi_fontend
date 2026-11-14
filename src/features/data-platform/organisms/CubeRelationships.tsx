import { useTranslations } from 'use-intl';

import { Button } from '@/shared/components/atoms/button';
import { Input } from '@/shared/components/atoms/input';

export interface ModelTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; primaryKey: boolean }[];
}
export interface ModelRelationship {
  id: number;
  table: string;
  cube: string;
  source: string;
  target: string;
  relationship: string;
}
interface Props {
  tables: ModelTable[];
  columns: ModelTable['columns'];
  value: ModelRelationship[];
  onChange: (value: ModelRelationship[]) => void;
}
export const CubeRelationships = ({ tables, columns, value, onChange }: Props) => {
  const t = useTranslations('cubeRelationships');
  const update = (id: number, patch: Partial<ModelRelationship>) =>
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">{t('title')}</legend>
      <p className="text-sm text-slate-500">{t('help')}</p>
      {value.map((item) => {
        const target = tables.find((table) => `${table.schema}.${table.name}` === item.table);
        return (
          <div key={item.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <label>
              {t('table')}
              <select
                className="block w-full rounded-md border bg-white p-2"
                value={item.table}
                onChange={(event) => {
                  const table = tables.find(
                    (entry) => `${entry.schema}.${entry.name}` === event.target.value,
                  );
                  update(item.id, {
                    table: event.target.value,
                    cube: table?.name ?? '',
                    target: '',
                  });
                }}
              >
                <option value="">{t('choose')}</option>
                {tables.map((table) => (
                  <option
                    key={`${table.schema}.${table.name}`}
                    value={`${table.schema}.${table.name}`}
                  >
                    {table.schema}.{table.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('cube')}
              <Input
                dir="ltr"
                value={item.cube}
                onChange={(event) => update(item.id, { cube: event.target.value })}
              />
            </label>
            <label>
              {t('source')}
              <select
                className="block w-full rounded-md border bg-white p-2"
                value={item.source}
                onChange={(event) => update(item.id, { source: event.target.value })}
              >
                <option value="">{t('choose')}</option>
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('target')}
              <select
                className="block w-full rounded-md border bg-white p-2"
                value={item.target}
                onChange={(event) => update(item.id, { target: event.target.value })}
              >
                <option value="">{t('choose')}</option>
                {target?.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('relationship')}
              <select
                className="block w-full rounded-md border bg-white p-2"
                value={item.relationship}
                onChange={(event) => update(item.id, { relationship: event.target.value })}
              >
                {['many_to_one', 'one_to_many', 'one_to_one'].map((type) => (
                  <option key={type} value={type}>
                    {t(type)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
            >
              {t('remove')}
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        disabled={value.length >= 20}
        onClick={() =>
          onChange([
            ...value,
            {
              id: Math.max(0, ...value.map((item) => item.id)) + 1,
              table: '',
              cube: '',
              source: '',
              target: '',
              relationship: 'many_to_one',
            },
          ])
        }
      >
        {t('add')}
      </Button>
    </fieldset>
  );
};
