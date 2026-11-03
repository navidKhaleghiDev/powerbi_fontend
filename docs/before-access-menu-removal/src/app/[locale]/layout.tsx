import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

import { kalameh } from "@/app/fonts";
import { WorkspaceProviders } from "@/components/WorkspaceProviders";

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
  const labels = {
    ...messages.dataPlatform.nav,
    pivot: messages.dataPlatform.pivot.title,

    access: messages.dataPlatform.accessManagement.title,
    reports: messages.dataPlatform.reportManagement.title,
  };
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
          <WorkspaceProviders>
            <header className="border-b border-gray-200 bg-white px-4 py-5 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  className="text-xl font-bold"
                  href={`/${locale}/data-platform`}
                >
                  {messages.workspace.title}
                </Link>
                <Link
                  href={`/${locale === "fa" ? "en" : "fa"}/data-platform`}
                  lang={locale === "fa" ? "en" : "fa"}
                >
                  {messages.workspace.language}
                </Link>
              </div>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {messages.workspace.demo}
              </p>
              <nav
                aria-label={messages.workspace.navigation}
                className="mt-4 flex flex-wrap gap-x-5 gap-y-3"
              >
                <Link href={`/${locale}/data-platform`}>
                  {messages.workspace.overview}
                </Link>
                {(
                  [
                    "sources",
                    "ingestion",
                    "schema",
                    "scenarios",
                    "pivot",
                    "access",
                    "reports",
                  ] as const
                ).map((route) => (
                  <Link
                    key={route}
                    className="text-sm underline-offset-4 hover:underline"
                    href={`/${locale}/data-platform/${route}`}
                  >
                    {labels[route]}
                  </Link>
                ))}
              </nav>
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
