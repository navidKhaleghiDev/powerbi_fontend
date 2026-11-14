import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
export const WorkspaceShell = ({ children }: Props) => {
  return (
    <div className="workspace-stage">
      <div className="workspace-window">
        <main id="workspace-content" tabIndex={-1} className="workspace-page">
          {children}
        </main>
      </div>
    </div>
  );
};
