"use client";
import { useState, useEffect, useRef } from "react";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

import { DataBrowser } from "./DataBrowser";
import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
import { MetricCatalogPanel } from "./MetricCatalogPanel";
const colors = [
  "#0f766e",
  "#2563eb",
  "#eab308",
  "#9333ea",
  "#db2777",
  "#ea580c",
];
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
  const chart = rows.map((row) => ({
    label: String(row.label ?? t("allRows")),
    value: Number(row.value ?? 0),
  }));
  return (
    <article
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${widget.kind === "table" ? "lg:col-span-2" : ""}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{visualTitle}</h3>
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
            <button
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              aria-label={t("moveUp")}
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              aria-label={t("moveDown")}
              onClick={() => onMove(1)}
            >
              ↓
            </button>
            <button className="text-xs text-red-700" onClick={onRemove}>
              {t("removeWidget")}
            </button>
          </div>
        )}
      </header>
      {result.isPending ? (
        <LoadingSkelton isLoading className="h-64" />
      ) : result.error ? (
        <Notice error={result.error} />
      ) : !rows.length ? (
        <p className="py-16 text-center text-slate-500">{t("noRows")}</p>
      ) : widget.kind === "kpi" ? (
        <div className="py-12">
          <p className="text-5xl font-bold tracking-tight text-teal-700">
            {formatExactValue(rows[0]?.value, locale)}
          </p>
          <p className="mt-3 text-sm text-slate-500">{t("allRows")}</p>
        </div>
      ) : widget.kind === "table" ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-start text-sm">
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
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {widget.kind === "bar" ? (
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={visualTitle}
                  fill="#0f766e"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            ) : widget.kind === "line" ? (
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={visualTitle}
                  stroke="#2563eb"
                  strokeWidth={3}
                />
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={chart}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={90}
                >
                  {chart.map((_, index) => (
                    <Cell key={index} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {result.data && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{t("groupLimit", { count: result.data.limit })}</span>
          <button
            className="font-semibold text-teal-700"
            onClick={() => downloadRows(rows)}
            disabled={!rows.length}
          >
            {t("exportResults")}
          </button>
        </footer>
      )}
      {binding && (
        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          <summary className="cursor-pointer font-semibold">
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
  const { register, handleSubmit, watch, reset } = useForm<{
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
  return (
    <form
      onSubmit={handleSubmit((values) => {
        onAdd({
          ...values,
          id:
            globalThis.crypto?.randomUUID?.() ||
            `visual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        });
        reset({ ...values, title: "" });
      })}
      className="space-y-4"
    >
      <h2 className="font-bold">{t("visualizations")}</h2>
      <Field label={t("widgetTitle")}>
        <input
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
        <select className={inputClass} {...register("bindingId")}>
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
          {["bar", "line", "pie", "table", "kpi"].map((kind) => (
            <option key={kind} value={kind}>
              {t("chart." + kind)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("groupBy")}>
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
          disabled={aggregation === "count" || !!bindingId}
          {...register("measure", {
            required: aggregation !== "count" && !bindingId,
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
        <summary className="cursor-pointer text-sm font-semibold">
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
            <input className={inputClass} {...register("filterValue")} />
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
            <input
              type="date"
              className={inputClass}
              {...register("dateFrom")}
            />
          </Field>
          <Field label={t("toDate")}>
            <input type="date" className={inputClass} {...register("dateTo")} />
          </Field>
        </div>
      </details>
      <button className={buttonClass + " w-full"}>{t("addVisual")}</button>
      <p className="text-xs leading-6 text-slate-500">{t("queryHelp")}</p>
    </form>
  );
};
interface Props {
  initialReportId?: string;
}
export const AnalyticsPanel = ({ initialReportId }: Props) => {
  const [showData, setShowData] = useState(false);
  const t = useTranslations("studio");
  const locale = useLocale();
  const workspace = useWorkspace();
  const save = useWorkspaceAction<SavedReport>();
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [reportId, setReportId] = useState<string>();
  const [editing, setEditing] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
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
        setShowMetrics(false);
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
    (!selectedReport ||
      selectedReport.ownerId === workspace.data.currentUser.id);
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
    <div className="space-y-5">
      {workspace.data.flows.some(flow => flow.sampleData) && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("sampleDataNotice")}</p>}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
            {t("organizationWorkspace")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{t("analyticsTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            {t("analyticsDescription")}
          </p>
        </div>
        <button
          className={secondaryClass}
          onClick={() => setEditing((value) => !value)}
        >
          {t(editing ? "viewMode" : "editMode")}
        </button>
      </header>
      {selectedReport && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${degraded ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-600"}`}
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
      <div className="flex flex-wrap gap-3">
        <button
          className={showMetrics && !showData ? buttonClass : secondaryClass}
          onClick={() => {
            setShowData(false);
            setShowMetrics(true);
          }}
        >
          {t("metric.chooseKpis")}
        </button>
        <button
          className={!showMetrics && !showData ? buttonClass : secondaryClass}
          onClick={() => {
            setShowData(false);
            setShowMetrics(false);
          }}
        >
          {t("metric.reportEditor")}
        </button>
        <button
          className={showData ? buttonClass : secondaryClass}
          onClick={() => setShowData(true)}
        >
          {t("dataBrowser.title")}
        </button>
      </div>
      {showData ? (
        <DataBrowser state={workspace.data} />
      ) : showMetrics ? (
        <MetricCatalogPanel state={workspace.data} />
      ) : !flows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-xl font-bold">{t("noPublishedData")}</h2>
          <p className="mx-auto my-4 max-w-lg text-sm leading-7 text-slate-500">
            {t("publishFirst")}
          </p>
          <Link
            className={buttonClass + " inline-block"}
            href={`/${locale}/data-platform`}
          >
            {t("configureData")}
          </Link>
        </div>
      ) : (
        <div
          className={`grid min-h-[650px] gap-4 ${editing ? "xl:grid-cols-[210px_minmax(0,1fr)_270px]" : "xl:grid-cols-[210px_minmax(0,1fr)]"}`}
        >
          <aside className="rounded-2xl bg-slate-900 p-4 text-white">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("reports")}
            </h2>
            <button
              className="mb-4 w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold hover:bg-teal-500"
              onClick={() => {
                setReportId(undefined);
                setWidgets([]);
                setValue("name", "");
                setEditing(true);
              }}
            >
              {t("newReport")}
            </button>
            {workspace.data.reports.map((report) => (
              <button
                key={report.id}
                className={`mb-2 w-full rounded-lg px-3 py-2 text-start text-sm ${report.id === reportId ? "bg-slate-700" : "hover:bg-slate-800"}`}
                onClick={() => {
                  setReportId(report.id);
                  setWidgets(report.widgets);
                  setValue("name", report.name);
                }}
              >
                {report.name}
              </button>
            ))}
            <h2 className="mb-3 mt-7 text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("publishedDatasets")}
            </h2>
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="mb-3 rounded-lg border border-slate-700 p-3"
              >
                <p className="text-sm font-medium">{flow.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {t("publishedRows", { count: flow.rowCount ?? 0 })}
                </p>
              </div>
            ))}
          </aside>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-5">
            <form
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
                  <input
                    className={inputClass}
                    {...register("name", { required: true, maxLength: 100 })}
                  />
                </Field>
              </div>
              <button
                className={buttonClass}
                disabled={save.isPending || !widgets.length || !editable}
              >
                {t("saveReport")}
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!reportId || save.isPending || !editable}
                onClick={() =>
                  save.mutate({ path: `reports/${reportId}/publish`, body: {} })
                }
              >
                {t("publishReport")}
              </button>
            </form>
            <Notice error={save.error} success={save.isSuccess} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            {!widgets.length && (
              <div className="flex min-h-96 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500">
                {t("emptyCanvas")}
              </div>
            )}
          </section>
          {editable && (
            <aside className="rounded-2xl border border-slate-200 bg-white p-5">
              <WidgetForm
                flows={flows}
                bindings={workspace.data.bindings}
                onAdd={(widget) =>
                  setWidgets((current) =>
                    current.length < 12 ? [...current, widget] : current,
                  )
                }
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
