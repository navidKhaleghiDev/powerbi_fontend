import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import {
  createConsumer,
  getDataTypes,
  getConnectorConfig,
  getDatabaseColumns,
  type ConsumerColumnMapping,
  type ConsumerConfig,
  type ConsumerTableConfig,
  type DatabaseCredentials,
  type SuggestedColumn,
} from '@/features/data-flows/api/data-flow-api';
import {
  createConsumerFormSchema,
  createConsumerTablesSchema,
  type ConsumerFormValues,
} from '@/features/data-flows/lib/consumer-form-schema';
import {
  createCredentialsSchema,
  type CredentialsValues,
} from '@/features/data-flows/lib/credentials-schema';
import { AppDialog } from '@/shared/components/molecules/app-dialog';
import { Button } from '@/shared/ui/atoms/button/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox/checkbox';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';

interface EditableMapping extends ConsumerColumnMapping {
  id: string;
}

interface EditableTable extends Omit<ConsumerTableConfig, 'columns'> {
  id: string;
  columns: EditableMapping[];
}

type DatabaseConnection = Omit<DatabaseCredentials, 'username' | 'password'>;

interface ColumnCredentialsContextValue {
  credentials: DatabaseCredentials | null;
  revision: number;
  requestCredentials: () => void;
}

const ColumnCredentialsContext = createContext<ColumnCredentialsContextValue | null>(null);

const useColumnCredentials = (): ColumnCredentialsContextValue => {
  const context = useContext(ColumnCredentialsContext);
  if (!context) throw new Error('Column credentials context is unavailable');
  return context;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const inferSourceDatabaseType = (payload: Record<string, unknown>): string => {
  const explicitType = asText(payload.db_type ?? payload['database.type']);
  if (explicitType) return explicitType;
  const connectorClass = asText(payload['connector.class']).toLowerCase();
  if (connectorClass.includes('postgres')) return 'postgresql';
  if (connectorClass.includes('mysql')) return 'mysql';
  if (connectorClass.includes('sqlserver')) return 'sqlserver';
  if (connectorClass.includes('oracle')) return 'oracle';
  return 'postgresql';
};

const getConnectorDetails = (
  payload: unknown,
): { databaseName: string; tableNames: string[]; connection: DatabaseConnection | null } => {
  if (!isRecord(payload)) return { databaseName: '', tableNames: [], connection: null };
  const config = isRecord(payload.config) ? payload.config : payload;
  const databaseName = asText(config['database.dbname']);
  const tableNames = [
    ...new Set(
      asText(config['table.include.list'])
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const dbType = asText(payload.db_type ?? config.db_type) || inferSourceDatabaseType(config);
  const host = asText(config['database.hostname'] ?? config.host);
  const configuredPort = Number(config['database.port'] ?? config.port);
  const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 5432;
  const connection =
    dbType && host && databaseName ? { db_type: dbType, host, port, database: databaseName } : null;
  return { databaseName, tableNames, connection };
};

const ColumnCredentialsProvider = ({
  connection,
  children,
}: {
  connection: DatabaseConnection;
  children: (context: ColumnCredentialsContextValue) => ReactNode;
}) => {
  const t = useTranslations('cdcConnections.consumer');
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(createCredentialsSchema(t('validationError'))),
    defaultValues: { username: '', password: '' },
  });
  const [credentials, setCredentials] = useState<DatabaseCredentials | null>(null);
  const [revision, setRevision] = useState(0);
  const requestCredentials = () => setOpen(true);
  const value = useMemo(
    () => ({ credentials, revision, requestCredentials }),
    [credentials, revision],
  );

  const saveCredentials = ({ username, password }: CredentialsValues) => {
    setCredentials({ ...connection, username, password });
    setRevision((current) => current + 1);
    setOpen(false);
    reset();
  };

  return (
    <ColumnCredentialsContext.Provider value={value}>
      {children(value)}
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        className="consumer-credentials-dialog"
        describedBy="consumer-credentials-description"
      >
        <div className="consumer-table-heading">
          <h2>{t('credentialsTitle')}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p id="consumer-credentials-description" className="consumer-note">
          {t('credentialsDescription')}
        </p>
        <form
          className="consumer-credentials-form"
          noValidate
          onSubmit={handleSubmit(saveCredentials)}
        >
          <label>
            <span>{t('username')}</span>
            <Input
              autoComplete="username"
              aria-invalid={!!errors.username}
              {...register('username')}
              autoFocus
            />
            {errors.username && <span role="alert">{errors.username.message}</span>}
          </label>
          <label>
            <span>{t('password')}</span>
            <Input
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && <span role="alert">{errors.password.message}</span>}
          </label>
          <p className="consumer-note">{t('credentialsMemoryNotice')}</p>
          <div className="consumer-form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('saveCredentials')}</Button>
          </div>
        </form>
      </AppDialog>
    </ColumnCredentialsContext.Provider>
  );
};

const newMapping = (): EditableMapping => ({
  id: crypto.randomUUID(),
  source: '',
  target: '',
  type: '',
});

