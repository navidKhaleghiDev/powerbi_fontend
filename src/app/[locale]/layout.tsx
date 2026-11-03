import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { kalameh } from "@/app/fonts";
import { PanelSwitcher } from "@/components/workspace/PanelSwitcher";
import { SessionControls } from "@/components/workspace/SessionControls";
import { WorkspaceProviders } from "@/components/WorkspaceProviders";
import { currentUser } from "@/server/flows/session";

import en from "../../../public/locales/en.json";
import fa from "../../../public/locales/fa.json";
interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}
const Layout = async ({ children, params }: Props) => {
  const { locale } = await params;
  if (locale !== "en" && locale !== "fa") notFound();
  const messages = locale === "fa" ? fa : en;
  const user = await currentUser();
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <head>
        <title>{messages.workspace.title}</title>
      </head>
      <body className={locale === "fa" ? kalameh.className : "font-sans"}>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Tehran"
        >
          <WorkspaceProviders key={user?.id || "anonymous"}>
            <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  className="text-xl font-bold"
                  href={`/${locale}/${user ? (user.role === "customer" ? "analytics" : "data-platform") : "login"}`}
                >
                  {messages.workspace.title}
                </Link>
                <Link
                  href={`/${locale === "fa" ? "en" : "fa"}/${user ? (user.role === "customer" ? "analytics" : "data-platform") : "login"}`}
                  lang={locale === "fa" ? "en" : "fa"}
                >
                  {messages.workspace.language}
                </Link>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {messages.workspace.connectedNotice}
              </p>
              {user && (
                <>
                  <PanelSwitcher user={user} />
                  <div className="mt-4">
                    <SessionControls user={user} />
                  </div>
                </>
              )}
            </header>
            <main className="mx-auto max-w-screen-2xl p-4 sm:p-8">
              {children}
            </main>
          </WorkspaceProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};
export default Layout;
