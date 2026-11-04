import { ArrowUpRight, Check, ChevronRight, Database, GitBranch, Layers3 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ConfigurationSection } from '@/lib/flows/navigation';
import type { WorkspaceState } from '@/lib/flows/types';

export type { ConfigurationSection } from '@/lib/flows/navigation';

interface Props {
  state: WorkspaceState;
  onNavigate: (section: ConfigurationSection) => void;
}

export const WorkspaceJourney = ({ state, onNavigate }: Props) => {
  const t = useTranslations('studio');
  const steps = [
    {
      id: 'source',
      section: 'sources',
      icon: Database,
      complete: state.connections.length > 0 || state.flows.some((flow) => flow.kind === 'csv'),
    },
    { id: 'mapping', section: 'mapping', icon: GitBranch, complete: state.flows.length > 0 },
    {
      id: 'publication',
      section: 'flows',
      icon: Layers3,
      complete: state.flows.some((flow) => !!flow.activeLoadId),
    },
  ] as const;

  return (
    <section className="snapshot-card snapshot-journey" aria-labelledby="journey-title">
      <header className="snapshot-card-header">
        <h2 id="journey-title">{t('design.setupTitle')}</h2>
        <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </header>
      <ol>
        {steps.map((step) => (
          <li key={step.id}>
            <button type="button" onClick={() => onNavigate(step.section)}>
              <span className={`snapshot-step-icon ${step.complete ? 'is-complete' : ''}`}>
                {step.complete ? (
                  <Check size={17} aria-hidden="true" />
                ) : (
                  <step.icon size={17} strokeWidth={1.5} aria-hidden="true" />
                )}
              </span>
              <span>
                <strong>{t(`experience.journey.${step.id}.label`)}</strong>
                <small>{t(step.complete ? 'experience.recorded' : 'design.notConfigured')}</small>
              </span>
              <ChevronRight
                className="snapshot-step-chevron"
                size={15}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ol>
      <p className="snapshot-journey-note">{t('design.setupHelp')}</p>
    </section>
  );
};
