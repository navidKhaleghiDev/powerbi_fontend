import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import {
  createKpiDashboard,
  getKpiAvailableTables,
  listKpiDashboards,
} from '@/features/kpis/api/kpi-api';
import {
  isValidChart,
  newChart,
  toKpiChart,
  type ChartDraft,
} from '@/features/kpis/lib/chart-draft';
import {
  createDashboardFormSchema,
  type DashboardFormValues,
} from '@/features/kpis/lib/dashboard-form-schema';
import { KpiChartEditor } from '@/features/kpis/organisms/KpiChartEditor';
import { Button } from '@/shared/ui/atoms/button/button';
import { Input } from '@/shared/ui/atoms/input/input';

export const KpiDashboardsPage = () => {
  const t = useTranslations('kpis');
  const locale = useLocale();
  const navigate = useNavigate();
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DashboardFormValues>({
    resolver: zodResolver(createDashboardFormSchema(t('required'), t('invalid'))),
    defaultValues: { title: '', description: '' },
  });
  const title = useWatch({ control, name: 'title' });
  const [charts, setCharts] = useState<ChartDraft[]>([]);
  const dashboards = useQuery({
    queryKey: ['kpi-dashboards'],
    queryFn: ({ signal }) => listKpiDashboards(signal),
  });
  const tables = useQuery({
    queryKey: ['kpi-tables'],
    queryFn: ({ signal }) => getKpiAvailableTables(signal),
  });
  const create = useMutation({
    mutationFn: (values: DashboardFormValues) =>
      createKpiDashboard({
        title: values.title,
        description: values.description,
        charts: charts.map(toKpiChart),
      }),
    onSuccess: (dashboard) => {
      void client.invalidateQueries({ queryKey: ['kpi-dashboards'] });
      void navigate({
        to: '/$locale/kpis/$dashboardId',
        params: { locale, dashboardId: String(dashboard.id) },
      });
    },
  });
  return (
    <section className="kpi-management-page mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <section className="kpi-management-panel space-y-3">
        <h2 className="text-xl font-semibold">{t('savedDashboards')}</h2>
        {dashboards.isPending && <p role="status">{t('loading')}</p>}
        {dashboards.isError && <p role="alert">{dashboards.error.message}</p>}
        {dashboards.data?.length === 0 && <p>{t('noDashboards')}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {dashboards.data?.map((dashboard) => (
            <Link
              key={dashboard.id}
              to="/$locale/kpis/$dashboardId"
              params={{ locale, dashboardId: String(dashboard.id) }}
              className="kpi-dashboard-link rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400"
            >
              <strong>{dashboard.title}</strong>
              <p className="text-sm text-slate-600">{dashboard.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <form
        className="kpi-management-panel space-y-4"
        noValidate
        onSubmit={handleSubmit((values) => {
          if (charts.length && charts.every(isValidChart)) create.mutate(values);
        })}
      >
        <h2 className="text-xl font-semibold">{t('createDashboard')}</h2>
        <label className="grid gap-1 text-sm">
          {t('dashboardTitle')}
          <Input maxLength={100} aria-invalid={!!errors.title} {...register('title')} />
          {errors.title && <span role="alert">{errors.title.message}</span>}
        </label>
        <label className="grid gap-1 text-sm">
          {t('dashboardDescription')}
          <Input {...register('description')} />
        </label>
        {tables.isPending && <p role="status">{t('loadingTables')}</p>}
        {tables.isError && <p role="alert">{tables.error.message}</p>}
        {tables.data?.length === 0 && <p>{t('noTables')}</p>}
        {charts.map((chart) => (
          <KpiChartEditor
            key={chart.id}
            chart={chart}
            tables={tables.data ?? []}
            onChange={(updated) =>
              setCharts((items) => items.map((item) => (item.id === updated.id ? updated : item)))
            }
            onRemove={() => setCharts((items) => items.filter((item) => item.id !== chart.id))}
          />
        ))}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!tables.data?.length}
            onClick={() => setCharts((items) => [...items, newChart()])}
          >
            {t('addChart')}
          </Button>
          <Button
            disabled={
              create.isPending || !title.trim() || !charts.length || !charts.every(isValidChart)
            }
          >
            {t('saveDashboard')}
          </Button>
        </div>
        {create.isError && <p role="alert">{create.error.message}</p>}
      </form>
    </section>
  );
};
