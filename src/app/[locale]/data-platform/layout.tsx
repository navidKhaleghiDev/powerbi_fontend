import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { currentUser } from "@/server/flows/session";
interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}
const Layout = async ({ children, params }: Props) => {
  const { locale } = await params;
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== "provider") {
    const t = await getTranslations({ locale, namespace: "studio" });
    return (
      <p role="alert" className="rounded-xl bg-amber-50 p-6 text-amber-900">
        {t("errors.forbidden")}
      </p>
    );
  }
  return children;
};
export default Layout;
