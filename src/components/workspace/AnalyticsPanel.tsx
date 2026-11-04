
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";

import { Link } from "react-router";
import { lazy, Suspense } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useForm } from "react-hook-form";


import {
  useWarehouseWidget,
  useWorkspace,
  useWorkspaceAction,
} from "@/hooks/useWorkspace";
import { formatExactValue } from "@/lib/flows/display";
import { metricCatalog, metricReadiness } from "@/lib/flows/metrics";
import type {
  Aggregation,
  ChartKind,
  DataFlow,
  ReportWidget,
  SavedReport,
  MetricBinding,
} from "@/lib/flows/types";
import { LoadingSkelton } from "@uiShare/molecules/Loading/LoadingSkeleton";

import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
const WarehouseChart = lazy(() => import("./WarehouseChart").then((module) => ({ default: module.WarehouseChart })));
const WarehouseMap = lazy(() => import("./WarehouseMap").then((module) => ({ default: module.WarehouseMap })));
const downloadRows = (rows: Record<string, string | number | null>[]) => {
  const columns = Object.keys(rows[0] ?? {});
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return (
      '"' +
      (/^[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
      '"'
    );
  };
  const csv = [
    columns,
    ...rows.map((row) => columns.map((column) => row[column])),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "warehouse-analysis.csv";
  link.click();
  URL.revokeObjectURL(url);
};
interface WidgetProps {
  widget: ReportWidget;
  onRemove: () => void;
  editable: boolean;
  binding?: MetricBinding;
  onMove: (direction: number) => void;
}
const WarehouseWidget = ({
  widget,
  onRemove,
  onMove,
  editable,
  binding,
}: WidgetProps) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const result = useWarehouseWidget(widget);
  const rows = result.data?.rows ?? [];
  const visualTitle = t.has(`metric.catalog.${widget.title}.name`)
    ? t(`metric.catalog.${widget.title}.name`)
    : widget.title;
  return (
    <article
      className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{visualTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {binding
              ? t("metric.approved")
              : t("aggregate." + widget.aggregation)}{" "}
            ·{" "}
            {binding
              ? binding.currency || t("rows")
              : widget.measure || t("rows")}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="auto"
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              aria-label={t("moveUp")}
              onClick={() => onMove(-1)}
            >
              ↑
            </Button>
            <Button variant="ghost" size="auto"
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              aria-label={t("moveDown")}
              onClick={() => onMove(1)}
            >
              ↓
            </Button>
            <Button variant="ghost" size="auto" className="text-xs text-slate-500 hover:text-slate-900" onClick={onRemove}>
              {t("removeWidget")}
            </Button>
          </div>
        )}
      </header>
      {result.isPending ? (
        <LoadingSkelton isLoading className="h-64" />
      ) : result.error ? (
        <Notice error={result.error} />
      ) : !rows.length ? (
        <p className="py-16 text-center text-slate-500">{t(widget.kind === "map" ? "gis.noCoordinates" : "noRows")}</p>
      ) : widget.kind === "map" ? (
        <Suspense fallback={<LoadingSkelton isLoading className="h-96" />}><WarehouseMap rows={rows} title={visualTitle} basemap={widget.basemap} /></Suspense>
      ) : widget.kind === "kpi" ? (
        <div className="border-s-2 border-teal-200 ps-5 py-6">
          <p className="break-words text-2xl font-medium tabular-nums tracking-tight text-slate-900 sm:text-3xl xl:text-4xl">
            {formatExactValue(rows[0]?.value, locale)}
          </p>
          <p className="mt-3 text-[13px] text-slate-500">{t("allRows")}</p>
        </div>
      ) : widget.kind === "table" ? (
        <div className="max-h-[65dvh] overflow-auto">
          <table className="w-full text-start text-[13px]">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((key) => (
                  <th key={key} className="border-b p-3 text-start">
                    {key === "label" ? widget.dimension : widget.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i} className="border-b border-slate-100 p-3">
                      {String(value ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Suspense fallback={<LoadingSkelton isLoading className="h-96" />}><WarehouseChart kind={widget.kind} title={visualTitle} rows={rows} /></Suspense>
      )}
      {result.data && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{t("groupLimit", { count: result.data.limit })}</span>
          <Button variant="ghost" size="auto"
            className="font-medium text-teal-700"
            onClick={() => downloadRows(rows)}
            disabled={!rows.length}
          >
            {t("exportResults")}
          </Button>
        </footer>
      )}
      {binding && (
        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          <summary className="cursor-pointer font-medium">
            {t("metric.lineage")}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{binding.definition}</p>
          <p>{binding.currency}</p>
          {binding.validatedAt && (
            <p>
              {t("metric.validationEvidence", {
                actual: binding.actual || "",
                at: binding.validatedAt,
              })}
            </p>
          )}
        </details>
      )}
      {result.data?.publishedAt && (
        <p className="mt-2 text-xs text-slate-400">
          {t("publishedAt")}{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(result.data.publishedAt))}
        </p>
      )}
    </article>
  );
};
interface WidgetFormProps {
  flows: DataFlow[];
  bindings: MetricBinding[];
  onAdd: (widget: ReportWidget) => void;
}
const WidgetForm = ({ flows, bindings, onAdd }: WidgetFormProps) => {
  const t = useTranslations("studio");
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<{
    latitudeField: string;
    longitudeField: string;
    basemap: "none" | "openstreetmap";
    title: string;
    bindingId: string;
    filterField: string;
    filterValue: string;
    dateField: string;
    dateFrom: string;
    dateTo: string;
    flowId: string;
    kind: ChartKind;
    dimension: string;
    measure: string;
    aggregation: Aggregation;
  }>({
    defaultValues: {
      title: "",
      latitudeField: "",
      longitudeField: "",
      basemap: "none",
      bindingId: "",
      filterField: "",
      filterValue: "",
      dateField: "",
      dateFrom: "",
      dateTo: "",
      flowId: flows[0]?.id || "",
      kind: "bar",
      dimension: "",
      measure: "",
      aggregation: "count",
    },
  });
  const selected = flows.find((flow) => flow.id === watch("flowId"));
  const aggregation = watch("aggregation");
  const bindingId = watch("bindingId");
  const kind = watch("kind");
  const numericFields = selected?.columns.filter((column) => ["Int64", "Float64", "Decimal(18,2)"].includes(column.type)) || [];
  return (
    <form
      onSubmit={handleSubmit((values) => {
        onAdd({
          ...values,
          bindingId: values.kind === "map" ? "" : values.bindingId,
          id:
            globalThis.crypto?.randomUUID?.() ||
            `visual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        });
        reset({ ...values, title: "" });
      })}
      className="space-y-4"
    >
      <h2 className="font-medium">{t("visualizations")}</h2>
      <Field label={t("widgetTitle")}>
        <Input
          className={inputClass}
          {...register("title", { required: true, maxLength: 100 })}
        />
      </Field>
      <Field label={t("dataset")}>
        <select
          className={inputClass}
          {...register("flowId", { required: true })}
        >
          {flows.map((flow) => (
            <option value={flow.id} key={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("metric.approvedBinding")}>
        <select className={inputClass} disabled={kind === "map"} {...register("bindingId")}>
          <option value="">{t("metric.explorationOnly")}</option>
          {bindings
            .filter(
              (binding) =>
                binding.flowId === selected?.id &&
                binding.approvedAt &&
                binding.validatedLoadId === selected?.activeLoadId,
            )
            .map((binding) => (
              <option key={binding.id} value={binding.id}>
                {t("metric.catalog." + binding.metricId + ".name")}
              </option>
            ))}
        </select>
      </Field>
      <Field label={t("visualType")}>
        <select className={inputClass} {...register("kind")}>
          {["bar", "line", "pie", "table", "kpi", "map"].map((kind) => (
            <option key={kind} value={kind}>
              {t("chart." + kind)}
            </option>
          ))}
        </select>
      </Field>
      {kind === "map" && <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
        <p className="text-xs leading-6 text-teal-900">{t("gis.configureHelp")}</p>
        <Field label={t("gis.latitude")} error={errors.latitudeField ? t("errors.invalid") : undefined}>
          <select className={inputClass} {...register("latitudeField", { required: kind === "map", validate: (value) => kind !== "map" || numericFields.some((field) => field.target === value) })}>
            <option value="">{t("gis.selectField")}</option>
            {numericFields.map((field) => <option key={field.target} value={field.target}>{field.target}</option>)}
          </select>
        </Field>
        <Field label={t("gis.longitude")} error={errors.longitudeField ? t("errors.invalid") : undefined}>
          <select className={inputClass} {...register("longitudeField", { required: kind === "map", validate: (value) => kind !== "map" || (value !== watch("latitudeField") && numericFields.some((field) => field.target === value)) })}>
            <option value="">{t("gis.selectField")}</option>
            {numericFields.map((field) => <option key={field.target} value={field.target}>{field.target}</option>)}
          </select>
        </Field>
        <Field label={t("gis.basemap")}>
          <select className={inputClass} {...register("basemap")}><option value="none">{t("gis.offline")}</option><option value="openstreetmap">OpenStreetMap</option></select>
        </Field>
        <p className="text-xs leading-6 text-slate-600">{t("gis.tilesHelp")}</p>
      </div>}
      <Field label={t(kind === "map" ? "gis.label" : "groupBy")}>

        <select className={inputClass} {...register("dimension")}>
          <option value="">{t("allRows")}</option>
          {selected?.columns.map((c) => (
            <option key={c.target}>{c.target}</option>
          ))}
        </select>
      </Field>
      <Field label={t("calculation")}>
        <select className={inputClass} {...register("aggregation")}>
          {["count", "sum", "avg"].map((value) => (
            <option key={value} value={value}>
              {t("aggregate." + value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("measure")}>
        <select
          className={inputClass}
          disabled={aggregation === "count" || (!!bindingId && kind !== "map")}
          {...register("measure", {
            required: aggregation !== "count" && (!bindingId || kind === "map"),
          })}
        >
          <option value="">{t("selectMeasure")}</option>
          {selected?.columns
            .filter((c) => c.type !== "String" && c.type !== "Date")
            .map((c) => (
              <option key={c.target}>{c.target}</option>
            ))}
        </select>
      </Field>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-[13px] font-medium">
          {t("visualFilters")}
        </summary>
        <div className="mt-3 space-y-3">
          <Field label={t("filterField")}>
            <select className={inputClass} {...register("filterField")}>
              <option value="">{t("noFilter")}</option>
              {selected?.columns
                .filter((column) => column.type === "String")
                .map((column) => (
                  <option key={column.target}>{column.target}</option>
                ))}
            </select>
          </Field>
          <Field label={t("filterValue")}>
            <Input className={inputClass} {...register("filterValue")} />
          </Field>
          <Field label={t("dateField")}>
            <select className={inputClass} {...register("dateField")}>
              <option value="">{t("noFilter")}</option>
              {selected?.columns
                .filter((column) => column.type === "Date")
                .map((column) => (
                  <option key={column.target}>{column.target}</option>
                ))}
            </select>
          </Field>
          <Field label={t("fromDate")}>
            <Input
              type="date"
              className={inputClass}
              {...register("dateFrom")}
            />
          </Field>
          <Field label={t("toDate")}>
            <Input type="date" className={inputClass} {...register("dateTo")} />
          </Field>
        </div>
      </details>
      <Button variant="ghost" size="auto" className={buttonClass + " w-full"}>{t("addVisual")}</Button>
      <p className="text-xs leading-6 text-slate-500">{t("queryHelp")}</p>
    </form>
  );
};
interface Props {
  initialReportId?: string;
}
export const AnalyticsPanel = ({ initialReportId }: Props) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const workspace = useWorkspace();
  const save = useWorkspaceAction<SavedReport>();
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [reportId, setReportId] = useState<string>();
  const [editing, setEditing] = useState(true);

  const initialLoaded = useRef(false);
  const { register, handleSubmit, setValue } = useForm<{ name: string }>({
    defaultValues: { name: "" },
  });
  useEffect(() => {
    if (!initialLoaded.current && initialReportId && workspace.data) {
      const report = workspace.data.reports.find(
        (item) => item.id === initialReportId,
      );
      if (report) {
        setReportId(report.id);
        setWidgets(report.widgets);
        setValue("name", report.name);
      }
      initialLoaded.current = true;
    }
  }, [initialReportId, workspace.data, setValue]);
  if (workspace.isPending) return <LoadingSkelton isLoading className="h-96" />;
  if (!workspace.data) return <Notice error={workspace.error} />;
  const selectedReport = workspace.data.reports.find(
    (report) => report.id === reportId,
  );
  const editable =
    editing &&
    !selectedReport;
  const visibleWidgets =
    !editable && selectedReport?.publishedWidgets
      ? selectedReport.publishedWidgets
      : widgets;
  const degraded =
    selectedReport?.publishedAt &&
    selectedReport.publishedWidgets?.some((widget) => {
      const binding = workspace.data.bindings.find(
        (item) => item.id === widget.bindingId,
      );
      const spec = metricCatalog.find((item) => item.id === binding?.metricId);
      return (
        !spec ||
        metricReadiness(spec, binding, workspace.data.flows) !== "ready"
      );
    });
  const flows = workspace.data.flows.filter((flow) => !!flow.activeLoadId);
  const move = (id: string, direction: number) =>
    setWidgets((current) => {
      const items = [...current];
      const from = items.findIndex((w) => w.id === id);
      const to = from + direction;
      if (to < 0 || to >= items.length) return current;
      [items[from], items[to]] = [items[to], items[from]];
      return items;
    });
  return (
    <div className="w-full min-w-0 space-y-5">
      <h1 className="sr-only">{t("metric.reportEditor")}</h1>
      {selectedReport && (
        <p
          role="status"
          className={`rounded-xl p-3 text-[13px] ${degraded ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-600"}`}
        >
          {t(
            degraded
              ? "reportDegraded"
              : selectedReport.publishedAt
                ? "reportPublished"
                : "reportDraft",
          )}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" type="button" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>{t(editing ? "viewMode" : "editMode")}</Button>
      </div>
      <section id="analytics-content" aria-label={t("metric.reportEditor")}>
        {!flows.length ? (

          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="text-base font-medium">{t("noPublishedData")}</h2>
            <p className="mx-auto my-4 max-w-lg text-[13px] leading-7 text-slate-500">
              {t("publishFirst")}
            </p>

          </div>
        ) : (
          <div className="flex min-h-[calc(100dvh-18rem)] w-full min-w-0 flex-col gap-4">
            <details className="rounded-2xl bg-slate-900 p-4 text-white">
              <summary className="cursor-pointer text-[13px] font-medium">{t("reports")} · {workspace.data.reports.length}</summary>
              <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-6">
              <div>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                {t("reports")}
              </h2>
              <Button variant="ghost" size="auto"
                className="mb-4 w-full rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-medium hover:bg-teal-500"
                onClick={() => {
                  setReportId(undefined);
                  setWidgets([]);
                  setValue("name", "");
                  setEditing(true);
                }}
              >
                {t("newReport")}
              </Button>
              {workspace.data.reports.map((report) => (
                <Button variant="ghost" size="auto"
                  key={report.id}
                  aria-pressed={report.id === reportId}
                  className={`mb-2 w-full break-words rounded-lg px-3 py-2 text-start text-[13px] ${report.id === reportId ? "bg-slate-700" : "hover:bg-slate-800"}`}
                  onClick={() => {
                    setReportId(report.id);
                    setWidgets(report.widgets);
                    setValue("name", report.name);
                  }}
                >
                  {report.name}
                </Button>
              ))}
              </div>
              <div>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                {t("publishedDatasets")}
              </h2>
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="mb-3 rounded-lg border border-slate-700 p-3"
                >
                  <p className="text-[13px] font-medium">{flow.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("publishedRows", { count: flow.rowCount ?? 0 })}
                  </p>
                </div>
              ))}
              </div>
              </div>
            </details>
            {editable && (
              <details className="rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-[13px] font-medium text-slate-900">{t("visualizations")}</summary>
                <div className="mt-5">
                <WidgetForm
                  flows={flows}
                  bindings={workspace.data.bindings}
                  onAdd={(widget) =>
                    setWidgets((current) =>
                      current.length < 12 ? [...current, widget] : current,
                    )
                  }
                />
                </div>
              </details>
            )}
            <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-5">
              {editable ? <form
                className="mb-5 flex flex-wrap items-end gap-3"
                onSubmit={handleSubmit(({ name }) =>
                  save.mutate(
                    { path: "reports", body: { id: reportId, name, widgets } },
                    { onSuccess: (report) => setReportId(report.id) },
                  ),
                )}
              >
                <div className="min-w-0 flex-1">
                  <Field label={t("reportName")}>
                    <Input
                      className={inputClass}
                      {...register("name", { required: true, maxLength: 100 })}
                    />
                  </Field>
                </div>
                <Button variant="default" size="auto"
                  className={buttonClass}
                  disabled={save.isPending || !widgets.length || !editable}
                >
                  {t("saveReport")}
                </Button>
                <Button variant="ghost" size="auto"
                  type="button"
                  className={secondaryClass}
                  disabled={!reportId || save.isPending || !editable}
                  onClick={() =>
                    save.mutate({ path: `reports/${reportId}/publish`, body: {} })
                  }
                >
                  {t("publishReport")}
                </Button>
              </form> : <h2 className="mb-5 text-base font-medium text-slate-900">{selectedReport?.name || t("reports")}</h2>}
              <Notice error={save.error} success={save.isSuccess} />
              <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-6">
                {visibleWidgets.map((widget) => (
                  <WarehouseWidget
                    key={widget.id}
                    widget={widget}
                    editable={editable}
                    binding={workspace.data.bindings.find(
                      (binding) => binding.id === widget.bindingId,
                    )}
                    onRemove={() =>
                      setWidgets((items) =>
                        items.filter((w) => w.id !== widget.id),
                      )
                    }
                    onMove={(direction) => move(widget.id, direction)}
                  />
                ))}
              </div>
              {!visibleWidgets.length && (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-base font-medium text-slate-900">{t("experience.canvasTitle")}</p>
                  <p className="mt-3 max-w-md text-[13px] leading-7 text-slate-500">{t(editable ? "emptyCanvas" : "experience.selectReport")}</p>
                  {editable && <Button asChild variant="outline" className={secondaryClass + " mt-5"}><Link to={`/${locale}/analytics/kpis`}>{t("metric.chooseKpis")}</Link></Button>}
                </div>
              )}
            </section>

          </div>
        )}
      </section>
    </div>
  );
};
