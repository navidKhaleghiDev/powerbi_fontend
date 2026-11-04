
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

import { useLocale, useTranslations } from "use-intl";

import {
  useConnectorStatus,
  useCsvImport,
  useFlowPlan,
  useWorkspaceAction,
} from "@/hooks/useWorkspace";
import type { DataFlow, ImportRun } from "@/lib/flows/types";

import { StatusBadge } from "./StatusBadge";
import { Field, inputClass, Notice, buttonClass, secondaryClass } from "./FormParts";
interface CardProps {
  flow: DataFlow;
}
const FlowCard = ({ flow }: CardProps) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const [showPlan, setShowPlan] = useState(false);
  const plan = useFlowPlan(flow.id, showPlan && flow.kind === "postgres");
  const status = useConnectorStatus(flow.id, !!flow.connectorName);
  const action = useWorkspaceAction();
  const upload = useCsvImport();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{flow.name}</h3>
          <p className="mt-1 text-[13px] text-slate-500">
            {t(flow.kind === "csv" ? "csvSource" : "postgresSource")} ·{" "}
            {flow.grain}
          </p>
        </div>
        <StatusBadge tone={flow.error || flow.status === "failed" ? "danger" : flow.activeLoadId ? "success" : flow.connectorName ? "warning" : "neutral"}>
          {t(`status.${flow.status}`)}
        </StatusBadge>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
        <span>{t("mappedColumns", { count: flow.columns.length })}</span>
        {flow.rowCount !== undefined && (
          <span>{t("publishedRows", { count: flow.rowCount })}</span>
        )}
        {flow.publishedAt && (
          <span>
            {t("publishedAt")}{" "}
            <time dateTime={flow.publishedAt}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(flow.publishedAt))}
            </time>
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {flow.kind === "postgres" ? (
          <>
            <Button variant="outline" size="auto"
              className={secondaryClass}
              aria-expanded={showPlan}
              onClick={() => setShowPlan((v) => !v)}
            >
              {t("reviewPlan")}
            </Button>
            <Button variant="default" size="auto"
              className={buttonClass}
              disabled={action.isPending}
              onClick={() =>
                action.mutate({ path: `flows/${flow.id}/capture`, body: {} })
              }
            >
              {action.isPending && action.variables?.path.endsWith("/capture") ? t("working") : t("startCapture")}
            </Button>
            <Button variant="outline" size="auto"
              className={secondaryClass}
              disabled={action.isPending || !flow.connectorName}
              onClick={() =>
                action.mutate({ path: `flows/${flow.id}/publish`, body: {} })
              }
            >
              {action.isPending && action.variables?.path.endsWith("/publish") ? t("working") : t("publishSnapshot")}
            </Button>
          </>
        ) : (
          <label className={secondaryClass + " cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-600"}>
            {upload.isPending ? t("working") : t("replaceCsv")}
            <Input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate({ flowId: flow.id, file });
              }}
            />
          </label>
        )}

      </div>
      {flow.kind === "postgres" && (
        <p className="mt-3 text-xs text-slate-500">{t("captureHelp")}</p>
      )}
      {status.data?.connector && (
        <p className="mt-3 text-[13px]">
          {t("connectorStatus")} <b dir="ltr">{status.data.connector}</b>
          {status.data.tasks.map((task) => (
            <span key={task.id} className="ms-3" dir="ltr">
              {task.id}: {task.state}
            </span>
          ))}
        </p>
      )}
      {showPlan && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-slate-500">{t("reviewHelp")}</p>
          {plan.isPending ? (
            <p>{t("working")}</p>
          ) : (
            <pre
              dir="ltr"
              className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-teal-100"
            >
              {plan.data?.sql.join(";\n\n")}
            </pre>
          )}
        </div>
      )}
      <Notice
        error={action.error || upload.error || plan.error || status.error}
        success={action.isSuccess || upload.isSuccess}
        text={t(
          action.variables?.path.endsWith("/capture")
            ? "captureConfigured"
            : "operationSucceeded",
        )}
      />
    </article>
  );
};
interface Props {
  flows: DataFlow[];
  runs: ImportRun[];
  onCreate: () => void;
}
export const FlowList = ({ flows, runs, onCreate }: Props) => {
  const t = useTranslations("studio");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleFlows = flows.filter((flow) =>
    flow.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (filter === "all" || (filter === "attention" ? !!flow.error || flow.status === "failed" : flow.status === filter)),
  );
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-medium tracking-tight text-slate-900">{t("flows")}</h2>
        <p className="mt-1 text-[13px] text-slate-500">{t("publicationHelp")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <Field label={t("experience.searchFlows")}>
            <Input type="search" className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} />
          </Field>
        </div>
        <Field label={t("state")}>
          <select className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
            {["all", "draft", "capture_started", "published", "attention"].map((key) => <option key={key} value={key}>{t(key === "all" || key === "attention" ? `experience.${key}` : `status.${key}`)}</option>)}
          </select>
        </Field>
        <Button variant="ghost" size="auto" type="button" className={buttonClass} onClick={onCreate}>{t("experience.createFlow")}</Button>
      </div>
      <p role="status" className="text-xs text-slate-500">{t("experience.flowResults", { count: visibleFlows.length, total: flows.length })}</p>
      {visibleFlows.length ? (
        visibleFlows.map((flow) => <FlowCard key={flow.id} flow={flow} />)
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="font-medium text-slate-900">{t(flows.length ? "experience.noMatches" : "noFlows")}</h3>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-7 text-slate-500">{t(flows.length ? "experience.searchHelp" : "experience.firstFlowHelp")}</p>
          {flows.length > 0 && <Button variant="ghost" size="auto" type="button" className={secondaryClass + " mt-4"} onClick={() => { setQuery(""); setFilter("all"); }}>{t("experience.clearFilters")}</Button>}
        </div>
      )}
      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <caption className="p-4 text-start font-medium">
              {t("imports")}
            </caption>
            <thead className="bg-slate-50">
              <tr>
                {["file", "rows", "state"].map((key) => (
                  <th key={key} className="p-3 text-start">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="p-3">{run.fileName}</td>
                  <td className="p-3">{run.rowCount}</td>
                  <td className="p-3">
                    {t(`status.${run.status}`)}
                    {run.error && (
                      <p className="mt-1 text-amber-700">
                        {t.has(`errors.${run.error}`)
                          ? t(`errors.${run.error}`)
                          : t("errors.requestFailed")}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
