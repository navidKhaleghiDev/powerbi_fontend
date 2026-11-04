
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

import { useTranslations } from "use-intl";
import { useForm } from "react-hook-form";

import { requestErrorCode, useWorkspaceAction } from "@/hooks/useWorkspace";
import type { PostgresConnection, PublicConnection } from "@/lib/flows/types";

import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
interface Props {
  connections: PublicConnection[];
}
export const PostgresSources = ({ connections }: Props) => {
  const t = useTranslations("studio");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "pending" } | null>(null);
  useEffect(() => {
    if (!toast || toast.kind === "pending") return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  const showError = (error: unknown, name?: string) => {
    const code = requestErrorCode(error);
    const message = t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.requestFailed");
    setToast({ kind: "error", message: name ? `${name}: ${message}` : message });
  };
  const save = useWorkspaceAction();
  const test = useWorkspaceAction<{ walLevel: string }>();
  const testedConnectionId = (test.variables?.body as { connectionId?: string } | undefined)?.connectionId;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Omit<PostgresConnection, "id">>({
    defaultValues: { port: 5432, ssl: false, password: "" },
  });
  return (
    <section className="space-y-5">
      {toast && (
        <div className={`fixed bottom-6 end-6 z-50 flex max-w-[calc(100vw-3rem)] items-start gap-4 rounded-xl border p-4 shadow-lg ${toast.kind === "error" ? "border-amber-300 bg-amber-50 text-amber-900" : toast.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-900"}`}>
          <p role={toast.kind === "error" ? "alert" : "status"} className="text-[13px]">{toast.message}</p>
          <Button variant="ghost" size="auto" type="button" aria-label={t("dismissNotification")} onClick={() => setToast(null)} className="rounded px-1 focus-visible:outline-2">×</Button>
        </div>
      )}
      <div>
        <h2 className="text-base font-medium tracking-tight text-slate-900">{t("postgresSources")}</h2>
        <p className="mt-1 text-[13px] text-slate-500">{t("postgresHelp")}</p>
      </div>
      {!connections.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] leading-7 text-slate-600">{t("experience.sourceEmpty")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {connections.map((connection) => (
          <article
            key={connection.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-medium">{connection.name}</h3>
            <p dir="ltr" className="mt-2 break-all text-[13px] text-slate-500">
              {connection.host}:{connection.port} / {connection.database}
            </p>
            <Button variant="ghost" size="auto"
              className={secondaryClass + " mt-4"}
              type="button"
              disabled={test.isPending || save.isPending}
              onClick={() => {
                setToast({ kind: "pending", message: `${connection.name}: ${t("working")}` });
                test.mutate({
                  path: "test/postgres",
                  body: { connectionId: connection.id },
                }, {
                  onSuccess: () => setToast({ kind: "success", message: `${connection.name}: ${t("testSucceeded")}` }),
                  onError: (error) => showError(error, connection.name),
                });
              }}
            >
              {test.isPending && testedConnectionId === connection.id ? t("working") : t("testSource")}
            </Button>
            {testedConnectionId === connection.id && (
              <div aria-live="polite" aria-busy={test.isPending}>
                <Notice error={test.error} success={test.isSuccess} text={t("testSucceeded")} />
                {test.isSuccess && test.data.walLevel && (
                  <p className={`mt-3 rounded-xl p-3 text-[13px] ${test.data.walLevel === "logical" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                    {test.data.walLevel === "logical" ? t("walReady") : t("walRequired")}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit((values) => {
          setToast({ kind: "pending", message: t("working") });
          save.mutate(
            { path: "connections", body: values },
            {
              onError: (error) => showError(error),
              onSuccess: () => {
                setToast({ kind: "success", message: t("saved") });
                reset({
                  port: 5432,
                  ssl: false,
                  password: "",
                  name: "",
                  host: "",
                  database: "",
                  user: "",
                });
              },
            },
          );
        }, () => setToast({ kind: "error", message: t("errors.invalid") }))}
      >
        <h3 className="mb-4 font-medium">{t("addPostgres")}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["name", "host", "database", "user", "password"] as const).map(
            (field) => (
              <Field
                key={field}
                label={t(field === "user" ? "username" : field)}
                error={errors[field] ? t("errors.invalid") : undefined}
              >
                <Input
                  className={inputClass}
                  type={field === "password" ? "password" : "text"}
                  autoComplete={field === "password" ? "new-password" : "off"}
                  {...register(field, { required: field !== "password" })}
                />
              </Field>
            ),
          )}
          <Field label={t("port")} error={errors.port ? t("errors.invalid") : undefined}>
            <Input
              type="number"
              className={inputClass}
              {...register("port", {
                valueAsNumber: true,
                required: true,
                min: 1,
                max: 65535,
              })}
            />
          </Field>
        </div>
        <label className="my-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" {...register("ssl")} />
          {t("requireTls")}
        </label>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mb-3 text-[13px] text-amber-700">
            {t("errors.invalid")}
          </p>
        )}
        <Button variant="default" size="auto" className={buttonClass} disabled={save.isPending || test.isPending}>
          {save.isPending ? t("working") : t("saveConnection")}
        </Button>
      </form>
      <Notice error={save.error} success={save.isSuccess} />
    </section>
  );
};
