import type {
  KpiAggregation,
  KpiChartCreate,
  KpiChartType,
  KpiFilter,
  KpiFilterOperator,
  KpiQuery,
} from '@/features/kpis/api/kpi-api';

export interface FilterDraft {
  id: string;
  column: string;
  operator: KpiFilterOperator;
  value: string;
}
export interface ChartDraft {
  id: string;
  title: string;
  chart_type: KpiChartType;
  table_name: string;
  dimension: string;
  measure: string;
  aggregation: KpiAggregation;
  join_table_name: string;
  join_type: 'INNER' | 'LEFT';
  join_left_column: string;
  join_right_column: string;
  limit: number;
  filters: FilterDraft[];
}
export const newChart = (): ChartDraft => ({
  id: crypto.randomUUID(),
  title: '',
  chart_type: 'bar',
  table_name: '',
  dimension: '',
  measure: '',
  aggregation: 'sum',
  join_table_name: '',
  join_type: 'INNER',
  join_left_column: '',
  join_right_column: '',
  limit: 100,
  filters: [],
});
const numericValue = (value: string): string | number =>
  /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : value;
const toFilter = (filter: FilterDraft): KpiFilter => ({
  column: filter.column,
  operator: filter.operator,
  ...(['is_null', 'is_not_null'].includes(filter.operator)
    ? {}
    : {
        value: ['in', 'not_in'].includes(filter.operator)
          ? filter.value
              .split(',')
              .map((value) => numericValue(value.trim()))
              .filter((value) => value !== '')
          : numericValue(filter.value.trim()),
      }),
});
export const toKpiChart = (chart: ChartDraft, position: number): KpiChartCreate => ({
  title: chart.title.trim(),
  chart_type: chart.chart_type,
  table_name: chart.table_name,
  dimension: chart.dimension,
  aggregation: chart.aggregation,
  position,
  limit: chart.limit,
  ...(chart.aggregation === 'count' && !chart.measure ? {} : { measure: chart.measure }),
  ...(chart.join_table_name
    ? {
        join_table_name: chart.join_table_name,
        join_type: chart.join_type,
        join_left_column: chart.join_left_column,
        join_right_column: chart.join_right_column,
      }
    : {}),
  filters: chart.filters.filter((filter) => filter.column).map(toFilter),
});
export const isValidChart = (chart: ChartDraft): boolean =>
  Boolean(
    chart.title.trim() &&
    chart.title.trim().length <= 100 &&
    chart.table_name &&
    chart.dimension &&
    Number.isInteger(chart.limit) &&
    chart.limit >= 1 &&
    chart.limit <= 1000 &&
    (chart.aggregation === 'count' || chart.measure) &&
    (!chart.join_table_name || (chart.join_left_column && chart.join_right_column)) &&
    chart.filters.length <= 50 &&
    chart.filters.every(
      (filter) =>
        filter.column &&
        (['is_null', 'is_not_null'].includes(filter.operator) || filter.value.trim()) &&
        (!['in', 'not_in'].includes(filter.operator) ||
          (filter.value.split(',').filter((value) => value.trim()).length > 0 &&
            filter.value.split(',').filter((value) => value.trim()).length <= 1000)),
    ),
  );

export const toKpiQuery = (chart: ChartDraft): KpiQuery => {
  const { title: _title, chart_type: _type, position: _position, ...query } = toKpiChart(chart, 0);
  return query;
};