const newTable = (sourceTable = ''): EditableTable => ({
  id: crypto.randomUUID(),
  source_table: sourceTable,
  target_table: '',
  columns: [newMapping()],
  order_by: [],
});

const clickHouseType = (column: SuggestedColumn): string => column.consumer_type ?? '';

const ConsumerTableEditor = ({
  table,
  tableNames,
  connectorName,
  onChange,
  onRemove,
}: {
  table: EditableTable;
  tableNames: string[];
  connectorName: string;
  onChange: (next: EditableTable) => void;
  onRemove: () => void;
}) => {
  const t = useTranslations('cdcConnections.consumer');
  const typeListId = useId();
  const { credentials, revision, requestCredentials } = useColumnCredentials();
  const dataTypes = useQuery({
    queryKey: ['database-data-types', 'clickhouse'],
    queryFn: () => getDataTypes('clickhouse'),
    staleTime: 300_000,
  });
  const columnsQuery = useQuery({
    queryKey: ['consumer-source-columns', connectorName, table.source_table, revision],
    queryFn: () => {
      if (!credentials) throw new Error('Database credentials are required');
      return getDatabaseColumns(credentials, table.source_table);
    },
    enabled: Boolean(table.source_table && credentials),
  });
  const availableColumns = columnsQuery.data?.columns ?? [];
  const targets = [...new Set(table.columns.map((column) => column.target.trim()).filter(Boolean))];

  const updateColumn = (index: number, patch: Partial<ConsumerColumnMapping>) =>
    onChange({
      ...table,
      columns: table.columns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    });

  return (
    <section className="consumer-table-card">
      <div className="consumer-table-heading">
        <h3>{t('table')}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('removeTable')}
          title={t('removeTable')}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="consumer-fields-grid">
        <label>
          <span>{t('sourceTable')}</span>
          <NativeSelect
            value={table.source_table}
            onChange={(event) => {
              onChange({
                ...table,
                source_table: event.target.value,
                columns: [newMapping()],
                order_by: [],
              });
              if (event.target.value && !credentials) requestCredentials();
            }}
          >
            <option value="">{t('chooseTable')}</option>
            {tableNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          <span>{t('targetTable')}</span>
          <Input
            value={table.target_table}
            onChange={(event) => onChange({ ...table, target_table: event.target.value })}
            placeholder={t('targetTablePlaceholder')}
          />
        </label>
      </div>
      {table.source_table && !credentials && (
        <div className="consumer-credentials-required">
          <p className="consumer-note">{t('credentialsRequired')}</p>
          <Button type="button" variant="outline" size="sm" onClick={requestCredentials}>
            {t('enterCredentials')}
          </Button>
        </div>
      )}
      {columnsQuery.isFetching && (
        <p className="consumer-note">
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {t('loadingColumns')}
        </p>
      )}
      {columnsQuery.isError && (
        <p className="consumer-error" role="alert">
          {t('columnsError')}
        </p>
      )}
      {table.source_table && credentials && !columnsQuery.isFetching && !columnsQuery.isError && (
        <div className="consumer-column-mappings">
          <h4>{t('columns')}</h4>
          {table.columns.map((column, index) => (
            <div className="consumer-mapping-row" key={column.id}>
              <NativeSelect
                aria-label={t('sourceColumn')}
                value={column.source}
                onChange={(event) => {
                  const selected = availableColumns.find(
                    (item) => item.column_name === event.target.value,
                  );
                  updateColumn(index, {
                    source: event.target.value,
                    target: event.target.value,
                    type: selected ? clickHouseType(selected) : column.type,
                  });
                }}
              >
                <option value="">{t('chooseColumn')}</option>
                {availableColumns.map((item) => (
                  <option key={item.column_name} value={item.column_name}>
                    {item.column_name}
                  </option>
                ))}
              </NativeSelect>
              <Input
                aria-label={t('targetColumn')}
                value={column.target}
                onChange={(event) => updateColumn(index, { target: event.target.value })}
                placeholder={t('targetColumnPlaceholder')}
              />
              <Input
                aria-label={t('columnType')}
                value={column.type}
                list={typeListId}
                onChange={(event) => updateColumn(index, { type: event.target.value })}
                placeholder={t('columnTypePlaceholder')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('removeColumn')}
                title={t('removeColumn')}
                onClick={() => {
                  const columns = table.columns.filter((_, columnIndex) => columnIndex !== index);
                  const remainingTargets = new Set(
                    columns.map((item) => item.target.trim()).filter(Boolean),
                  );
                  onChange({
                    ...table,
                    columns,
                    order_by: table.order_by.filter((target) => remainingTargets.has(target)),
                  });
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          <datalist id={typeListId}>
            {dataTypes.data?.map((type) => (
              <option key={type.value} value={type.value} label={type.name} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...table, columns: [...table.columns, newMapping()] })}
          >
            <Plus aria-hidden="true" />
            {t('addColumn')}
          </Button>
          {targets.length > 0 && (
            <fieldset className="consumer-order-by">
              <legend>{t('orderBy')}</legend>
              {targets.map((target) => (
                <label key={target}>
                  <Checkbox
                    checked={table.order_by.includes(target)}
                    onChange={() =>
                      onChange({
                        ...table,
                        order_by: table.order_by.includes(target)
                          ? table.order_by.filter((value) => value !== target)
                          : [...table.order_by, target],
                      })
                    }
                  />
                  <span>{target}</span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
};

export const CreateConsumerPage = () => {
  const { connectorName } = useParams({ from: '/$locale/cdc-connections/$connectorName/consumer' });
  const locale = useLocale();
  const isPersian = locale === 'fa';
  const t = useTranslations('cdcConnections.consumer');
  const {
    register: registerConsumer,
    handleSubmit: handleConsumerSubmit,
    formState: { errors: consumerErrors },
  } = useForm<ConsumerFormValues>({
    resolver: zodResolver(createConsumerFormSchema(t('validationError'))),
    defaultValues: { topicPrefix: 'bi' },
  });
  const [tables, setTables] = useState<EditableTable[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const configQuery = useQuery({
    queryKey: ['cdc-connector-config', connectorName],
    queryFn: () => getConnectorConfig(connectorName),
    retry: false,
  });
  const connectorDetails = useMemo(() => getConnectorDetails(configQuery.data), [configQuery.data]);
  const createMutation = useMutation({ mutationFn: createConsumer });

  const submit = async ({ topicPrefix }: ConsumerFormValues) => {
    setError('');
    const parsedTables = createConsumerTablesSchema(t('validationError')).safeParse(tables);
    if (!parsedTables.success) {
      setError(t('validationError'));
      return;
    }
    const payload: ConsumerConfig = {
      db_type: 'clickhouse',
      'topic.prefix': topicPrefix,
      tables: parsedTables.data.map(({ source_table, target_table, columns, order_by }) => ({
        source_table,
        target_table: target_table.trim(),
        columns: columns.map(({ source, target, type }) => ({ source, target, type })),
        order_by,
      })),
    };
    try {
      await createMutation.mutateAsync(payload);
      setSuccess(true);
    } catch {
      setError(t('createError'));
    }
  };

  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 md:p-8"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      <header className="flex items-start gap-3">
        <Link
          to="/$locale/cdc-connections"
          params={{ locale }}
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50"
          aria-label={t('back')}
        >
          {isPersian ? (
            <ArrowRight size={17} aria-hidden="true" />
          ) : (
            <ArrowLeft size={17} aria-hidden="true" />
          )}
        </Link>
        <div>
          <p className="text-sm font-medium text-blue-700">{t('pageEyebrow')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('description', { name: connectorName })}</p>
        </div>
      </header>
      {configQuery.isPending ? (
        <p className="consumer-note">
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {t('loadingSource')}
        </p>
      ) : configQuery.isError ? (
        <p className="consumer-error" role="alert">
          {t('configError')}
        </p>
      ) : !connectorDetails.databaseName || !connectorDetails.tableNames.length ? (
        <p className="consumer-error" role="alert">
          {t('tableListError')}
        </p>
      ) : !connectorDetails.connection ? (
        <p className="consumer-error" role="alert">
          {t('configError')}
        </p>
      ) : success ? (
        <div className="consumer-success" role="status">
          <Check aria-hidden="true" />
          {t('created')}
        </div>
      ) : (
        <ColumnCredentialsProvider connection={connectorDetails.connection}>
          {({ credentials, requestCredentials }) => (
            <form className="consumer-form" noValidate onSubmit={handleConsumerSubmit(submit)}>
              <div className="consumer-fields-grid">
                <label>
                  <span>{t('database')}</span>
                  <Input value={connectorDetails.databaseName} readOnly />
                </label>
                <label>
                  <span>{t('topicPrefix')}</span>
                  <Input
                    aria-invalid={!!consumerErrors.topicPrefix}
                    {...registerConsumer('topicPrefix')}
                  />
                  {consumerErrors.topicPrefix && (
                    <span role="alert">{consumerErrors.topicPrefix.message}</span>
                  )}
                </label>
              </div>
              {tables.map((table) => (
                <ConsumerTableEditor
                  key={table.id}
                  table={table}
                  tableNames={connectorDetails.tableNames}
                  connectorName={connectorName}
                  onChange={(next) =>
                    setTables((current) =>
                      current.map((item) => (item.id === next.id ? next : item)),
                    )
                  }
                  onRemove={() =>
                    setTables((current) => current.filter((item) => item.id !== table.id))
                  }
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTables((current) => [...current, newTable(connectorDetails.tableNames[0])]);
                  if (!credentials) requestCredentials();
                }}
              >
                <Plus aria-hidden="true" />
                {t('addTable')}
              </Button>
              {error && (
                <p className="consumer-error" role="alert">
                  {error}
                </p>
              )}
              <div className="consumer-form-actions">
                <Button type="submit" disabled={createMutation.isPending || !tables.length}>
                  {createMutation.isPending && (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  )}
                  {t('create')}
                </Button>
              </div>
            </form>
          )}
        </ColumnCredentialsProvider>
      )}
    </section>
  );
};
