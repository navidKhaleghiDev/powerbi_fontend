"use client";
import { useState } from "react";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { useWorkspaceAction } from "@/hooks/useWorkspace";
import { metricCatalog, metricReadiness } from "@/lib/flows/metrics";
import type {
  MetricBinding,
  MetricId,
  SavedReport,
  WorkspaceState,
} from "@/lib/flows/types";

import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
interface ReviewProps {
  binding: MetricBinding;
  state: WorkspaceState;
}
const BindingReview = ({ binding, state }: ReviewProps) => {
  const t = useTranslations("studio");
  const action = useWorkspaceAction();
  const { register, handleSubmit } = useForm<{
    expected: string;
    tolerance: string;
  }>({
    defaultValues: {
      expected: binding.expected || "",
      tolerance: binding.tolerance || "0",
    },
  });
  const flow = state.flows.find((item) => item.id === binding.flowId);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {t("metric.catalog." + binding.metricId + ".name")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {flow?.name} · {binding.currency || t("metric.records")}
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {t(
            binding.approvedAt ? "metric.approved" : "metric.awaitingApproval",
          )}
        </span>
      </div>
      <p className="my-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
        {binding.definition}
      </p>
      <dl className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {Object.entries(binding.fields).map(([key, value]) => (
          <div key={key}>
            <dt className="inline">{t("metric.field." + key)}: </dt>
            <dd className="inline font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      {state.currentUser.role === "provider" && !binding.approvedAt && (
        <button
          className={secondaryClass}
          disabled={action.isPending}
          onClick={() =>
            action.mutate({ path: `metrics/${binding.id}/approve`, body: {} })
          }
        >
          {t("metric.approve")}
        </button>
      )}
      {binding.approvedAt && state.currentUser.dataAccess && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={handleSubmit((values) =>
            action.mutate({
              path: `metrics/${binding.id}/validate`,
              body: values,
            }),
          )}
        >
          <Field label={t("metric.controlTotal")}>
            <input
              className={inputClass}
              dir="ltr"
              {...register("expected", { required: true })}
            />
          </Field>
          <Field label={t("metric.tolerance")}>
            <input
              className={inputClass}
              dir="ltr"
              {...register("tolerance", { required: true })}
            />
          </Field>
          <button
            className={buttonClass + " self-end"}
            disabled={action.isPending}
          >
            {t("metric.reconcile")}
          </button>
        </form>
      )}
      {binding.validatedAt && (
        <p className="mt-3 text-sm text-teal-700">
          {t("metric.validationEvidence", {
            actual: binding.actual || "",
            at: binding.validatedAt,
          })}
        </p>
      )}
      <Notice error={action.error} success={action.isSuccess} />
    </article>
  );
};
interface Props {
  state: WorkspaceState;
}
interface BindingDraft {
  flowId: string;
  fields: Record<string, string>;
  currency: string;
  definition: string;
}
export const MetricCatalogPanel = ({ state }: Props) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<MetricId>("record_count");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [reportName, setReportName] = useState("");
  const save = useWorkspaceAction();
  const requestSetup = useWorkspaceAction();
  const generate = useWorkspaceAction<SavedReport>();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BindingDraft>({
    defaultValues: { flowId: "", fields: {}, currency: "", definition: "" },
  });
  const source = state.flows.find((flow) => flow.id === watch("flowId"));
  const spec = metricCatalog.find((item) => item.id === selected)!;
  const published = state.flows.filter((flow) => flow.activeLoadId);
  const ready = state.bindings.filter((binding) => {
    const metric = metricCatalog.find((item) => item.id === binding.metricId);
    return (
      !!metric && metricReadiness(metric, binding, state.flows) === "ready"
    );
  });
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-bold">{t("metric.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          {t("metric.help")}
        </p>
      </header>
      {published.length === 0 && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          {t("metric.noPublishedDataset")}
        </p>
      )}
      <Field label={t("metric.search")}>
        <input
          className={inputClass}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metricCatalog
          .filter((item) =>
            t("metric.catalog." + item.id + ".name")
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((item) => {
            const binding = state.bindings.findLast(
              (value) => value.metricId === item.id,
            );
            const readiness = metricReadiness(item, binding, state.flows);
            return (
              <button
                key={item.id}
                aria-pressed={selected === item.id}
                onClick={() => {
                  setSelected(item.id);
                  reset({
                    flowId: "",
                    fields: {},
                    currency: "",
                    definition: "",
                  });
                }}
                className={`rounded-2xl border p-5 text-start ${selected === item.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`}
              >
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">
                  {t("metric.readiness." + readiness)}
                </span>
                <h3 className="mt-3 font-semibold">
                  {t("metric.catalog." + item.id + ".name")}
                </h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {t("metric.catalog." + item.id + ".definition")}
                </p>
                <p className="mt-3 text-xs font-medium text-slate-600">
                  {t("metric.dependencies")}{" "}
                  {item.fields.length
                    ? item.fields
                        .map((field) =>
                          t.has("metric.field." + field)
                            ? t("metric.field." + field)
                            : field,
                        )
                        .join(" · ")
                    : t("metric.recordGrain")}
                </p>
              </button>
            );
          })}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm leading-7 text-slate-600">
          {t("metric.requestHelp")}
        </p>
        <button
          className={secondaryClass}
          disabled={requestSetup.isPending}
          onClick={() =>
            requestSetup.mutate({
              path: "metrics/request",
              body: { metricId: selected },
            })
          }
        >
          {t("metric.requestSetup")}
        </button>
        <Notice error={requestSetup.error} success={requestSetup.isSuccess} />
      </div>
      {spec.supported ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          onSubmit={handleSubmit((values) =>
            save.mutate({
              path: "metrics",
              body: { ...values, metricId: selected },
            }),
          )}
        >
          <h3 className="font-bold">
            {t("metric.configure")} ·{" "}
            {t("metric.catalog." + selected + ".name")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("dataset")}>
              <select
                className={inputClass}
                {...register("flowId", { required: true })}
              >
                <option value="">{t("metric.choosePublished")}</option>
                {published.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            </Field>
            {spec.fields.map((field) => (
              <Field key={field} label={t("metric.field." + field)}>
                <select
                  className={inputClass}
                  {...register(`fields.${field}`, { required: true })}
                >
                  <option value="">{t("metric.chooseField")}</option>
                  {source?.columns.map((column) => (
                    <option key={column.target}>{column.target}</option>
                  ))}
                </select>
              </Field>
            ))}
            {spec.money && (
              <Field label={t("metric.currency")}>
                <input
                  className={inputClass}
                  dir="ltr"
                  {...register("currency", {
                    required: true,
                    pattern: /^[A-Z]{3}$/,
                  })}
                />
              </Field>
            )}
          </div>
          <Field label={t("metric.businessDefinition")}>
            <textarea
              rows={4}
              className={inputClass}
              {...register("definition", {
                required: true,
                minLength: 30,
                maxLength: 2000,
              })}
            />
          </Field>
          <p className="text-xs leading-6 text-slate-500">
            {t("metric.definitionHelp")}
          </p>
          <button className={buttonClass} disabled={save.isPending || !source}>
            {t("metric.propose")}
          </button>
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="text-sm text-red-700">
              {t(
                errors.definition
                  ? "errors.definitionRequired"
                  : "errors.invalid",
              )}
            </p>
          )}
          <Notice error={save.error} success={save.isSuccess} />
        </form>
      ) : (
        <p className="rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          {t("metric.unsupportedHelp")}
        </p>
      )}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">{t("metric.reviewQueue")}</h3>
        {state.bindings
          .filter((binding) => !binding.requestResolved)
          .map((binding) =>
            binding.definition ? (
              <BindingReview key={binding.id} binding={binding} state={state} />
            ) : (
              <article
                key={binding.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <h4 className="font-semibold">
                  {t("metric.catalog." + binding.metricId + ".name")}
                </h4>
                <p className="mt-2 text-sm text-amber-900">
                  {t("metric.requestPending")}
                </p>
              </article>
            ),
          )}
      </div>
      {ready.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h3 className="font-bold">{t("metric.generate")}</h3>
          <p className="text-sm leading-7 text-slate-600">
            {t("metric.generateHelp")}
          </p>
          {ready.map((binding) => (
            <label className="flex items-center gap-2 text-sm" key={binding.id}>
              <input
                type="checkbox"
                checked={checked.includes(binding.id)}
                onChange={(event) =>
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, binding.id]
                      : current.filter((id) => id !== binding.id),
                  )
                }
              />
              {t("metric.catalog." + binding.metricId + ".name")} ·{" "}
              {state.flows.find((flow) => flow.id === binding.flowId)?.name}
            </label>
          ))}
          <Field label={t("reportName")}>
            <input
              className={inputClass}
              value={reportName}
              onChange={(event) => setReportName(event.target.value)}
            />
          </Field>
          <button
            className={buttonClass}
            disabled={
              !checked.length ||
              !reportName.trim() ||
              generate.isPending ||
              !state.currentUser.dataAccess
            }
            onClick={() =>
              generate.mutate(
                {
                  path: "metrics/generate",
                  body: { bindingIds: checked, name: reportName },
                },
                {
                  onSuccess: (report) =>
                    router.push(`/${locale}/analytics?report=${report.id}`),
                },
              )
            }
          >
            {t("metric.generateDraft")}
          </button>
          <Notice error={generate.error} />
        </div>
      )}
    </section>
  );
};
