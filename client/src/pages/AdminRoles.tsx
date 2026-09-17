import { Crown, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { AdminWorkspaceFrame } from '../components/admin/AdminWorkspaceFrame';
import { GOVERNANCE_ROLES } from '../config/governance';

const roleIcon = (roleId: string) => {
  if (roleId === 'OWNER') return Crown;
  if (roleId.includes('CHAIR') || roleId.includes('TREASURER')) return ShieldCheck;
  if (roleId === 'MEMBER' || roleId === 'GUEST' || roleId === 'APPLICANT') return UserCheck;
  return KeyRound;
};

export const AdminRoles = () => {
  const permissionCount = GOVERNANCE_ROLES.reduce((sum, role) => sum + role.permissions.length, 0);

  return (
    <AdminWorkspaceFrame
      title="Role management"
      subtitle="Review the governance roles and the permissions they carry across the platform."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="dashboard-tile p-5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Roles</p>
            <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{GOVERNANCE_ROLES.length}</p>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Governance profiles</p>
          </div>
          <div className="dashboard-tile p-5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(38,102,236,0.12)] text-blue-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Permissions</p>
            <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{permissionCount}</p>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Assigned capabilities</p>
          </div>
          <div className="dashboard-tile p-5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(240,169,21,0.18)] text-[#bd8500]">
              <Crown className="h-5 w-5" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Owner access</p>
            <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">Full</p>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Administrative coverage</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {GOVERNANCE_ROLES.map((role) => {
            const Icon = roleIcon(role.id);
            return (
              <article key={role.id} className="dashboard-tile overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-(--muted)">{role.id}</p>
                        <h3 className="mt-2 text-xl font-black text-(--secondary)">{role.title}</h3>
                      </div>
                    </div>
                    <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">
                      {role.permissions.length} permissions
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-(--muted)">{role.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.permissions.map((permission) => (
                      <span key={permission} className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};
