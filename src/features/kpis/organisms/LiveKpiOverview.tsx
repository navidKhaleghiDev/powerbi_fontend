import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useLocale, useTranslations } from 'use-intl';

import {
  getKpiDashboard,
  listKpiDashboards,
  querySavedKpiChart,
} from '@/features/kpis/api/kpi-api';
import { KpiResultView } from '@/features/kpis/organisms/KpiResultView';
import { hasAccessToken } from '@/shared/network/api';

export const LiveKpiOverview = () => {
  const t = useTranslations('kpis');
  const locale = useLocale();
  const authenticated = hasAccessToken();
  const dashboards = useQuery({
    queryKey: ['kpi-dashboards'],
    queryFn: ({ signal }) => listKpiDashboards(signal),
    enabled: authenticated,
  });
  const firstId = dashboards.data?.[0]?.id;
  const first = useQuery({
    queryKey: ['kpi-dashboard', firstId],
    queryFn: ({ signal }) => getKpiDashboard(firstId ?? 0, signal),
    enabled: !!firstId,
  });
  const firstChart = first.data?.charts[0];
  const result = useQuery({
    queryKey: ['kpi-chart', firstChart?.id],
    queryFn: ({ signal }) => querySavedKpiChart(firstChart?.id ?? 0, firstChart?.limit, signal),
    enabled: !!firstChart,
  });
  return (
    <section
      className="m-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-label={t('title')}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t('title')}</h2>
        <Link to="/$locale/kpis" params={{ locale }} className="text-sm underline">
          {t('viewAll')}
        </Link>
      </div>
      {!authenticated && <p>{t('signInForLive')}</p>}
      {authenticated && dashboards.isPending && <p role="status">{t('loading')}</p>}
      {dashboards.isError && <p role="alert">{dashboards.error.message}</p>}
      {dashboards.data?.length === 0 && <p>{t('noDashboards')}</p>}
      {first.isError && <p role="alert">{first.error.message}</p>}
      {result.isPending && firstChart && <p role="status">{t('loading')}</p>}
      {result.isError && <p role="alert">{result.error.message}</p>}
      {result.data && firstChart && (
        <KpiResultView result={result.data} title={firstChart.title} kind={firstChart.chart_type} />
      )}
    </section>
  );
};
