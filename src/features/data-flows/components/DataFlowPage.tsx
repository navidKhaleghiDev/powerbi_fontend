import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  LoaderCircle,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import {
  createConnector,
  getDatabaseColumns,
  getDatabaseTables,
  getDatabaseTypes,
  testDatabaseConnection,
  type DatabaseCredentials,
  type DatabaseTable,
  type DatabaseType,
  type SuggestedColumn,
} from '@/features/data-flows/api/data-flow-api';
import { Button } from '@/shared/components/ui/button';

type Step = 'source' | 'connection' | 'tables' | 'columns' | 'connector' | 'complete';
const steps: Exclude<Step, 'complete'>[] = [
  'source',
  'connection',
  'tables',
  'columns',
  'connector',
];
const emptyConnection: DatabaseCredentials = {
  db_type: '',
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
};

const inputLabels = {
  host: 'Host',
  port: 'Port',
  database: 'Database',
  username: 'Username',
  password: 'Password',
  connectorName: 'Connector name',
  topicPrefix: 'Topic prefix',
  slotName: 'Replication slot name',
  publicationName: 'Publication name',
} as const;

export const DataFlowPage = () => {
  const t = useTranslations('dataFlow');
  const locale = useLocale();
  const isPersian = locale === 'fa';
  const [step, setStep] = useState<Step>('source');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('db_type');
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<DatabaseType | null>(null);
  const [connection, setConnection] = useState<DatabaseCredentials>(emptyConnection);
  const [connectionIsTested, setConnectionIsTested] = useState(false);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<DatabaseTable[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, SuggestedColumn[]>>({});
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [connectorName, setConnectorName] = useState('');
  const [topicPrefix, setTopicPrefix] = useState('');
  const [slotName, setSlotName] = useState('');
  const [publicationName, setPublicationName] = useState('');
  const typesQuery = useQuery({
    queryKey: ['database-types', { category, search, ordering, page }],
    queryFn: () => getDatabaseTypes({ category, search, ordering, page }),
    enabled: step === 'source',
  });
  const testConnectionMutation = useMutation({ mutationFn: testDatabaseConnection });
  const tablesMutation = useMutation({ mutationFn: getDatabaseTables });
  const columnsMutation = useMutation({
    mutationFn: ({ table }: { table: string }) => getDatabaseColumns(connection, table),
  });
  const connectorMutation = useMutation({ mutationFn: createConnector });
  const activeIndex = steps.indexOf(step === 'complete' ? 'connector' : step);
  const canTestConnection = Boolean(
    connection.host.trim() &&
    connection.port > 0 &&
    connection.database.trim() &&
    connection.username.trim() &&
    connection.password,
  );
  const canCreateConnector = Boolean(
    connectorName.trim() && topicPrefix.trim() && slotName.trim() && publicationName.trim(),
  );
  const setConnectionValue = (field: keyof DatabaseCredentials, value: string) => {
    setConnection((current) => ({
      ...current,
      [field]: field === 'port' ? Number(value) : value,
    }));
    setConnectionIsTested(false);
  };

  const selectSource = (databaseType: DatabaseType) => {
    setSource(databaseType);
    setConnection({ ...emptyConnection, db_type: databaseType.db_type });
    setConnectionIsTested(false);
    setStep('connection');
  };

  const loadTables = async () => {
    const result = await tablesMutation.mutateAsync(connection);
    setTables(result);
    setStep('tables');
  };

  const toggleTable = (table: DatabaseTable) => {
    const qualifiedName = `${table.schema_name}.${table.table_name}`;
    setSelectedTables((current) =>
      current.some((item) => `${item.schema_name}.${item.table_name}` === qualifiedName)
        ? current.filter((item) => `${item.schema_name}.${item.table_name}` !== qualifiedName)
        : [...current, table],
    );
  };

  const loadSelectedColumns = async () => {
    if (!selectedTables.length) return;
    setIsLoadingColumns(true);
    try {
      const results = await Promise.all(
        selectedTables.map(async (table) => {
          const qualifiedName = `${table.schema_name}.${table.table_name}`;
          const result = await columnsMutation.mutateAsync({ table: qualifiedName });
          return [qualifiedName, result.columns] as const;
        }),
      );
      setColumnsByTable(Object.fromEntries(results));
      const firstTable = selectedTables[0];
      if (!firstTable) return;
      const base = `${connection.database}-${firstTable.table_name}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-');
      setConnectorName(`${base}-connector`);
      setTopicPrefix(base);
      setSlotName(`${firstTable.table_name}_slot`.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
      setPublicationName(
        `${firstTable.table_name}_publication`.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      );
      setStep('columns');
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const createFlowConnector = async () => {
    if (!selectedTables.length) return;
    await connectorMutation.mutateAsync({
      name: connectorName,
      db_type: connection.db_type,
      config: {
        'database.hostname': connection.host,
        'database.port': connection.port,
        'database.user': connection.username,
        'database.password': connection.password,
        'database.dbname': connection.database,
        'topic.prefix': topicPrefix,
        'slot.name': slotName,
        'publication.name': publicationName,
        'table.include.list': selectedTables
          .map((table) => `${table.schema_name}.${table.table_name}`)
          .join(', '),
      },
    });
    setStep('complete');
  };

  const inputClass =
    'w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary';
  const currentTableNames = selectedTables
    .map((table) => `${table.schema_name}.${table.table_name}`)
    .join(', ');

  return (
    <section
      className="cdc-setup-page flex w-full flex-col gap-6 p-5 md:p-8"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-surface-info-subtle p-3 text-text-info">
            <Workflow size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-info">{t('eyebrow')}</p>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">{t('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">{t('description')}</p>
          </div>
        </div>
        {source ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border-info px-3 py-1.5 text-sm text-text-info">
            <Database size={15} aria-hidden="true" />
            {t('sourceDatabase', { type: source.db_type })}
          </span>
        ) : null}
      </header>

      <ol className="grid gap-2 sm:grid-cols-5" aria-label={t('steps')}>
        {steps.map((item, index) => (
          <li
            key={item}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm ${
              index === activeIndex
                ? 'border-border-brand bg-surface-info-subtle text-text-info'
                : index < activeIndex
                  ? 'border-border-success bg-surface-default text-text-success'
                  : 'border-border-default bg-surface-default text-text-secondary'
            }`}
            aria-current={index === activeIndex ? 'step' : undefined}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current">
              {index < activeIndex ? <Check size={14} aria-hidden="true" /> : index + 1}
            </span>
            {t(`step.${item}`)}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border-default bg-surface-default/80 p-5 shadow-sm md:p-7">
        {step === 'source' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t('sourceTitle')}</h2>
              <p className="mt-1 text-sm text-text-secondary">{t('sourceHelp')}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <label className="sr-only" htmlFor="database-type-search">
                {t('search')}
              </label>
              <input
                id="database-type-search"
                className={inputClass}
                value={search}
                placeholder={t('search')}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className={inputClass}
                aria-label={t('category')}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('allCategories')}</option>
                {(['sql', 'analytic', 'nosql'] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(`categoryNames.${value}`)}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                aria-label={t('sort')}
                value={ordering}
                onChange={(event) => setOrdering(event.target.value)}
              >
                {(['db_type', '-db_type', 'category', '-category', 'id', '-id'] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {t(`ordering.${value.startsWith('-') ? 'descending' : 'ascending'}`, {
                        field: value.replace('-', ''),
                      })}
                    </option>
                  ),
                )}
              </select>
            </div>
            {typesQuery.isPending ? (
              <div className="flex items-center gap-2 py-12 text-sm text-text-secondary">
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                {t('loadingTypes')}
              </div>
            ) : typesQuery.isError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-danger p-4">
                <p className="text-sm text-text-danger">{t('loadTypesError')}</p>
                <Button type="button" variant="outline" onClick={() => void typesQuery.refetch()}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {t('retry')}
                </Button>
              </div>
            ) : typesQuery.data.results.length === 0 ? (
              <p className="rounded-xl border border-border-default p-6 text-center text-sm text-text-secondary">
                {t('noTypes')}
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {typesQuery.data.results.map((databaseType) => (
                    <button
                      type="button"
                      key={databaseType.id}
                      onClick={() => selectSource(databaseType)}
                      className="flex min-h-28 items-center gap-4 rounded-xl border border-border-default bg-surface-default p-4 text-start transition hover:border-border-brand hover:bg-surface-info-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-brand-default"
                    >
                      {databaseType.image ? (
                        <img
                          className="size-12 shrink-0 object-contain"
                          src={databaseType.image}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <Database className="size-10 shrink-0 text-text-info" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <strong className="block truncate text-base text-text-primary">
                          {databaseType.db_type}
                        </strong>
                        <span className="mt-1 block text-xs text-text-secondary">
                          {databaseType.category}
                        </span>
                        <span className="mt-2 inline-block rounded-full border border-border-info px-2 py-0.5 text-xs text-text-info">
                          {t('sourceLabel')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border-default pt-4 text-sm text-text-secondary">
                  <span>{t('typeCount', { count: typesQuery.data.count })}</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!typesQuery.data.previous || page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      {isPersian ? (
                        <ArrowRight aria-hidden="true" />
                      ) : (
                        <ArrowLeft aria-hidden="true" />
                      )}
                      {t('previous')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!typesQuery.data.next}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {t('next')}
                      {isPersian ? (
                        <ArrowLeft aria-hidden="true" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {step === 'connection' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t('connectionTitle')}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t('connectionHelp', { type: source?.db_type ?? '' })}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['host', 'port', 'database', 'username', 'password'] as const).map((field) => (
                <label key={field} className="space-y-1.5 text-sm font-medium text-text-primary">
                  <span>{inputLabels[field]}</span>
                  <input
                    className={inputClass}
                    type={field === 'password' ? 'password' : field === 'port' ? 'number' : 'text'}
                    min={field === 'port' ? 1 : undefined}
                    max={field === 'port' ? 65535 : undefined}
                    required
                    autoComplete={field === 'password' ? 'current-password' : 'off'}
                    value={connection[field]}
                    onChange={(event) => setConnectionValue(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-3 border-t border-border-default pt-5">
              <Button type="button" variant="outline" onClick={() => setStep('source')}>
                {isPersian ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                {t('back')}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={testConnectionMutation.isPending || !canTestConnection}
                  onClick={() => {
                    setConnectionIsTested(false);
                    void testConnectionMutation
                      .mutateAsync(connection)
                      .then(() => setConnectionIsTested(true))
                      .catch(() => undefined);
                  }}
                >
                  {testConnectionMutation.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                  {t('testConnection')}
                </Button>
                <Button
                  type="button"
                  disabled={!connectionIsTested || tablesMutation.isPending}
                  onClick={() => void loadTables().catch(() => undefined)}
                >
                  {tablesMutation.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  {t('continue')}
                  {isPersian ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                </Button>
              </div>
            </div>
            {!connectionIsTested ? (
              <p className="text-xs text-text-secondary">{t('testBeforeContinue')}</p>
            ) : null}
          </div>
        ) : null}

        {step === 'tables' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t('tablesTitle')}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t('tablesHelp', { database: connection.database })}
              </p>
            </div>
            {tables.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((table) => (
                  <button
                    key={`${table.schema_name}.${table.table_name}`}
                    type="button"
                    onClick={() => toggleTable(table)}
                    disabled={isLoadingColumns}
                    aria-pressed={selectedTables.some(
                      (item) =>
                        `${item.schema_name}.${item.table_name}` ===
                        `${table.schema_name}.${table.table_name}`,
                    )}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-start hover:border-border-brand hover:bg-surface-info-subtle disabled:opacity-60 ${selectedTables.some((item) => `${item.schema_name}.${item.table_name}` === `${table.schema_name}.${table.table_name}`) ? 'border-border-brand bg-surface-info-subtle' : 'border-border-default'}`}
                  >
                    <span>
                      <strong className="block text-text-primary">{table.table_name}</strong>
                      <span className="text-xs text-text-secondary">
                        {t('schemaLabel', { schema: table.schema_name })}
                      </span>
                    </span>
                    {selectedTables.some(
                      (item) =>
                        `${item.schema_name}.${item.table_name}` ===
                        `${table.schema_name}.${table.table_name}`,
                    ) ? (
                      <Check className="text-text-info" size={18} aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border-default p-5 text-sm text-text-secondary">
                {t('noTables')}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-5">
              <Button type="button" variant="outline" onClick={() => setStep('connection')}>
                {isPersian ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                {t('back')}
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {t('selectedCount', { count: selectedTables.length })}
                </span>
                <Button
                  type="button"
                  disabled={!selectedTables.length || isLoadingColumns}
                  onClick={() => void loadSelectedColumns().catch(() => undefined)}
                >
                  {isLoadingColumns ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  {t('inspectSelectedTables')}
                  {isPersian ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'columns' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t('columnsTitle')}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t('columnsHelp', { table: currentTableNames })}
              </p>
            </div>
            <div className="space-y-5">
              {selectedTables.map((table) => {
                const qualifiedName = `${table.schema_name}.${table.table_name}`;
                const tableColumns = columnsByTable[qualifiedName] ?? [];
                return (
                  <section key={qualifiedName} className="space-y-3">
                    <h3 className="font-semibold text-text-primary">{qualifiedName}</h3>
                    <div className="overflow-x-auto rounded-xl border border-border-default">
                      <table className="w-full min-w-[34rem] text-start text-sm">
                        <thead className="bg-surface-raised text-text-secondary">
                          <tr>
                            <th className="px-4 py-3">{t('columnName')}</th>
                            <th className="px-4 py-3">{t('sourceType')}</th>
                            <th className="px-4 py-3">{t('targetType')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableColumns.length ? (
                            tableColumns.map((column) => (
                              <tr
                                key={column.column_name}
                                className="border-t border-border-default"
                              >
                                <td className="px-4 py-3 font-medium text-text-primary">
                                  {column.column_name}
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {column.data_type}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={
                                      column.consumer_type
                                        ? 'text-text-primary'
                                        : 'text-text-warning'
                                    }
                                  >
                                    {column.consumer_type
                                      ? `${column.consumer_type} ${t('suggested')}`
                                      : t('manualMapping')}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-4 py-6 text-center text-text-secondary">
                                {t('noColumns')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="flex justify-between gap-3 border-t border-border-default pt-5">
              <Button type="button" variant="outline" onClick={() => setStep('tables')}>
                {isPersian ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                {t('back')}
              </Button>
              <Button type="button" onClick={() => setStep('connector')}>
                {t('continue')}
                {isPersian ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'connector' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{t('connectorTitle')}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t('connectorHelp', { table: currentTableNames })}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['connectorName', connectorName, setConnectorName],
                  ['topicPrefix', topicPrefix, setTopicPrefix],
                  ['slotName', slotName, setSlotName],
                  ['publicationName', publicationName, setPublicationName],
                ] as const
              ).map(([field, value, setValue]) => (
                <label key={field} className="space-y-1.5 text-sm font-medium text-text-primary">
                  <span>{inputLabels[field]}</span>
                  <input
                    className={inputClass}
                    required
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="rounded-xl bg-surface-raised p-4 text-sm text-text-secondary">
              <p>
                <strong className="text-text-primary">{t('selectedSource')}:</strong>{' '}
                {source?.db_type} · {connection.host}:{connection.port}/{connection.database}
              </p>
              <p className="mt-1">
                <strong className="text-text-primary">{t('selectedTables')}:</strong>{' '}
                {currentTableNames}
              </p>
              <p className="mt-1 text-xs break-all">table.include.list: {currentTableNames}</p>
              <p className="mt-3 text-xs">{t('connectorCredentialNotice')}</p>
            </div>
            <div className="flex justify-between gap-3 border-t border-border-default pt-5">
              <Button type="button" variant="outline" onClick={() => setStep('columns')}>
                {isPersian ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
                {t('back')}
              </Button>
              <Button
                type="button"
                disabled={connectorMutation.isPending || !canCreateConnector}
                onClick={() => void createFlowConnector().catch(() => undefined)}
              >
                {connectorMutation.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Workflow aria-hidden="true" />
                )}
                {t('createConnector')}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'complete' ? (
          <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-success-subtle text-text-success">
              <Check size={28} aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-semibold text-text-primary">{t('completeTitle')}</h2>
            <p className="text-sm text-text-secondary">
              {t('completeDescription', { name: connectorName, table: currentTableNames })}
            </p>
            <Button
              type="button"
              onClick={() => {
                setStep('source');
                setSource(null);
                setConnection(emptyConnection);
                setConnectionIsTested(false);
                setTables([]);
                setSelectedTables([]);
                setColumnsByTable({});
              }}
            >
              {t('startAnother')}
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-text-secondary">{t('secureCredentials')}</p>
    </section>
  );
};
