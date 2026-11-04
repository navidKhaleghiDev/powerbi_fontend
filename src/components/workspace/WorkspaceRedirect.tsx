import { Navigate } from 'react-router';

export const WorkspaceRedirect = ({ href }: { href: string }) => <Navigate to={href} replace />;
