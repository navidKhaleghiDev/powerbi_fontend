import { API_ENDPOINTS, apiRequest } from '@/shared/network/api';

export type DatabaseCategory = 'sql' | 'analytic' | 'nosql';

export interface DatabaseType {
  id: number;
  db_type: string;
  category: string;
  image: string;
}

export interface PaginatedDatabaseTypes {
  count: number;
  next: string | null;
  previous: string | null;
  results: DatabaseType[];
}

export interface DatabaseCredentials {
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface DatabaseTable {
  schema_name: string;
  table_name: string;
  columns: DatabaseTableColumn[];
}

export interface DatabaseTableColumn {
  database_name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export interface SuggestedColumn {
  column_name: string;
  data_type: string;
  consumer_type: string | null;
}

export interface DatabaseColumnsResponse {
  columns: SuggestedColumn[];
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new Error('The server returned an invalid JSON response');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getMessage = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  for (const key of ['message', 'detail', 'error']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key];
  }
  return undefined;
};

const unwrapData = (value: unknown): unknown =>
  isRecord(value) && 'data' in value ? value.data : value;

const normalizeTableName = (value: unknown): DatabaseTable | null => {
  if (typeof value === 'string') {
    const qualifiedName = value.trim();
    if (!qualifiedName) return null;
    const separator = qualifiedName.lastIndexOf('.');
    return {
      schema_name: separator > 0 ? qualifiedName.slice(0, separator) : 'public',
      table_name: separator > 0 ? qualifiedName.slice(separator + 1) : qualifiedName,
      columns: [],
    };
  }
  if (!isRecord(value)) return null;
  const tableName = value.table_name ?? value.name ?? value.table;
  if (typeof tableName !== 'string' || !tableName.trim()) return null;
  const schemaName = value.schema_name ?? value.schema;
  return {
    schema_name: typeof schemaName === 'string' && schemaName.trim() ? schemaName : 'public',
    table_name: tableName,
    columns: Array.isArray(value.columns)
      ? value.columns.filter(isRecord).map((column) => ({
          database_name: typeof column.database_name === 'string' ? column.database_name : '',
          schema_name: typeof column.schema_name === 'string' ? column.schema_name : '',
          table_name: typeof column.table_name === 'string' ? column.table_name : tableName,
          column_name: typeof column.column_name === 'string' ? column.column_name : '',
          data_type: typeof column.data_type === 'string' ? column.data_type : '',
          max_length: typeof column.max_length === 'number' ? column.max_length : null,
          numeric_precision:
            typeof column.numeric_precision === 'number' ? column.numeric_precision : null,
          numeric_scale: typeof column.numeric_scale === 'number' ? column.numeric_scale : null,
        }))
      : [],
  };
};

const normalizeSuggestedColumn = (value: unknown): SuggestedColumn | null => {
  if (typeof value === 'string') {
    return { column_name: value, data_type: '', consumer_type: null };
  }
  if (!isRecord(value)) return null;
  const name = value.column_name ?? value.name ?? value.column;
  if (typeof name !== 'string' || !name.trim()) return null;
  const dataType = value.data_type ?? value.postgres_type ?? value.type;
  const consumerType = value.consumer_type ?? value.suggested_consumer_type;
  return {
    column_name: name,
    data_type: typeof dataType === 'string' ? dataType : '',
    consumer_type: typeof consumerType === 'string' ? consumerType : null,
  };
};

const findArray = (value: unknown, keys: string[]): unknown[] | null => {
  if (Array.isArray(value)) return value as unknown[];
  if (!isRecord(value)) return null;
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  for (const key of ['data', 'result', 'payload']) {
    if (key in value) {
      const nested = findArray(value[key], keys);
      if (nested) return nested;
    }
  }
  return null;
};

export const getDatabaseTypes = async (options: {
  page: number;
  category: string;
  search: string;
  ordering: string;
}): Promise<PaginatedDatabaseTypes> => {
  const params = new URLSearchParams({ page: String(options.page), ordering: options.ordering });
  if (options.category) params.set('category', options.category);
  if (options.search.trim()) params.set('search', options.search.trim());
  const response = await apiRequest(`${API_ENDPOINTS.databaseTypes}?${params.toString()}`);
  const payload = unwrapData(await readJson(response));
  const results = findArray(payload, ['results', 'items']);
  if (!results) throw new Error('The database types response has an unexpected format');
  const normalizedResults = results.flatMap((value, index) => {
    if (!isRecord(value) || typeof value.db_type !== 'string') return [];
    return [
      {
        id: typeof value.id === 'number' ? value.id : index,
        db_type: value.db_type,
        category: typeof value.category === 'string' ? value.category : 'unknown',
        image: typeof value.image === 'string' ? value.image : '',
      },
    ];
  });
  const record = isRecord(payload) ? payload : {};
  return {
    count: typeof record.count === 'number' ? record.count : normalizedResults.length,
    next: typeof record.next === 'string' ? record.next : null,
    previous: typeof record.previous === 'string' ? record.previous : null,
    results: normalizedResults,
  };
};

export const testDatabaseConnection = async (credentials: DatabaseCredentials): Promise<void> => {
  const response = await apiRequest(API_ENDPOINTS.connectionTest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const result = unwrapData(await response.json().catch(() => undefined));
  if (isRecord(result) && result.success === false)
    throw new Error(getMessage(result) ?? 'The database connection test failed');
};

export const getDatabaseTables = async (credentials: DatabaseCredentials) => {
  const response = await apiRequest(API_ENDPOINTS.databaseTables, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const payload = unwrapData(await readJson(response));
  if (isRecord(payload) && payload.success === false) {
    throw new Error(getMessage(payload) ?? 'Unable to load database tables');
  }
  const rawTables = findArray(payload, ['tables', 'results', 'items']);
  if (!rawTables) throw new Error('The database tables response has an unexpected format');
  return rawTables.flatMap((table) => {
    const normalized = normalizeTableName(table);
    return normalized ? [normalized] : [];
  });
};

export const getDatabaseColumns = async (
  credentials: DatabaseCredentials,
  table: string,
): Promise<DatabaseColumnsResponse> => {
  const response = await apiRequest(API_ENDPOINTS.databaseColumns, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...credentials, table }),
  });
  const payload = unwrapData(await readJson(response));
  if (isRecord(payload) && payload.success === false) {
    throw new Error(getMessage(payload) ?? 'Unable to load database columns');
  }
  const rawColumns = findArray(payload, ['columns', 'results', 'items']);
  if (rawColumns) {
    return {
      columns: rawColumns.flatMap((column) => {
        const normalized = normalizeSuggestedColumn(column);
        return normalized ? [normalized] : [];
      }),
    };
  }
  throw new Error('The database columns response has an unexpected format');
};

