import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestErrorCode, useWorkspaceAction } from '@/hooks/useWorkspace';

import { Field, Notice, buttonClass, inputClass, secondaryClass } from './FormParts';

import type { PostgresConnection, PublicConnection } from '@/lib/flows/types';

interface Props {
  connections: PublicConnection[];
}
export const PostgresSources = ({ connections }: Props) => {
  const t = useTranslations('studio');
  const [toast, setToast] = useState<{
    message: string;
    kind: 'success' | 'error' | 'pending';
  } | null>(null);
  useEffect(() => {
    if (!toast || toast.kind === 'pending') return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  const showError = (error: unknown, name?: string) => {
    const code = requestErrorCode(error);
    const message = t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.requestFailed');
    setToast({ kind: 'error', message: name ? `${name}: ${message}` : message });
  };
  const save = useWorkspaceAction();
  const test = useWorkspaceAction<{ walLevel: string }>();
  const testedConnectionId = (test.variables?.body as { connectionId?: string } | undefined)
    ?.connectionId;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Omit<PostgresConnection, 'id'>>({
    defaultValues: { port: 5432, ssl: false, password: '' },
  });
  return (
    <section className="space-y-5">
      {toast && (
        <div
          className={`fixed end-6 bottom-6 z-50 flex max-w-[calc(100vw-3rem)] items-start gap-4 rounded-xl border p-4 shadow-lg ${toast.kind === 'error' ? 'border-border-warning bg-surface-warning-subtle text-text-warning' : toast.kind === 'success' ? 'border-border-success bg-surface-success-subtle text-text-success' : 'border-border-default bg-surface-default text-text-primary'}`}
        >
          <p role={toast.kind === 'error' ? 'alert' : 'status'} className="text-sm">
            {toast.message}
          </p>
          <Button
            variant="ghost"
            size="auto"
            type="button"
            aria-label={t('dismissNotification')}
            onClick={() => setToast(null)}
            className="rounded px-1 focus-visible:outline-2"
          >
            ×
          </Button>
        </div>
      )}
      <div>
        <h2 className="text-base font-medium tracking-tight text-text-primary">
          {t('postgresSources')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{t('postgresHelp')}</p>
      </div>
      {!connections.length && (
        <p className="rounded-xl border border-dashed border-border-default bg-surface-default p-5 text-sm leading-7 text-text-secondary">
          {t('experience.sourceEmpty')}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {connections.map((connection) => (
          <article
            key={connection.id}
            className="glass-surface rounded-2xl border border-border-default bg-surface-default p-5 shadow-sm"
          >
            <h3 className="font-medium">{connection.name}</h3>
            <p dir="ltr" className="mt-2 text-sm break-all text-text-secondary">
              {connection.host}:{connection.port} / {connection.database}
            </p>
            <Button
              variant="ghost"
              size="auto"
              className={`${secondaryClass} mt-4`}
              type="button"
              disabled={test.isPending || save.isPending}
              onClick={() => {
                setToast({ kind: 'pending', message: `${connection.name}: ${t('working')}` });
                test.mutate(
                  {
                    path: 'test/postgres',
                    body: { connectionId: connection.id },
                  },
                  {
                    onSuccess: () =>
                      setToast({
                        kind: 'success',
                        message: `${connection.name}: ${t('testSucceeded')}`,
                      }),
                    onError: (error) => showError(error, connection.name),
                  },
                );
              }}
            >
              {test.isPending && testedConnectionId === connection.id
                ? t('working')
                : t('testSource')}
            </Button>
            {testedConnectionId === connection.id && (
              <div aria-live="polite" aria-busy={test.isPending}>
                <Notice error={test.error} success={test.isSuccess} text={t('testSucceeded')} />
                {test.isSuccess && test.data.walLevel && (
                  <p
                    className={`mt-3 rounded-xl p-3 text-sm ${test.data.walLevel === 'logical' ? 'bg-surface-success-subtle text-text-success' : 'bg-surface-warning-subtle text-text-warning'}`}
                  >
                    {test.data.walLevel === 'logical' ? t('walReady') : t('walRequired')}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <form
        className="glass-surface rounded-2xl border border-border-default bg-surface-default p-5 shadow-sm"
        onSubmit={handleSubmit(
          (values) => {
            setToast({ kind: 'pending', message: t('working') });
            save.mutate(
              { path: 'connections', body: values },
              {
                onError: (error) => showError(error),
                onSuccess: () => {
                  setToast({ kind: 'success', message: t('saved') });
                  reset({
                    port: 5432,
                    ssl: false,
                    password: '',
                    name: '',
                    host: '',
                    database: '',
                    user: '',
                  });
                },
              },
            );
          },
          () => setToast({ kind: 'error', message: t('errors.invalid') }),
        )}
      >
        <h3 className="mb-4 font-medium">{t('addPostgres')}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(['name', 'host', 'database', 'user', 'password'] as const).map((field) => (
            <Field
              key={field}
              label={t(field === 'user' ? 'username' : field)}
              error={errors[field] ? t('errors.invalid') : undefined}
            >
              <Input
                className={inputClass}
                type={field === 'password' ? 'password' : 'text'}
                autoComplete={field === 'password' ? 'new-password' : 'off'}
                {...register(field, { required: field !== 'password' })}
              />
            </Field>
          ))}
          <Field label={t('port')} error={errors.port ? t('errors.invalid') : undefined}>
            <Input
              type="number"
              className={inputClass}
              {...register('port', {
                valueAsNumber: true,
                required: true,
                min: 1,
                max: 65535,
              })}
            />
          </Field>
        </div>
        <label className="my-4 flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('ssl')} />
          {t('requireTls')}
        </label>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mb-3 text-sm text-text-warning">
            {t('errors.invalid')}
          </p>
        )}
        <Button
          variant="default"
          size="auto"
          className={buttonClass}
          disabled={save.isPending || test.isPending}
        >
          {save.isPending ? t('working') : t('saveConnection')}
        </Button>
      </form>
      <Notice error={save.error} success={save.isSuccess} />
    </section>
  );
};
