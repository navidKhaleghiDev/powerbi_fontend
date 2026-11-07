import { ApplicationSidebar } from './ApplicationSidebar';
import { WorkspaceHeader } from './WorkspaceHeader';

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
export const WorkspaceShell = ({ children }: Props) => {
  return (
    <div className="workspace-stage">
      <ApplicationSidebar />
      <div className="workspace-window">
        <WorkspaceHeader />
        <main id="workspace-content" tabIndex={-1} className="workspace-page">
          {children}
        </main>
      </div>
    </div>
  );
};
