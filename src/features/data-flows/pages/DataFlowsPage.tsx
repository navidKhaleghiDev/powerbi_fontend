import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Database,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import {
  deleteConnector,
  getCdcConnections,
  getConnectorConfig,
} from '@/features/data-flows/api/data-flow-api';
import { CreateConsumerAction } from '@/features/data-flows/molecules/CreateConsumerAction';
import { Button, buttonVariants } from '@/shared/components/atoms/button';
import { IconTooltip } from '@/shared/components/molecules/icon-tooltip';

export const DataFlowsPage = () => {
  const t = useTranslations('cdcConnections');
  const analytics = useTranslations('analytics');
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
    // The destructive action requires an explicit, synchronous user confirmation.
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('confirmDelete', { name }))) return;
    void deleteMutation.mutateAsync(name).catch(() => undefined);
  };

  return (
    <section
      className="cdc-connections-page flex w-full flex-col gap-5 p-5 md:p-8"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
            <Database size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-blue-700">{t('eyebrow')}</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{t('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconTooltip label={analytics('titleDashboard')}>
            <Link
              to="/$locale/dashboard"
              params={{ locale }}
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
            >
              <LayoutDashboard aria-hidden="true" />
            </Link>
          </IconTooltip>
          <Link
            to="/$locale/cdc-connections/new"
            params={{ locale }}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
          >
            <Plus size={16} aria-hidden="true" />
            {t('create')}
          </Link>
        </div>
      </header>

      {connectionsQuery.isPending ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-600">
          {t('loading')}
        </div>
      ) : connectionsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-300 bg-white/80 p-6">
          <p className="text-sm text-red-700">{t('error')}</p>
          <Button type="button" variant="outline" onClick={() => void connectionsQuery.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('retry')}
          </Button>
        </div>
      ) : connectionsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-14 text-center">
          <Database className="mx-auto text-slate-600" size={34} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{t('emptyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">{t('emptyHelp')}</p>
          <Link
            to="/$locale/cdc-connections/new"
            params={{ locale }}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
          >
            {t('create')}
            {isPersian ? <ArrowRight className="rotate-180" size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <p>{t('count', { count: connectionsQuery.data.length })}</p>
            <IconTooltip label={t('refresh')}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={connectionsQuery.isFetching}
                onClick={() => void connectionsQuery.refetch()}
              >
                <RefreshCw
                  size={15}
                  aria-hidden="true"
                  className={connectionsQuery.isFetching ? 'animate-spin' : ''}
                />
              </Button>
            </IconTooltip>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
            <table className="w-full min-w-[52rem] text-start text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('table.name')}</th>
                  <th className="px-5 py-3 font-medium">{t('table.details')}</th>
                  <th className="px-5 py-3 font-medium">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {connectionsQuery.data.map((values, index) => {
                  const name = values[0];
                  const hasConfig = Boolean(
                    name && Object.prototype.hasOwnProperty.call(configs, name),
                  );

                  return (
                    <Fragment key={values.join('|')}>
                      <tr className="border-t border-slate-200 align-top">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                              <Database size={18} aria-hidden="true" />
                            </span>
                            <span className="font-semibold text-slate-900">
                              {name || t('connectionNumber', { number: index + 1 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {values.length > 1 ? (
                            <div className="flex max-w-xl flex-wrap gap-2">
                              {values.slice(1).map((value) => (
                                <span
                                  key={value}
                                  className="max-w-full rounded-md bg-slate-50 px-2.5 py-1 break-all text-slate-900"
                                >
                                  {value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600">{t('noAdditionalDetails')}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {name ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <CreateConsumerAction connectorName={name} />
                              <IconTooltip
                                label={
                                  configMutation.isPending ? t('retrieving') : t('retrieveConfig')
                                }
                              >
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  disabled={configMutation.isPending}
                                  onClick={() => void retrieveConfig(name).catch(() => undefined)}
                                >
                                  <Settings2 size={15} aria-hidden="true" />
                                </Button>
                              </IconTooltip>
                              <IconTooltip label={t('delete')}>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => removeConnection(name)}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </Button>
                              </IconTooltip>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                      {name && hasConfig ? (
                        <tr key={`${name}-config`} className="border-t border-slate-200">
                          <td colSpan={3} className="px-5 py-4">
                            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-900">
                              {JSON.stringify(configs[name], null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
