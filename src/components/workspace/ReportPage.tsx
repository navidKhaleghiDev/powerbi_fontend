import { useSearch } from '@tanstack/react-router';

import { AnalyticsPanel } from './AnalyticsPanel';

export const ReportPage = () => {
  const { report } = useSearch({ from: '/$locale' });
  return <AnalyticsPanel key={report || 'new'} initialReportId={report || undefined} />;
};
