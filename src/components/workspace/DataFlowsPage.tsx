import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Database, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { deleteConnector, getCdcConnections, getConnectorConfig } from '@/lib/data-flow-api';

import { CreateConsumerAction } from './CreateConsumerAction';

export const DataFlowsPage = () => {
  const t = useTranslations('cdcConnections');
  const locale = useLocale();
  const isPersian = locale === 'fa';
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<Record<string, unknown>>({});
  const connectionsQuery = useQuery({
    queryKey: ['cdc-connections'],
    queryFn: getCdcConnections,
  });
  const configMutation = useMutation({ mutationFn: getConnectorConfig });
  const deleteMutation = useMutation({
    mutationFn: deleteConnector,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cdc-connections'] });
    },
  });

  const retrieveConfig = async (source: string) => {
    const config = await configMutation.mutateAsync(source);
    setConfigs((current) => ({ ...current, [source]: config }));
  };

  const removeConnection = (name: string) => {
    if (!window.confirm(t('confirmDelete', { name }))) return;
    void deleteMutation.mutateAsync(name).catch(() => undefined);
  };

  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 md:p-8"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-surface-info-subtle p-3 text-text-info">
            <Database size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-info">{t('eyebrow')}</p>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">{t('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">{t('description')}</p>
          </div>
        </div>
        <Link
          to="/$locale/data-flows/new"
          params={{ locale }}
          className="hover:bg-action-brand-hover inline-flex items-center gap-2 rounded-lg bg-action-brand-default px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} aria-hidden="true" />
          {t('create')}
        </Link>
      </header>

      {connectionsQuery.isPending ? (
        <div className="rounded-2xl border border-border-default bg-surface-default/80 p-8 text-center text-sm text-text-secondary">
          {t('loading')}
        </div>
      ) : connectionsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-danger bg-surface-default/80 p-6">
          <p className="text-sm text-text-danger">{t('error')}</p>
          <Button type="button" variant="outline" onClick={() => void connectionsQuery.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : connectionsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-default/80 px-6 py-14 text-center">
          <Database className="mx-auto text-text-secondary" size={34} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-text-primary">{t('emptyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">{t('emptyHelp')}</p>
          <Link
            to="/$locale/data-flows/new"
            params={{ locale }}
            className="hover:bg-action-brand-hover mt-5 inline-flex items-center gap-2 rounded-lg bg-action-brand-default px-4 py-2 text-sm font-medium text-white"
          >
            {t('create')}
            {isPersian ? <ArrowRight className="rotate-180" size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
            <p>{t('count', { count: connectionsQuery.data.length })}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={connectionsQuery.isFetching}
              onClick={() => void connectionsQuery.refetch()}
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={connectionsQuery.isFetching ? 'animate-spin' : ''}
              />
              {t('refresh')}
            </Button>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {connectionsQuery.data.map((values, index) => (
              <li
                key={`${index}-${values.join('|')}`}
                className="rounded-2xl border border-border-default bg-surface-default/80 p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-surface-info-subtle p-2 text-text-info">
                    <Database size={18} aria-hidden="true" />
                  </span>
                  <h2 className="font-semibold text-text-primary">
                    {values[0] || t('connectionNumber', { number: index + 1 })}
                  </h2>
                </div>
                {values.length ? (
                  <ol className="mt-4 space-y-2">
                    {values.map((value, valueIndex) => (
                      <li
                        key={`${valueIndex}-${value}`}
                        className="flex min-w-0 flex-wrap gap-x-2 rounded-lg bg-surface-raised px-3 py-2 text-sm"
                      >
                        <span className="shrink-0 text-text-secondary">
                          {t('valueNumber', { number: valueIndex + 1 })}
                        </span>
                        <span className="break-all text-text-primary">{value}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-text-secondary">{t('emptyEntry')}</p>
                )}
                {values[0] ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <CreateConsumerAction connectorName={values[0]} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={configMutation.isPending}
                      onClick={() => void retrieveConfig(values[0]).catch(() => undefined)}
                    >
                      <Settings2 size={15} aria-hidden="true" />
                      {configMutation.isPending ? t('retrieving') : t('retrieveConfig')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => removeConnection(values[0])}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {t('delete')}
                    </Button>
                  </div>
                ) : null}
                {values[0] && Object.prototype.hasOwnProperty.call(configs, values[0]) ? (
                  <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-surface-raised p-3 text-xs text-text-primary">
                    {JSON.stringify(configs[values[0]], null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
