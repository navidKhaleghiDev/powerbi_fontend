import { stringify } from 'yaml';

const identifier = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const tableName = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*){0,2}$/;
const measureTypes = new Set(['count', 'sum', 'avg', 'min', 'max', 'count_distinct']);
const dimensionTypes = new Set(['string', 'number', 'time', 'boolean']);
export interface ModelMember {
  name: string;
  type: string;
  sql?: string;
}
export interface CubeModel {
  name: string;
  table: string;
  measures: ModelMember[];
  dimensions: ModelMember[];
}
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'Expected an object');
  return value as Record<string, unknown>;
};
export const validateModel = (input: unknown): CubeModel => {
  const model = record(input);
  if (typeof model.name !== 'string' || !identifier.test(model.name))
    throw new ApiError(400, 'Invalid cube name');
  if (typeof model.table !== 'string' || model.table.length > 200 || !tableName.test(model.table))
    throw new ApiError(400, 'Use a SQL table name such as public.orders');
  const parseMembers = (value: unknown, types: Set<string>): ModelMember[] => {
    if (!Array.isArray(value) || value.length > 100)
      throw new ApiError(400, 'Expected at most 100 members');
    return value.map((entry: unknown) => {
      const item = record(entry);
      if (
        typeof item.name !== 'string' ||
        !identifier.test(item.name) ||
        typeof item.type !== 'string' ||
        !types.has(item.type)
      )
        throw new ApiError(400, 'Invalid member name or type');
      if (item.type === 'count') return { name: item.name, type: item.type };
      if (
        typeof item.sql !== 'string' ||
        !item.sql.trim() ||
        item.sql.length > 1000 ||
        /\{[{%#]/.test(item.sql) ||
        [...item.sql].some((char) => char.charCodeAt(0) < 32)
      )
        throw new ApiError(
          400,
          'A single-line SQL column or expression is required; template directives are unsupported',
        );
      return { name: item.name, type: item.type, sql: item.sql.trim() };
    });
  };
  const measures = parseMembers(model.measures, measureTypes);
  const dimensions = parseMembers(model.dimensions, dimensionTypes);
  const names = [...measures, ...dimensions].map((item) => item.name.toLowerCase());
  if (!measures.length || new Set(names).size !== names.length)
    throw new ApiError(400, 'At least one measure and unique member names are required');
  return { name: model.name, table: model.table, measures, dimensions };
};
export const serializeModel = (model: CubeModel) =>
  stringify({
    cubes: [
      {
        name: model.name,
        sql_table: model.table,
        measures: model.measures,
        ...(model.dimensions.length ? { dimensions: model.dimensions } : {}),
      },
    ],
  });
