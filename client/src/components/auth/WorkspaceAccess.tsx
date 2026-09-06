import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';

interface WorkspaceAccessProps {
  children: ReactNode;
  roles?: string[];
  module?: string;
  label?: string;
}

export const WorkspaceAccess = ({ children, roles, module, label }: WorkspaceAccessProps) => {
  const { organizationId } = useParams();
  const { currentOrganization, loading } = useOrganizationWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-[35vh] items-center justify-center" role="status">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ds-primary)] border-t-transparent" />
      </div>
    );
  }

  const role = (currentOrganization?.myRole ?? 'MEMBER').toUpperCase();
  const roleAllowed = !roles?.length || roles.includes(role);
  const moduleEnabled = !module || currentOrganization?.enabledModules?.[module] !== false;

  if (roleAllowed && moduleEnabled) return <>{children}</>;

  const dashboardRoute = organizationId ? ROUTES.chama.dashboard(organizationId) : ROUTES.app.myChamas;
  const reason = !moduleEnabled
    ? `${label ?? 'This module'} is not enabled for this Chama.`
    : `Your ${currentOrganization?.myRoleLabel ?? role.toLowerCase()} role does not include access to ${label ?? 'this page'}.`;

  return (
    <section className="mx-auto max-w-2xl rounded-[var(--ds-radius-xl)] border border-amber-200 bg-amber-50 p-6 text-center shadow-[var(--ds-shadow-card)]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <LockKeyhole className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-black text-[var(--ds-secondary)]">Access limited</h1>
      <p className="mt-2 text-sm text-amber-900">{reason}</p>
      <p className="mt-2 text-sm text-[var(--ds-text-muted)]">You still have full access to the personal member features included with your role.</p>
      <Link className="btn btn-primary mt-5 inline-flex" to={dashboardRoute}>Return to my dashboard</Link>
    </section>
  );
};
