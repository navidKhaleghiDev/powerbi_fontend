"use client";
import { useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import { usePublishedDataPreview } from "@/hooks/useWorkspace";
import type { DataFlow, WorkspaceState } from "@/lib/flows/types";
import { LoadingSkelton } from "@uiShare/molecules/Loading/LoadingSkeleton";

import { Field, inputClass, Notice, secondaryClass } from "./FormParts";

interface PublishedRowsProps {
  flow: DataFlow;
}
const PublishedRows = ({ flow }: PublishedRowsProps) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const preview = usePublishedDataPreview(
    flow.id,
    flow.activeLoadId || "",
    page,
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {t("dataBrowser.snapshot", { rows: flow.rowCount || 0 })}
        </p>
        <button
          className={secondaryClass}
          disabled={preview.isFetching}
          onClick={() => void preview.refetch()}
        >
          {t("dataBrowser.refresh")}
        </button>
      </div>
      {preview.isPending ? (
        <LoadingSkelton isLoading className="h-64" />
      ) : preview.error ? (
        <Notice error={preview.error} />
      ) : preview.data ? (
        <>
          <p className="text-xs text-slate-500">
            {t("dataBrowser.queriedAt", {
              time: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(preview.data.queriedAt)),
            })}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {preview.data.columns.map((column) => (
                    <th
                      scope="col"
                      key={column}
                      className="whitespace-nowrap px-4 py-3 text-start font-semibold"
                      dir="auto"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.data.rows.length ? (
                  preview.data.rows.map((row, index) => (
                    <tr key={String(row[flow.primaryKey] ?? index)}>
                      {preview.data?.columns.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-4 py-3"
                          dir="auto"
                        >
                          {row[column] === null
                            ? t("dataBrowser.null")
                            : String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={preview.data.columns.length}
                      className="p-8 text-center text-slate-500"
                    >
                      {t("noRows")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={secondaryClass}
              disabled={page === 0 || preview.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("dataBrowser.previous")}
            </button>
            <span className="text-sm">
              {t("dataBrowser.page", { page: page + 1 })}
            </span>
            <button
              className={secondaryClass}
              disabled={
                !preview.data.hasMore || page >= 1999 || preview.isFetching
              }
              onClick={() => setPage((value) => value + 1)}
            >
              {t("dataBrowser.next")}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t("dataBrowser.limit")}</p>
        </>
      ) : null}
    </div>
  );
};
interface Props {
  state: WorkspaceState;
}
export const DataBrowser = ({ state }: Props) => {
  const t = useTranslations("studio");
  const [selectedId, setSelectedId] = useState("");
  const flows = state.flows.filter((flow) => !!flow.activeLoadId);
  const selected = flows.find((flow) => flow.id === selectedId) || flows[0];
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-bold">{t("dataBrowser.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          {t("dataBrowser.description")}
        </p>
      </div>
      {!state.currentUser.dataAccess ? (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          {t("errors.dataAccessRequired")}
        </p>
      ) : !selected ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <h3 className="font-bold">{t("dataBrowser.empty")}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {t("dataBrowser.emptyHelp")}
          </p>
        </div>
      ) : (
        <>
          <Field label={t("dataset")}>
            <select
              className={inputClass}
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-slate-500">
            {t("dataBrowser.grain", { grain: selected.grain })}
          </p>
          <PublishedRows
            key={selected.id + selected.activeLoadId}
            flow={selected}
          />
        </>
      )}
    </section>
  );
};
