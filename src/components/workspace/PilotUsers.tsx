"use client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { useWorkspaceAction } from "@/hooks/useWorkspace";
import type { SessionUser, AuditEntry } from "@/lib/flows/types";

import { Field, Notice, buttonClass, inputClass } from "./FormParts";
interface Props {
  users: SessionUser[];
  currentUser: SessionUser;
  audit: AuditEntry[];
}
export const PilotUsers = ({ users, currentUser, audit }: Props) => {
  const t = useTranslations("studio");
  const action = useWorkspaceAction();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{
    username: string;
    password: string;
    role: "provider" | "customer";
    dataAccess: boolean;
  }>({
    defaultValues: {
      username: "",
      password: "",
      role: "customer",
      dataAccess: false,
    },
  });
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold">{t("pilotUsers")}</h2>
      <p className="text-sm leading-7 text-slate-500">{t("pilotUsersHelp")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <h3 className="font-semibold">{user.username}</h3>
            <p className="mt-2 text-sm text-slate-500">
              {t("role." + user.role)} ·{" "}
              {t(user.dataAccess ? "dataAllowed" : "dataDenied")}
            </p>
          </article>
        ))}
      </div>
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
        onSubmit={handleSubmit((values) =>
          action.mutate(
            { path: "users", body: values },
            { onSuccess: () => reset() },
          ),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("username")}>
            <input
              className={inputClass}
              autoComplete="off"
              {...register("username", {
                required: true,
                pattern: /^[A-Za-z0-9_.@-]{3,80}$/,
              })}
            />
          </Field>
          <Field label={t("password")}>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              {...register("password", {
                required: true,
                minLength: 12,
                maxLength: 128,
              })}
            />
          </Field>
          <Field label={t("userRole")}>
            <select className={inputClass} {...register("role")}>
              <option value="customer">{t("role.customer")}</option>
              <option value="provider">{t("role.provider")}</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!currentUser.dataAccess}
            {...register("dataAccess")}
          />
          {t("grantProviderData")}
        </label>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm text-red-700">
            {t(errors.password ? "errors.passwordLength" : "errors.invalid")}
          </p>
        )}
        <button className={buttonClass} disabled={action.isPending}>
          {t("createUser")}
        </button>
      </form>
      <Notice error={action.error} success={action.isSuccess} />
      <h2 className="text-lg font-bold">{t("auditTrail")}</h2>
      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["event", "actor", "time"].map((key) => (
                <th className="p-3 text-start" key={key}>
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audit.map((item) => (
              <tr className="border-t border-slate-100" key={item.id}>
                <td className="p-3 font-mono text-xs">{item.action}</td>
                <td className="p-3">
                  {users.find((user) => user.id === item.actorId)?.username ||
                    item.actorId}
                </td>
                <td className="p-3" dir="ltr">
                  {item.at}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
