import { ApiError } from './model.ts';

export interface DatabaseTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; primaryKey: boolean }[];
}
export const normalizeSchema = (input: unknown): DatabaseTable[] => {
  if (
    !input ||
    typeof input !== 'object' ||
    !('tablesSchema' in input) ||
    !input.tablesSchema ||
    typeof input.tablesSchema !== 'object' ||
    Array.isArray(input.tablesSchema)
  )
    throw new ApiError(502, 'Cube returned invalid database schema metadata');
  const result: DatabaseTable[] = [];
  for (const [schema, tables] of Object.entries(input.tablesSchema as Record<string, unknown>)) {
    if (!tables || typeof tables !== 'object' || Array.isArray(tables))
      throw new ApiError(502, 'Invalid schema table collection');
    for (const [name, columns] of Object.entries(tables)) {
      if (!Array.isArray(columns)) throw new ApiError(502, 'Invalid table column collection');
      result.push({
        schema,
        name,
        columns: columns.map((column: unknown) => {
          if (
            !column ||
            typeof column !== 'object' ||
            !('name' in column) ||
            typeof column.name !== 'string' ||
            !('type' in column) ||
            typeof column.type !== 'string'
          )
            throw new ApiError(502, 'Invalid column metadata');
          return {
            name: column.name,
            type: column.type,
            primaryKey:
              'attributes' in column &&
              Array.isArray(column.attributes) &&
              column.attributes.includes('primaryKey'),
          };
        }),
      });
    }
  }
  return result.sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`));
};
