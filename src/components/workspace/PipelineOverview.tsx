"use client";
import { useEffect, useState } from "react";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { useDeploymentStatus } from "@/hooks/useWorkspace";
import type { WorkspaceState } from "@/lib/flows/types";
import { LoadingSkelton } from "@uiShare/molecules/Loading/LoadingSkeleton";

import { buttonClass, Notice, secondaryClass } from "./FormParts";

interface Props {
  state: WorkspaceState;
  onOpenData: () => void;
}
export const PipelineOverview = ({ state, onOpenData }: Props) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const deployment = useDeploymentStatus();
  const [localWorkspaceUrl, setLocalWorkspaceUrl] = useState("");
  const localAppPort = deployment.data?.localAppPort;
  useEffect(() => {
    if (!localAppPort) return;
    const url = new URL(window.location.href);
    url.port = String(localAppPort);
    url.pathname = `/${locale}/data-platform`;
    url.search = "";
    url.hash = "";
    setLocalWorkspaceUrl(url.toString());
  }, [localAppPort, locale]);
  const published = state.flows.filter((flow) => !!flow.activeLoadId);
  const reports = state.reports.filter((report) => !!report.publishedAt);
  const captured = state.flows.filter((flow) => !!flow.connectorName);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t("pipeline.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          {t("pipeline.description")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            key: "sources",
            count: state.connections.length,
            ready: state.connections.length > 0,
          },
          {
            key: "capture",
            count: captured.length,
            ready: captured.length > 0,
          },
          {
            key: "published",
            count: published.length,
            ready: published.length > 0,
          },
          { key: "reports", count: reports.length, ready: reports.length > 0 },
        ].map((item) => (
          <article
            key={item.key}
            className={`rounded-2xl border p-5 ${item.ready ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"}`}
          >
            <p className="text-sm font-semibold">{t("pipeline." + item.key)}</p>
            <p className="my-3 text-3xl font-bold">{item.count}</p>
            <p className="text-xs text-slate-500">
              {t("pipeline." + item.key + "Help")}
            </p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} onClick={onOpenData}>
          {t("dataBrowser.title")}
        </button>
        {state.currentUser.dataAccess && (
          <Link href={`/${locale}/analytics`} className={secondaryClass}>
            {t("analyticsPanel")}
          </Link>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">{t("pipeline.localStack")}</h3>
          <button
            className={secondaryClass}
            disabled={deployment.isFetching}
            onClick={() => void deployment.refetch()}
          >
            {t("dataBrowser.refresh")}
          </button>
        </div>
        {deployment.isPending ? (
          <LoadingSkelton isLoading className="mt-4 h-32" />
        ) : deployment.error ? (
          <Notice error={deployment.error} />
        ) : deployment.data ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{t("pipeline.compose")}</dt>
                <dd className="mt-1 font-semibold">
                  {t(
                    deployment.data.composePrepared
                      ? "pipeline.prepared"
                      : "pipeline.notPrepared",
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("pipeline.docker")}</dt>
                <dd className="mt-1 font-semibold">
                  {t("pipeline.dockerState." + deployment.data.docker)}
                </dd>
              </div>
            </dl>
            {deployment.data.docker === "permission_required" && (
              <div
                role="status"
                className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900"
              >
                <p>{t("pipeline.permissionHelp")}</p>
                <code
                  dir="ltr"
                  className="my-3 block overflow-x-auto whitespace-nowrap rounded-lg bg-white p-3 text-start"
                >
                  {t("pipeline.permissionCommand")}
                </code>
                <p>{t("pipeline.permissionNote")}</p>
              </div>
            )}
            <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7">
              {deployment.data.verifiedAt
                ? t("pipeline.verified", {
                    time: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(deployment.data.verifiedAt)),
                  })
                : t("pipeline.unverified")}
            </p>
            {deployment.data.docker !== "external" &&
              deployment.data.verifiedAt &&
              localWorkspaceUrl && (
                <div className="space-y-2">
                  <a
                    href={localWorkspaceUrl}
                    className={buttonClass + " inline-block"}
                  >
                    {t("pipeline.openLocalWorkspace", {
                      port: deployment.data.localAppPort,
                    })}
                  </a>
                  <p className="text-xs text-slate-500">
                    {t("pipeline.localCredentials")}
                  </p>
                </div>
              )}
            <p className="text-xs text-slate-500">
              {t("pipeline.verificationNote")}
            </p>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{t("pipeline.flows")}</h3>
        {!state.flows.length ? (
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {t("pipeline.noFlows")}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {state.flows.map((flow) => (
              <li
                key={flow.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{flow.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{flow.grain}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm">{t("status." + flow.status)}</p>
                  {flow.activeLoadId && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t("publishedRows", { count: flow.rowCount || 0 })}
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
