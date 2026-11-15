import { useMutation } from '@tanstack/react-query';
import { BarChart3, ChartLine, ChartPie, Eye, Hash, Plus, Table2, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

import {
  queryKpi,
  type KpiAggregation,
  type KpiChartType,
  type KpiFilterOperator,
  type KpiTable,
} from '@/features/kpis/api/kpi-api';
import {
  isValidChart,
  toKpiQuery,
  type ChartDraft,
  type FilterDraft,
} from '@/features/kpis/lib/chart-draft';
import { KpiResultView } from '@/features/kpis/organisms/KpiResultView';
import { Button } from '@/shared/ui/atoms/button/button';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';
import { Radio } from '@/shared/ui/atoms/radio/radio';

const aggregations: KpiAggregation[] = ['sum', 'avg', 'min', 'max', 'count', 'uniqExact'];
const chartTypes: KpiChartType[] = ['bar', 'line', 'pie', 'table', 'number'];
const chartIcons = { bar: BarChart3, line: ChartLine, pie: ChartPie, table: Table2, number: Hash };
const operators: KpiFilterOperator[] = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'like',
  'is_null',
  'is_not_null',
];

export const KpiChartEditor = ({
  chart,
  tables,
  onChange,
  onRemove,
  embedded = false,
}: {
  chart: ChartDraft;
  tables: KpiTable[];
  onChange: (chart: ChartDraft) => void;
  onRemove?: () => void;
  embedded?: boolean;
}) => {
  const t = useTranslations('kpis');
  const id = useId();
  const preview = useMutation({ mutationFn: () => queryKpi(toKpiQuery(chart)) });
  const source = tables.find((table) => table.name === chart.table_name);
  const joined = tables.find((table) => table.name === chart.join_table_name);
  const fields = [
    ...(source?.columns.map((column) => ({
      value: joined ? `source.${column.name}` : column.name,
      label: column.name,
      type: column.type,
    })) ?? []),
    ...(joined?.columns.map((column) => ({
      value: `joined.${column.name}`,
      label: `${joined.name}.${column.name}`,
      type: column.type,
    })) ?? []),
  ];
  const change = (patch: Partial<ChartDraft>) => {
    preview.reset();
    onChange({ ...chart, ...patch });
  };
  const changeFilter = (filterId: string, patch: Partial<FilterDraft>) =>
    change({
      filters: chart.filters.map((filter) =>
        filter.id === filterId ? { ...filter, ...patch } : filter,
      ),
    });
  return (
    <section
      className={
        embedded ? 'kpi-drawer-editor' : 'space-y-4 rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="kpi-editor-section-heading flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t('chart')}</h3>
        {onRemove && (
          <Button type="button" variant="ghost" onClick={onRemove}>
            {t('removeChart')}
          </Button>
        )}
      </div>
      <div className="kpi-editor-fields grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm md:col-span-2">
          {t('chartTitle')}
          <Input
            required
            maxLength={100}
            value={chart.title}
            onChange={(event) => change({ title: event.target.value })}
          />
        </label>
        {embedded ? (
          <fieldset className="kpi-chart-type-field md:col-span-2">
            <legend>{t('chartType')}</legend>
            <div className="kpi-chart-type-options">
              {chartTypes.map((type) => {
                const Icon = chartIcons[type];
                return (
                  <label key={type} className="kpi-chart-type-option">
                    <Radio
                      name={`${id}-chart-type`}
                      value={type}
                      checked={chart.chart_type === type}
                      onChange={() => change({ chart_type: type })}
                    />
                    <Icon size={22} aria-hidden="true" />
                    <span>{t(`chartTypes.${type}`)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <label className="grid gap-1 text-sm">
            {t('chartType')}
            <NativeSelect
              value={chart.chart_type}
              onChange={(event) => change({ chart_type: event.target.value as KpiChartType })}
            >
              {chartTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`chartTypes.${type}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {embedded && (
          <h4 className="kpi-editor-section-heading md:col-span-2">{t('editorData')}</h4>
        )}
        <label className="grid gap-1 text-sm">
          {t('table')}
          <NativeSelect
            required
            value={chart.table_name}
            onChange={(event) =>
              change({
                table_name: event.target.value,
                dimension: '',
                measure: '',
                join_table_name: '',
                join_left_column: '',
                join_right_column: '',
                filters: [],
              })
            }
          >
            <option value="">{t('choose')}</option>
            {tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <fieldset className="min-w-0 space-y-2 md:col-span-2">
          <legend className="text-sm">{t('joinTable')}</legend>
          <div className="kpi-join-options">
            {[
              '',
              ...tables
                .filter((table) => table.name !== chart.table_name)
                .map((table) => table.name),
            ].map((name) => (
              <label key={name} className="kpi-join-option">
                <Radio
                  name={`${id}-join-table`}
                  value={name}
                  checked={chart.join_table_name === name}
                  disabled={!chart.table_name && name !== ''}
                  onChange={() =>
                    change({
                      join_table_name: name,
                      dimension: '',
                      measure: '',
                      join_left_column: '',
                      join_right_column: '',
                      filters: [],
                    })
                  }
                />
                <span>{name || t('noJoin')}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {joined && (
          <>
            <label className="grid gap-1 text-sm">
              {t('joinType')}
              <NativeSelect
                value={chart.join_type}
                onChange={(event) => change({ join_type: event.target.value as 'INNER' | 'LEFT' })}
              >
                <option value="INNER">INNER</option>
                <option value="LEFT">LEFT</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              {t('joinLeft')}
              <NativeSelect
                required
                value={chart.join_left_column}
                onChange={(event) => change({ join_left_column: event.target.value })}
              >
                <option value="">{t('choose')}</option>
                {source?.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              {t('joinRight')}
              <NativeSelect
                required
                value={chart.join_right_column}
                onChange={(event) => change({ join_right_column: event.target.value })}
              >
                <option value="">{t('choose')}</option>
                {joined.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </>
        )}
        <label className="grid gap-1 text-sm">
          {t('dimension')}
          <NativeSelect
            required
            disabled={!source}
            value={chart.dimension}
            onChange={(event) => change({ dimension: event.target.value })}
          >
            <option value="">{t('choose')}</option>
            {fields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          {t('aggregation')}
          <NativeSelect
            value={chart.aggregation}
            onChange={(event) =>
              change({ aggregation: event.target.value as KpiAggregation, measure: '' })
            }
          >
            {aggregations.map((aggregation) => (
              <option
                key={t(`aggregations.${aggregation}`)}
                value={t(`aggregations.${aggregation}`)}
              >
                {t(`aggregations.${aggregation}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          {t('measure')}
          <NativeSelect
            required={chart.aggregation !== 'count'}
            disabled={!source}
            value={chart.measure}
            onChange={(event) => change({ measure: event.target.value })}
          >
            <option value="">{t('noMeasure')}</option>
            {fields
              .filter(
                (field) =>
                  !['sum', 'avg'].includes(chart.aggregation) ||
                  /(?:U?Int\d+|Float\d+|Decimal(?:\d+)?\()/.test(field.type),
              )
              .map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          {t('limit')}
          <Input
            type="number"
            min={1}
            max={1000}
            value={chart.limit}
            onChange={(event) => change({ limit: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="kpi-editor-filters space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{t('filters')}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!source || chart.filters.length >= 50}
            onClick={() =>
              change({
                filters: [
                  ...chart.filters,
                  { id: crypto.randomUUID(), column: '', operator: 'eq', value: '' },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            {t('addFilter')}
          </Button>
        </div>
        {embedded && chart.filters.length === 0 && (
          <p className="kpi-editor-empty">{t('editorNoFilters')}</p>
        )}
        {chart.filters.map((filter) => (
          <div
            key={filter.id}
            className="kpi-editor-filter-row grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <NativeSelect
              aria-label={t('filterColumn')}
              value={filter.column}
              onChange={(event) => changeFilter(filter.id, { column: event.target.value })}
            >
              <option value="">{t('choose')}</option>
              {fields.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label={t('operator')}
              value={filter.operator}
              onChange={(event) =>
                changeFilter(filter.id, { operator: event.target.value as KpiFilterOperator })
              }
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </NativeSelect>
            <Input
              aria-label={t('value')}
              disabled={['is_null', 'is_not_null'].includes(filter.operator)}
              value={filter.value}
              onChange={(event) => changeFilter(filter.id, { value: event.target.value })}
              placeholder={
                ['in', 'not_in'].includes(filter.operator) ? t('commaValues') : t('value')
              }
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={t('removeFilter')}
              onClick={() =>
                change({ filters: chart.filters.filter((item) => item.id !== filter.id) })
              }
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <div className="kpi-editor-preview space-y-3">
        <Button
          type="button"
          variant="outline"
          disabled={!isValidChart(chart) || preview.isPending}
          onClick={() => preview.mutate()}
        >
          <Eye size={16} aria-hidden="true" />
          {t('preview')}
        </Button>
        {embedded && !preview.data && !preview.isPending && !preview.isError && (
          <p className="kpi-editor-empty">
            {t(isValidChart(chart) ? 'editorPreviewReady' : 'editorCompleteFields')}
          </p>
        )}
        {preview.isPending && <p role="status">{t('loading')}</p>}
        {preview.isError && <p role="alert">{preview.error.message}</p>}
        {preview.data && (
          <div aria-labelledby={id}>
            <h4 id={id} className="sr-only">
              {t('preview')}
            </h4>
            <KpiResultView result={preview.data} title={chart.title} kind={chart.chart_type} />
          </div>
        )}
      </div>
    </section>
  );
};
