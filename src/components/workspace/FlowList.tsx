"use client";
import { useState } from "react";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import {
  useConnectorStatus,
  useCsvImport,
  useFlowPlan,
  useWorkspaceAction,
} from "@/hooks/useWorkspace";
import type { DataFlow, ImportRun } from "@/lib/flows/types";

import { Notice, buttonClass, secondaryClass } from "./FormParts";
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{flow.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t(flow.kind === "csv" ? "csvSource" : "postgresSource")} ·{" "}
            {flow.grain}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {t(`status.${flow.status}`)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
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
            <button
              className={secondaryClass}
              onClick={() => setShowPlan((v) => !v)}
            >
              {t("reviewPlan")}
            </button>
            <button
              className={buttonClass}
              disabled={action.isPending}
              onClick={() =>
                action.mutate({ path: `flows/${flow.id}/capture`, body: {} })
              }
            >
              {t("startCapture")}
            </button>
            <button
              className={secondaryClass}
              disabled={action.isPending || !flow.connectorName}
              onClick={() =>
                action.mutate({ path: `flows/${flow.id}/publish`, body: {} })
              }
            >
              {t("publishSnapshot")}
            </button>
          </>
        ) : (
          <label className={secondaryClass + " cursor-pointer"}>
            {upload.isPending ? t("working") : t("replaceCsv")}
            <input
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
        {flow.activeLoadId && (
          <Link
            className="text-sm font-semibold text-teal-700 underline"
            href={`/${locale}/analytics`}
          >
            {t("openAnalytics")}
          </Link>
        )}
      </div>
      {flow.kind === "postgres" && (
        <p className="mt-3 text-xs text-slate-500">{t("captureHelp")}</p>
      )}
      {status.data?.connector && (
        <p className="mt-3 text-sm">
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
}
export const FlowList = ({ flows, runs }: Props) => {
  const t = useTranslations("studio");
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{t("flows")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("publicationHelp")}</p>
      </div>
      {flows.length ? (
        flows.map((flow) => <FlowCard key={flow.id} flow={flow} />)
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {t("noFlows")}
        </p>
      )}
      {runs.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="p-4 text-start font-bold">
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
                      <p className="mt-1 text-red-700">
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
