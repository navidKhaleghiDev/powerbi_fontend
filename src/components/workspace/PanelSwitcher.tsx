"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { SessionUser } from "@/lib/flows/types";
interface Props {
  user: SessionUser;
}
export const PanelSwitcher = ({ user }: Props) => {
  const locale = useLocale();
  const t = useTranslations("studio");
  const pathname = usePathname();
  const analytics = pathname.includes("/analytics");
  return (
    <nav
      aria-label={t("panelNavigation")}
      className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5 sm:w-fit"
    >
      {[
        {
          active: !analytics,
          allowed: user.role === "provider",
          path: "data-platform",
          label: "configurationPanel",
        },
        {
          active: analytics,
          allowed: user.dataAccess,
          path: "analytics",
          label: "analyticsPanel",
        },
      ].map((item) =>
        item.allowed ? (
          <Link
            key={item.path}
            aria-current={item.active ? "page" : undefined}
            href={`/${locale}/${item.path}`}
            className={`flex-1 rounded-xl px-6 py-3 text-center text-sm font-semibold transition sm:flex-none ${item.active ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t(item.label)}
          </Link>
        ) : (
          <span
            key={item.path}
            aria-disabled="true"
            title={t(
              item.path === "analytics"
                ? "errors.dataAccessRequired"
                : "errors.forbidden",
            )}
            className="flex-1 rounded-xl px-6 py-3 text-center text-sm font-semibold text-slate-400 sm:flex-none"
          >
            {t(item.label)}
          </span>
        ),
      )}
    </nav>
  );
};
