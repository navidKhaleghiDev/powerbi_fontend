"use client";
import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { requestErrorCode, useWorkspaceAction } from "@/hooks/useWorkspace";
import type { Infrastructure, PublicInfrastructure } from "@/lib/flows/types";

import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
interface Props {
  settings: PublicInfrastructure;
}
export const InfrastructureForm = ({ settings }: Props) => {
  const t = useTranslations("studio");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "pending" } | null>(null);
  useEffect(() => {
    if (!toast || toast.kind === "pending") return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  const showError = (error: unknown) => {
    const code = requestErrorCode(error);
    setToast({ kind: "error", message: t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.requestFailed") });
  };
  const save = useWorkspaceAction();
  const warehouseTest = useWorkspaceAction<{ ok: boolean; version: string }>();
  const kafkaTest = useWorkspaceAction<{ ok: boolean }>();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Infrastructure>({
    defaultValues: {
      clickhouse: { url:settings.clickhouse.url,database:settings.clickhouse.database,user:settings.clickhouse.user,password:"" },
      kafka: { connectUrl:settings.kafka.connectUrl,brokers:settings.kafka.brokers,user:settings.kafka.user,password:"" },
    },
  });
  return (
    <section className="space-y-5">
      {toast && (
        <div className={`fixed bottom-6 end-6 z-50 flex max-w-[calc(100vw-3rem)] items-start gap-4 rounded-xl border p-4 shadow-lg ${toast.kind === "error" ? "border-red-300 bg-red-50 text-red-900" : toast.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-900"}`}>
          <p role={toast.kind === "error" ? "alert" : "status"} className="text-sm">{toast.message}</p>
          <button type="button" aria-label={t("dismissNotification")} onClick={() => setToast(null)} className="rounded px-1 focus-visible:outline-2">×</button>
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold">{t("infrastructure")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("infrastructureHelp")}</p>
      </div>
      <form
        onSubmit={handleSubmit((values) => {
          setToast({ kind: "pending", message: t("working") });
          warehouseTest.reset();
          kafkaTest.reset();
          save.mutate({ path: "settings", body: values }, {
            onSuccess: () => setToast({ kind: "success", message: t("saved") }),
            onError: showError,
          });
        }, () => setToast({ kind: "error", message: t("errors.invalid") }))}
        className="space-y-6"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-semibold">{t("warehouse")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("clickhouseUrl")}>
              <input
                dir="ltr"
                type="url"
                className={inputClass}
                {...register("clickhouse.url", { required: true })}
              />
            </Field>
            <Field label={t("warehouseDatabase")}>
              <input
                dir="ltr"
                className={inputClass}
                {...register("clickhouse.database", {
                  required: true,
                  pattern: /^[A-Za-z][A-Za-z0-9_]{0,62}$/,
                })}
              />
            </Field>
            <Field label={t("username")}>
              <input
                autoComplete="off"
                className={inputClass}
                {...register("clickhouse.user")}
              />
            </Field>
            <Field label={t("password")}>
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                {...register("clickhouse.password")}
              />
            </Field>
          </div>
          <button
            type="button"
            className={secondaryClass + " mt-4"}
            disabled={warehouseTest.isPending || kafkaTest.isPending || save.isPending || !settings.clickhouse.url}
            onClick={() => {
              setToast({ kind: "pending", message: t("testingWarehouse") });
              warehouseTest.mutate({ path: "test/clickhouse", body: {} }, {
                onSuccess: () => setToast({ kind: "success", message: t("warehouseTestSucceeded") }),
                onError: showError,
              });
            }}
          >
            {warehouseTest.isPending ? t("testingWarehouse") : t("testWarehouse")}
          </button>
          <div aria-live="polite" aria-busy={warehouseTest.isPending}>
            {warehouseTest.isPending && <p role="status" className="mt-3 text-sm text-slate-600">{t("testingWarehouse")}</p>}
            <Notice error={warehouseTest.error} success={warehouseTest.isSuccess} text={t("warehouseTestSucceeded")} />
            {warehouseTest.isSuccess && <p className="mt-2 text-sm" dir="ltr">ClickHouse {warehouseTest.data.version}</p>}
          </div>
          <p className="mt-3 text-xs text-slate-500">{t("savedConnectionTestHelp")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-semibold">{t("kafkaDebezium")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("connectUrl")}>
              <input
                dir="ltr"
                type="url"
                className={inputClass}
                {...register("kafka.connectUrl")}
              />
            </Field>
            <Field label={t("brokers")}>
              <input
                dir="ltr"
                className={inputClass}
                {...register("kafka.brokers")}
              />
            </Field>
            <Field label={t("connectUser")}>
              <input
                autoComplete="off"
                className={inputClass}
                {...register("kafka.user")}
              />
            </Field>
            <Field label={t("password")}>
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                {...register("kafka.password")}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t("brokerHelp")}</p>
          <button
            type="button"
            className={secondaryClass + " mt-4"}
            disabled={warehouseTest.isPending || kafkaTest.isPending || save.isPending || !settings.kafka.connectUrl}
            onClick={() => {
              setToast({ kind: "pending", message: t("working") });
              kafkaTest.mutate({ path: "test/kafka", body: {} }, {
                onSuccess: () => setToast({ kind: "success", message: t("testSucceeded") }),
                onError: showError,
              });
            }}
          >
            {kafkaTest.isPending ? t("working") : t("testConnect")}
          </button>
          <Notice error={kafkaTest.error} success={kafkaTest.isSuccess} text={t("testSucceeded")} />
        </div>
        <p className="text-sm text-slate-500">{t("secretHelp")}</p>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm text-red-700">
            {t("errors.invalid")}
          </p>
        )}
        <button className={buttonClass} disabled={save.isPending || warehouseTest.isPending || kafkaTest.isPending}>
          {save.isPending ? t("working") : t("saveSettings")}
        </button>
      </form>
      <Notice error={save.error} success={save.isSuccess} />
    </section>
  );
};
