import { useNavigate, useSearch } from '@tanstack/react-router';
import { useLocale, useTranslations } from 'use-intl';

import { useWorkspace } from '@/hooks/useWorkspace';
import { configurationSection, type ConfigurationSection } from '@/lib/flows/navigation';
import { LoadingSkelton } from '@uiShare/molecules/Loading/LoadingSkeleton';

import { DataBrowser } from './DataBrowser';
import { FlowDesigner } from './FlowDesigner';
import { FlowList } from './FlowList';
import { Notice } from './FormParts';
import { MetricCatalogPanel } from './MetricCatalogPanel';
import { PipelineOverview } from './PipelineOverview';
import { PostgresSources } from './PostgresSources';

export const ConfigurationPanel = () => {
  const t = useTranslations('studio');
  const workspace = useWorkspace();
  const locale = useLocale();
  const navigate = useNavigate();
  const search = useSearch({ from: '/$locale' });
  const step = configurationSection(search.section ?? null);
  const setStep = (section: ConfigurationSection) =>
    navigate({
      to: '/$locale/data-platform',
      params: { locale },
      search: { section },
      resetScroll: false,
    });
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  const state = workspace.data;
  return (
    <div className="w-full min-w-0 space-y-7">
      {state.flows.some((flow) => flow.sampleData) && (
        <p
          role="status"
          className="rounded-xl border border-border-warning bg-surface-warning-subtle p-4 text-sm text-text-warning"
        >
          {t('sampleDataNotice')}
        </p>
      )}
      <section id="configuration-content" aria-label={t(step)} className="min-w-0 space-y-6">
        {step === 'overview' && (
          <>
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
