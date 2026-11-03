"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { Http } from "@/lib/api/Http";
import type { SessionUser } from "@/lib/flows/types";

import { Field, Notice, inputClass, buttonClass } from "./FormParts";
const auth = new Http("/api/auth");
interface LoginValues {
  username: string;
  password: string;
  setupKey: string;
  dataAccess: boolean;
}
export const LoginPanel = () => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const cache = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () =>
      auth.get<{ user: SessionUser | null; needsSetup: boolean }>("session"),
    retry: false,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    defaultValues: {
      username: "",
      password: "",
      setupKey: "",
      dataAccess: false,
    },
  });
  const submit = useMutation({
    mutationFn: (values: LoginValues) =>
      auth.post<{ user: SessionUser }>(
        session.data?.needsSetup ? "bootstrap" : "login",
        values,
      ),
    onSuccess: ({ user }) => {
      cache.clear();
      router.push(
        `/${locale}/${user.role === "provider" ? "data-platform" : "analytics"}`,
      );
      router.refresh();
    },
  });
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
        {t("localPilot")}
      </p>
      <h1 className="mt-3 text-2xl font-bold">
        {t(session.data?.needsSetup ? "setupProvider" : "signIn")}
      </h1>
      <p className="my-4 text-sm leading-7 text-slate-500">
        {t(session.data?.needsSetup ? "setupHelp" : "signInHelp")}
      </p>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => submit.mutate(values))}
      >
        {session.data?.needsSetup && (
          <Field label={t("setupKey")}>
            <input
              className={inputClass}
              autoComplete="off"
              {...register("setupKey", { required: true })}
            />
          </Field>
        )}
        <Field label={t("username")}>
          <input
            autoComplete="username"
            className={inputClass}
            {...register("username", {
              required: true,
              pattern: /^[A-Za-z0-9_.@-]{3,80}$/,
            })}
          />
        </Field>
        <Field label={t("password")}>
          <input
            type="password"
            autoComplete={
              session.data?.needsSetup ? "new-password" : "current-password"
            }
            className={inputClass}
            {...register("password", {
              required: true,
              minLength: session.data?.needsSetup ? 12 : 1,
              maxLength: 128,
            })}
          />
        </Field>
        {session.data?.needsSetup && (
          <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <input
              type="checkbox"
              className="mt-1"
              {...register("dataAccess")}
            />
            <span>{t("bootstrapDataAccess")}</span>
          </label>
        )}
        <button
          className={buttonClass + " w-full"}
          disabled={submit.isPending || session.isPending}
        >
          {submit.isPending
            ? t("working")
            : t(session.data?.needsSetup ? "createProvider" : "signIn")}
        </button>
      </form>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {t(errors.password ? "errors.passwordLength" : "errors.invalid")}
        </p>
      )}
      <Notice error={submit.error || session.error} />
    </div>
  );
};