export interface ConnectorConfig {
  name: string;
  db_type: string;
  config: Record<string, string | number>;
}

export interface ConsumerColumnMapping {
  source: string;
  target: string;
  type: string;
}

export interface ConsumerTableConfig {
  source_table: string;
  target_table: string;
  columns: ConsumerColumnMapping[];
  order_by: string[];
}

export interface ConsumerConfig {
  db_type: 'clickhouse';
  'topic.prefix': string;
  tables: ConsumerTableConfig[];
}

export const getCdcConnections = async (): Promise<string[][]> => {
  const response = await apiRequest(API_ENDPOINTS.connect, { method: 'GET' });
  const payload = unwrapData(await readJson(response));
  if (isRecord(payload) && payload.success === false) {
    throw new Error(getMessage(payload) ?? 'Unable to load CDC connections');
  }
  if (!Array.isArray(payload)) {
    throw new Error('The CDC connections response has an unexpected format');
  }
  // Flat responses list each connector as its own string. Nested responses
  // contain rows of values for each connector.
  if (payload.every((value): value is string => typeof value === 'string')) {
    return payload.map((value) => [value]);
  }
  return payload.flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    return [entry.filter((value): value is string => typeof value === 'string')];
  });
};

export const getConnectorConfig = async (source: string): Promise<unknown> => {
  const response = await apiRequest(API_ENDPOINTS.connectorConfig(source), { method: 'GET' });
  const payload = unwrapData(await readJson(response));
  if (isRecord(payload) && payload.success === false) {
    throw new Error(getMessage(payload) ?? 'Unable to load connector configuration');
  }
  return payload;
};

export const deleteConnector = async (name: string): Promise<void> => {
  const response = await apiRequest(API_ENDPOINTS.connector(name), { method: 'DELETE' });
  const result = unwrapData(await response.json().catch(() => undefined));
  if (isRecord(result) && result.success === false) {
    throw new Error(getMessage(result) ?? 'The connector could not be deleted');
  }
};

export const createConnector = async (connector: ConnectorConfig): Promise<void> => {
  const response = await apiRequest(API_ENDPOINTS.connect, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(connector),
  });
  const result = unwrapData(await response.json().catch(() => undefined));
  if (isRecord(result) && result.success === false) {
    throw new Error(getMessage(result) ?? 'The connector could not be created');
  }
};

export const createConsumer = async (consumer: ConsumerConfig): Promise<void> => {
  const response = await apiRequest(API_ENDPOINTS.consumer, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consumer),
  });
  const result = unwrapData(await response.json().catch(() => undefined));
  if (isRecord(result) && result.success === false) {
    throw new Error(getMessage(result) ?? 'The ClickHouse consumer could not be created');
  }
};
