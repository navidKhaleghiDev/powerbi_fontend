import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

import { buttonClass, secondaryClass } from './FormParts';

import type { ConfigurationSection } from './WorkspaceJourney';
import type { WorkspaceState } from '@/lib/flows/types';

interface Props {
  state: WorkspaceState;
  onOpenData: () => void;
  onNavigate: (section: ConfigurationSection) => void;
}
export const PipelineOverview = ({ state, onOpenData, onNavigate }: Props) => {
  const t = useTranslations('studio');
  const published = state.flows.filter((flow) => !!flow.activeLoadId);
  const reports = state.reports.filter((report) => !!report.publishedAt);
  const captured = state.flows.filter((flow) => !!flow.connectorName);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">{t('pipeline.title')}</h2>
        <p className="mt-2 text-[13px] leading-7 text-slate-500">{t('pipeline.description')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            key: 'sources',
            count: state.connections.length,
            ready: state.connections.length > 0,
          },
          {
            key: 'capture',
            count: captured.length,
            ready: captured.length > 0,
          },
          {
            key: 'published',
            count: published.length,
            ready: published.length > 0,
          },
          { key: 'reports', count: reports.length, ready: reports.length > 0 },
        ].map((item) => (
          <article
            key={item.key}
            className={`rounded-2xl border p-5 ${item.ready ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'}`}
          >
            <p className="text-[13px] font-medium">{t(`pipeline.${item.key}`)}</p>
            <p className="my-3 text-2xl font-medium">{item.count}</p>
            <p className="text-xs leading-6 text-slate-500">{t(`pipeline.${item.key}Help`)}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="default" size="auto" className={buttonClass} onClick={onOpenData}>
          {t('dataBrowser.title')}
        </Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">{t('pipeline.flows')}</h3>
          <Button
            variant="ghost"
            size="auto"
            type="button"
            className={secondaryClass}
            onClick={() => onNavigate(state.flows.length ? 'flows' : 'mapping')}
          >
            {t(state.flows.length ? 'experience.manageFlows' : 'experience.createFlow')}
          </Button>
        </div>
        {!state.flows.length ? (
          <p className="mt-3 text-[13px] leading-7 text-slate-500">{t('pipeline.noFlows')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {state.flows.map((flow) => (
              <li key={flow.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{flow.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{flow.grain}</p>
                </div>
                <div className="text-end">
                  <p className="text-[13px]">{t(`status.${flow.status}`)}</p>
                  {flow.activeLoadId && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t('publishedRows', { count: flow.rowCount || 0 })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
