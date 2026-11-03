"use client";
import { cloneElement, useId } from "react";
import type { ReactElement } from "react";

import { useTranslations } from "next-intl";

import { requestErrorCode } from "@/hooks/useWorkspace";
export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100";
export const buttonClass =
  "rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-50";
export const secondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50";
interface FieldProps {
  label: string;
  children: ReactElement<{ id?: string }>;
}
export const Field = ({ label, children }: FieldProps) => {
  const id = useId();
  return (
    <div className="space-y-1.5 text-sm font-medium text-slate-700">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
};
interface NoticeProps {
  error?: unknown;
  success?: boolean;
  text?: string;
}
export const Notice = ({ error, success, text }: NoticeProps) => {
  const t = useTranslations("studio");
  if (error) {
    const code = requestErrorCode(error);
    return (
      <p
        role="alert"
        className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
      >
        {t.has(`errors.${code}`)
          ? t(`errors.${code}`)
          : t("errors.requestFailed")}
      </p>
    );
  }
  return success ? (
    <p
      role="status"
      className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
    >
      {text || t("saved")}
    </p>
  ) : null;
};
