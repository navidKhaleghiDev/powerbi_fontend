import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  Database,
  FileChartColumn,
  GitBranch,
  Layers3,
  Plus,
  Table2,
} from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { WorkspaceJourney } from './WorkspaceJourney';

import type { ConfigurationSection } from '@/lib/flows/navigation';
import type { WorkspaceState } from '@/lib/flows/types';

const WarehouseChart = lazy(() =>
  import('./WarehouseChart').then((module) => ({ default: module.WarehouseChart })),
);

interface Props {
  state: WorkspaceState;
  onOpenData: () => void;
  onNavigate: (section: ConfigurationSection) => void;
}

const SnapshotCard = ({
  title,
  help,
  children,
  className = '',
  action,
}: {
  title: string;
  help: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) => (
  <section className={`snapshot-card ${className}`}>
    <header className="snapshot-card-header">
      <h2>{title}</h2>
      {action || (
        <span className="snapshot-help" role="img" aria-label={help} title={help}>
          <CircleHelp size={14} aria-hidden="true" />
        </span>
      )}
    </header>
    {children}
  </section>
);

const EmptyPlot = ({
  kind,
  title,
  description,
  action,
}: {
  kind: 'line' | 'bar';
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className={`snapshot-empty-plot snapshot-empty-plot-${kind}`}>
    <div className="snapshot-empty-copy">
      {kind === 'line' ? (
        <ChartNoAxesCombined size={30} strokeWidth={1.25} aria-hidden="true" />
      ) : (
        <Database size={28} strokeWidth={1.25} aria-hidden="true" />
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  </div>
);

export const PipelineOverview = ({ state, onOpenData, onNavigate }: Props) => {
  const t = useTranslations('studio');
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const published = state.flows.filter((flow) => !!flow.activeLoadId);
  const reports = state.reports.filter((report) => !!report.publishedAt);
  const summary = [
    { key: 'sources', count: state.connections.length, icon: Database, tone: 'blue' },
    { key: 'flows', count: state.flows.length, icon: GitBranch, tone: 'green' },
    { key: 'reports', count: reports.length, icon: FileChartColumn, tone: 'rose' },
  ] as const;
  const total = summary.reduce((count, item) => count + item.count, 0);
  const days = new Map<string, number>();
  for (const run of state.runs) {
    if (run.status !== 'published' || !Number.isFinite(Date.parse(run.createdAt))) continue;
    const day = run.createdAt.slice(0, 10);
    days.set(day, (days.get(day) || 0) + 1);
  }
  const activity = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
  const sourceRows = state.connections.map((connection) => ({
    label: connection.name,
    value: state.flows.filter((flow) => flow.connectionId === connection.id).length,
  }));
  const distribution = ['draft', 'capture_started', 'published', 'failed']
    .map((status) => ({
      label: t(`status.${status}`),
      value: state.flows.filter((flow) => flow.status === status).length,
    }))
    .filter((row) => row.value > 0);

  return (
    <div className="snapshot-overview">
      <section className="snapshot-summary" aria-label={t('design.workspaceSummary')}>
        <div className="snapshot-composition">
          <div className="snapshot-legend">
            {summary.map((item) => (
              <span key={item.key}>
                <i data-tone={item.tone} />
                {t(`design.counts.${item.key}`)}
              </span>
            ))}
          </div>
          <div
            className="snapshot-composition-track"
            aria-label={t('design.recordCount', { count: total })}
          >
            {total > 0 ? (
              summary
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span key={item.key} data-tone={item.tone} style={{ flexGrow: item.count }} />
                ))
            ) : (
              <span className="snapshot-composition-empty">{t('design.noWorkspaceRecords')}</span>
            )}
          </div>
        </div>
        <div className="snapshot-stats">
          {summary.map((item) => (
            <div className="snapshot-stat" key={item.key}>
              <div>
                <item.icon size={17} strokeWidth={1.25} aria-hidden="true" />
                <strong>{number.format(item.count)}</strong>
              </div>
              <span>{t(`design.counts.${item.key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="snapshot-chart-row">
        <SnapshotCard
          title={t('design.activityTitle')}
          help={t('design.activityHelp')}
          className="snapshot-card-wide"
        >
          <div className="snapshot-card-toolbar">
            <span>
              <i className="snapshot-legend-dot" />
              {t('design.publishedRuns')}
            </span>
            <span>{t('design.workspaceRecords')}</span>
          </div>
          {activity.length > 0 ? (
            <Suspense fallback={<LoadingSkelton isLoading className="h-48" />}>
              <WarehouseChart kind="line" title={t('design.activityTitle')} rows={activity} />
            </Suspense>
          ) : (
            <EmptyPlot
              kind="line"
              title={t('design.noActivity')}
              description={t('design.noActivityHelp')}
              action={
                <button
                  type="button"
                  className="snapshot-text-button"
                  onClick={() => onNavigate('mapping')}
                >
                  {t('design.previewCsv')}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              }
            />
          )}
        </SnapshotCard>
        <SnapshotCard title={t('design.sourcesTitle')} help={t('design.sourcesHelp')}>
          {sourceRows.length > 0 ? (
            <Suspense fallback={<LoadingSkelton isLoading className="h-48" />}>
              <WarehouseChart kind="bar" title={t('design.sourcesTitle')} rows={sourceRows} />
            </Suspense>
          ) : (
            <EmptyPlot
              kind="bar"
              title={t('design.noSources')}
              description={t('design.noSourcesHelp')}
            />
          )}
        </SnapshotCard>
        <SnapshotCard title={t('design.distributionTitle')} help={t('design.distributionHelp')}>
          {distribution.length > 0 ? (
            <Suspense fallback={<LoadingSkelton isLoading className="h-48" />}>
              <WarehouseChart
                kind="pie"
                title={t('design.distributionTitle')}
                rows={distribution}
              />
            </Suspense>
          ) : (
            <div className="snapshot-empty-distribution">
              <div className="snapshot-ring">
                <strong>{number.format(state.flows.length)}</strong>
                <span>{t('design.counts.flows')}</span>
              </div>
              <p>{t('design.noDistribution')}</p>
            </div>
          )}
        </SnapshotCard>
      </div>

      <div className="snapshot-bottom-row">
        <WorkspaceJourney state={state} onNavigate={onNavigate} />
        <SnapshotCard
          title={t('design.datasetSummary')}
          help={t('design.datasetSummaryHelp')}
          className="snapshot-dataset-card"
          action={
            <button type="button" className="snapshot-text-button" onClick={onOpenData}>
              {t('design.viewData')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          }
        >
          <div className="snapshot-table-scroll">
            <table className="snapshot-table">
              <thead>
                <tr>
                  <th scope="col">{t('design.datasetName')}</th>
                  <th scope="col">{t('design.datasetSource')}</th>
                  <th scope="col">{t('design.datasetStatus')}</th>
                  <th scope="col">{t('rows')}</th>
                </tr>
              </thead>
              <tbody>
                {state.flows.length > 0 ? (
                  state.flows.map((flow) => (
                    <tr key={flow.id}>
                      <th scope="row">{flow.name}</th>
                      <td>{flow.kind === 'csv' ? 'CSV' : 'PostgreSQL'}</td>
                      <td>
                        <span
                          className={`snapshot-status ${flow.status === 'published' ? 'is-published' : ''}`}
                        >
                          {t(`status.${flow.status}`)}
                        </span>
                      </td>
                      <td>{flow.rowCount === undefined ? '—' : number.format(flow.rowCount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="snapshot-empty-table">
                        <Table2 size={25} strokeWidth={1.25} aria-hidden="true" />
                        <div>
                          <strong>{t('design.noDatasets')}</strong>
                          <p>{t('design.noDatasetsHelp')}</p>
                        </div>
                        <button
                          type="button"
                          className="snapshot-small-button"
                          onClick={() => onNavigate('mapping')}
                        >
                          <Plus size={14} aria-hidden="true" />
                          {t('design.createFlow')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="snapshot-card-footer">
            <span>
              <Layers3 size={13} aria-hidden="true" />
              {t('design.datasetCount', { count: published.length })}
            </span>
            <span>{t('design.frontendLabel')}</span>
          </footer>
        </SnapshotCard>
      </div>
    </div>
  );
};
