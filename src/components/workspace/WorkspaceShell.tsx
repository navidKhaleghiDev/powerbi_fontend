
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { ApplicationSidebar } from "./ApplicationSidebar";

interface Props { notice: ReactNode; children: ReactNode; }
export const WorkspaceShell = ({ notice, children }: Props) => {
  const { pathname } = useLocation();
  const reporting = pathname.split("/").includes("analytics");
  return (
    <div className="grid min-h-dvh w-full max-w-none items-start gap-0 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ApplicationSidebar />
      <main id="workspace-content" tabIndex={-1} className={`workspace-page text-[13px] leading-6 w-full min-w-0 max-w-none p-4 lg:px-5 outline-none ${reporting ? "analytics-workspace" : ""}`}>
        {notice}
        {children}
      </main>
    </div>
  );
};
