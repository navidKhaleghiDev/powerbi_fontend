import { useSearchParams } from 'react-router';
import { useLocale } from 'use-intl';

import { AnalyticsPanel } from './AnalyticsPanel';
import { WorkspaceRedirect } from './WorkspaceRedirect';

export const ReportPage = ({ redirect = false }: { redirect?: boolean }) => {
  const locale = useLocale();
  const [search] = useSearchParams();
  const report = search.get('report');
  if (redirect)
    return (
      <WorkspaceRedirect
        href={`/${locale}/analytics/reports${report ? `?report=${encodeURIComponent(report)}` : ''}`}
      />
    );
  return <AnalyticsPanel key={report || 'new'} initialReportId={report || undefined} />;
};
