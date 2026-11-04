
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useTranslations } from "use-intl";

import type { WorkspaceState } from "@/lib/flows/types";

import { buttonClass, secondaryClass } from "./FormParts";

export type { ConfigurationSection } from "@/lib/flows/navigation";
import type { ConfigurationSection } from "@/lib/flows/navigation";

interface Props {
  state: WorkspaceState;
  onNavigate: (section: ConfigurationSection) => void;
}

export const WorkspaceJourney = ({ state, onNavigate }: Props) => {
  const t = useTranslations("studio");
  const realFlows = state.flows.filter((flow) => !flow.sampleData);
  const steps: { key: string; section: ConfigurationSection; complete: boolean }[] = [
    {
      key: "source", section: "sources",
      complete: state.connections.length > 0 || realFlows.some((flow) => flow.kind === "csv"),
    },
    { key: "mapping", section: "mapping", complete: realFlows.length > 0 },
    { key: "publication", section: "flows", complete: realFlows.some((flow) => !!flow.activeLoadId) },
  ];
  const next = steps.find((step) => !step.complete);
  const failed = realFlows.filter((flow) => flow.status === "failed" || !!flow.error).length;

  return (
    <Card role="region" aria-labelledby="journey-title" className="glass-surface gap-0 py-0 overflow-hidden rounded-2xl border">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">{t("experience.getStarted")}</p>
          <h2 id="journey-title" className="mt-2 text-base font-medium text-slate-900">
            {t(next ? `experience.journey.${next.key}.title` : "experience.journey.completeTitle")}
          </h2>
          <p className="mt-2 text-[13px] leading-7 text-slate-600">
            {t(next ? `experience.journey.${next.key}.help` : "experience.journey.completeHelp")}
          </p>
        </div>
        <Button variant="ghost" size="auto" type="button" className={buttonClass} onClick={() => onNavigate(failed ? "flows" : next?.section || "metrics")}>
          {t(failed ? "experience.reviewFlows" : next ? "experience.continueSetup" : "metric.chooseKpis")}
        </Button>
      </div>
      <ol className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        {steps.map((step, index) => (
          <li key={step.key}>
            <Button variant="ghost" size="auto" type="button" onClick={() => onNavigate(step.section)} className="flex w-full items-start gap-3 rounded-xl p-2 text-start transition-colors hover:bg-slate-50">
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${step.complete ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-500"}`}>
                {step.complete ? "✓" : index + 1}
              </span>
              <span>
                <span className="block text-[13px] font-medium text-slate-900">{t(`experience.journey.${step.key}.label`)}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{t(step.complete ? "experience.recorded" : "experience.needsSetup")}</span>
              </span>
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-6 text-slate-600">
        <p>{t("experience.setupEvidence")}</p>
        {!state.connections.length && !realFlows.length && (
          <Button variant="ghost" size="auto" type="button" className={secondaryClass} onClick={() => onNavigate("mapping")}>{t("experience.useCsv")}</Button>
        )}
      </div>
    </Card>
  );
};
