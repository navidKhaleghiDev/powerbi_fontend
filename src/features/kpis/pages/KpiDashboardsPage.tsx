import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
import { KpiChartEditor } from '@/features/kpis/organisms/KpiChartEditor';
import { Button } from '@/shared/components/atoms/button';
import { Input } from '@/shared/components/atoms/input';

export const KpiDashboardsPage = () => {
  const t = useTranslations('kpis');
  const locale = useLocale();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    mutationFn: () =>
      createKpiDashboard({
        title: title.trim(),
        description: description.trim(),
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
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <section className="space-y-3">
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
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400"
            >
              <strong>{dashboard.title}</strong>
              <p className="text-sm text-slate-600">{dashboard.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && charts.length && charts.every(isValidChart)) create.mutate();
        }}
      >
        <h2 className="text-xl font-semibold">{t('createDashboard')}</h2>
        <label className="grid gap-1 text-sm">
          {t('dashboardTitle')}
          <Input
            required
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          {t('dashboardDescription')}
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <div className="flex gap-3">
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
    </main>
  );
};
