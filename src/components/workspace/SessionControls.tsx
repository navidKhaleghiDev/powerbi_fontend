"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Http } from "@/lib/api/Http";
import type { SessionUser } from "@/lib/flows/types";

import { Notice } from "./FormParts";
interface Props {
  user: SessionUser;
}
export const SessionControls = ({ user }: Props) => {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () => new Http("/api/auth").post("logout", {}),
    onSuccess: () => {
      client.clear();
      router.push(`/${locale}/login`);
      router.refresh();
    },
  });
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>
        {user.username} · {t("role." + user.role)}
      </span>
      <button
        className="font-semibold text-teal-700 underline"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {t("signOut")}
      </button>
      <Notice error={logout.error} />
    </div>
  );
};
