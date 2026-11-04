import { useLocation } from '@tanstack/react-router';
import { Info } from 'lucide-react';

import { ApplicationSidebar } from './ApplicationSidebar';
import { WorkspaceHeader } from './WorkspaceHeader';

import type { ReactNode } from 'react';

interface Props {
  notice: ReactNode;
  children: ReactNode;
}
export const WorkspaceShell = ({ notice, children }: Props) => {
  const { pathname } = useLocation();
  const reporting = pathname.split('/').includes('analytics');
  return (
    <div className="workspace-stage">
      <ApplicationSidebar />
      <div className="workspace-window">
        <WorkspaceHeader />
        <main
          id="workspace-content"
          tabIndex={-1}
          className={`workspace-page ${reporting ? 'analytics-workspace' : ''}`}
        >
          <div className="workspace-mode-strip">
            <Info size={14} strokeWidth={1.5} aria-hidden="true" />
            {notice}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};
