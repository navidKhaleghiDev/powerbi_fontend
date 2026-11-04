import { useNavigate, useSearchParams } from 'react-router';
import { useLocale, useTranslations } from 'use-intl';

import { useWorkspace } from '@/hooks/useWorkspace';
import { configurationSection, type ConfigurationSection } from '@/lib/flows/navigation';
import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { DataBrowser } from './DataBrowser';
import { FlowDesigner } from './FlowDesigner';
import { FlowList } from './FlowList';
import { Notice } from './FormParts';
import { MetricCatalogPanel } from './MetricCatalogPanel';
import { PageHeading } from './PageHeading';
import { PipelineOverview } from './PipelineOverview';
import { PostgresSources } from './PostgresSources';
import { WorkspaceJourney } from './WorkspaceJourney';

export const ConfigurationPanel = () => {
  const t = useTranslations('studio');
  const workspace = useWorkspace();
  const locale = useLocale();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const step = configurationSection(search.get('section'));
  const setStep = (section: ConfigurationSection) =>
    navigate(`/${locale}/data-platform?section=${section}`, { preventScrollReset: true });
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  const state = workspace.data;
  return (
    <div className="w-full min-w-0 space-y-7">
      {state.flows.some((flow) => flow.sampleData) && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900"
        >
          {t('sampleDataNotice')}
        </p>
      )}
      <PageHeading
        eyebrow={t('organizationWorkspace')}
        title={t('configurationTitle')}
        description={t('configurationDescription')}
      />
      <section id="configuration-content" aria-label={t(step)} className="min-w-0 space-y-6">
        {step === 'overview' && (
          <>
            <WorkspaceJourney state={state} onNavigate={setStep} />
            <PipelineOverview
              state={state}
              onOpenData={() => setStep('data')}
              onNavigate={setStep}
            />
          </>
        )}
        {step === 'data' && <DataBrowser state={state} />}
        {step === 'sources' && <PostgresSources connections={state.connections} />}
        {step === 'mapping' && <FlowDesigner connections={state.connections} />}
        {step === 'flows' && (
          <FlowList flows={state.flows} runs={state.runs} onCreate={() => setStep('mapping')} />
        )}
        {step === 'metrics' && <MetricCatalogPanel state={state} />}
      </section>
    </div>
  );
};
