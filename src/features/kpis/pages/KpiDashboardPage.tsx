import { useQuery } from '@tanstack/react-query';
import { Link, notFound, useParams } from '@tanstack/react-router';
import { useLocale, useTranslations } from 'use-intl';

import { getKpiDashboard, querySavedKpiChart, type KpiChart } from '@/features/kpis/api/kpi-api';
import { KpiResultView } from '@/features/kpis/organisms/KpiResultView';

const SavedChart = ({ chart }: { chart: KpiChart }) => {
  const t = useTranslations('kpis');
  const result = useQuery({
    queryKey: ['kpi-chart', chart.id],
    queryFn: ({ signal }) => querySavedKpiChart(chart.id, chart.limit, signal),
  });
  return (
    <section className="min-h-64 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-4 font-semibold">{chart.title}</h2>
      {result.isPending && <p role="status">{t('loading')}</p>}
      {result.isError && <p role="alert">{result.error.message}</p>}
      {result.data && (
        <KpiResultView result={result.data} title={chart.title} kind={chart.chart_type} />
      )}
    </section>
  );
};

export const KpiDashboardPage = () => {
  const { dashboardId } = useParams({ from: '/$locale/kpis/$dashboardId' });
  const id = Number(dashboardId);
  if (!Number.isSafeInteger(id) || id < 1) {
    // TanStack Router uses this thrown value to render the route's 404 boundary.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }
  const t = useTranslations('kpis');
  const locale = useLocale();
  const dashboard = useQuery({
    queryKey: ['kpi-dashboard', id],
    queryFn: ({ signal }) => getKpiDashboard(id, signal),
  });
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <Link to="/$locale/kpis" params={{ locale }} className="text-sm underline">
        {t('backToDashboards')}
      </Link>
      {dashboard.isPending && <p role="status">{t('loading')}</p>}
      {dashboard.isError && <p role="alert">{dashboard.error.message}</p>}
      {dashboard.data && (
        <>
          <header>
            <h1 className="text-2xl font-semibold">{dashboard.data.title}</h1>
            <p>{dashboard.data.description}</p>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.data.charts.map((chart) => (
              <SavedChart key={chart.id} chart={chart} />
            ))}
          </div>
        </>
      )}
    </main>
  );
};
