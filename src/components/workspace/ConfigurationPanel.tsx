"use client";
import { useState } from "react";

import { useTranslations } from "next-intl";

import { useWorkspace } from "@/hooks/useWorkspace";
import { LoadingSkelton } from "@uiShare/molecules/Loading/LoadingSkeleton";

import { DataBrowser } from "./DataBrowser";
import { FlowDesigner } from "./FlowDesigner";
import { FlowList } from "./FlowList";
import { Notice } from "./FormParts";
import { InfrastructureForm } from "./InfrastructureForm";
import { MetricCatalogPanel } from "./MetricCatalogPanel";
import { PilotUsers } from "./PilotUsers";
import { PipelineOverview } from "./PipelineOverview";
import { PostgresSources } from "./PostgresSources";
export const ConfigurationPanel = () => {
  const t = useTranslations("studio");
  const workspace = useWorkspace();
  const [step, setStep] = useState<
    | "overview"
    | "data"
    | "infrastructure"
    | "sources"
    | "mapping"
    | "flows"
    | "metrics"
    | "users"
  >("overview");
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  const state = workspace.data;
  return (
    <div className="space-y-7">
      {state.flows.some(flow => flow.sampleData) && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("sampleDataNotice")}</p>}
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
          {t("organizationWorkspace")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {t("configurationTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {t("configurationDescription")}
        </p>
      </header>
      <div className="grid gap-3 rounded-2xl bg-slate-900 p-5 text-center text-sm text-white sm:grid-cols-4">
        {["sourceStage", "captureStage", "warehouseStage", "analysisStage"].map(
          (key, index) => (
            <div
              key={key}
              className="rounded-xl border border-slate-700 px-3 py-3"
            >
              <span className="me-2 text-teal-300">{index + 1}</span>
              {t(key)}
            </div>
          ),
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            "overview",
            "data",
            "infrastructure",
            "sources",
            "mapping",
            "flows",
            "metrics",
            "users",
          ] as const
        ).map((key, index) => (
          <button
            key={key}
            aria-pressed={step === key}
            onClick={() => setStep(key)}
            className={`rounded-2xl border p-4 text-start ${step === key ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-slate-200 bg-white hover:border-teal-300"}`}
          >
            <span className="text-xs text-slate-500">
              {t("step", { number: index + 1 })}
            </span>
            <p className="mt-1 font-semibold">{t(key)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {key === "sources"
                ? t("connectionCount", { count: state.connections.length })
                : key === "flows"
                  ? t("flowCount", { count: state.flows.length })
                  : t(key + "Hint")}
            </p>
          </button>
        ))}
      </div>
      {step === "overview" && (
        <PipelineOverview state={state} onOpenData={() => setStep("data")} />
      )}
      {step === "data" && <DataBrowser state={state} />}
      {step === "infrastructure" && (
        <InfrastructureForm settings={state.infrastructure} />
      )}{" "}
      {step === "sources" && (
        <PostgresSources connections={state.connections} />
      )}{" "}
      {step === "mapping" && <FlowDesigner connections={state.connections} />}{" "}
      {step === "flows" && <FlowList flows={state.flows} runs={state.runs} />}
      {step === "metrics" && <MetricCatalogPanel state={state} />}
      {step === "users" && (
        <PilotUsers
          users={state.users || []}
          currentUser={state.currentUser}
          audit={state.audit || []}
        />
      )}
    </div>
  );
};
