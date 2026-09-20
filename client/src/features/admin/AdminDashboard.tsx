import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Building2, ClipboardCheck, DollarSign, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { AdminWorkspaceFrame } from '../../components/admin/AdminWorkspaceFrame';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { ROUTES } from '../../config/routes';

const money = (value: number) => `KES ${value.toLocaleString()}`;

export const AdminDashboard = () => {
  const { organizations, refreshOrganizations } = useOrganizationWorkspace();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');
  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId) ?? organizations[0] ?? null;
  const selectedOrganizationValue = selectedOrganizationId || selectedOrganization?.id || '';

  const activeCount = useMemo(() => organizations.filter((item) => item.status === 'ACTIVE').length, [organizations]);
  const totalBalance = useMemo(() => organizations.reduce((sum, item) => sum + Number(item.balance ?? 0), 0), [organizations]);
  const totalMembers = useMemo(
    () =>
      organizations.reduce((sum, item) => {
        const members = Array.isArray(item.members) ? item.members.length : 0;
        return sum + members;
      }, 0),
    [organizations]
  );

  return (
    <AdminWorkspaceFrame
      title="Admin dashboard"
      subtitle="Monitor organizations, approvals, finances, and governance from one place."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Organizations', value: organizations.length, caption: 'Total portfolio', icon: Building2 },
            { label: 'Members', value: totalMembers, caption: 'Across all groups', icon: Users },
            { label: 'Wallets', value: money(totalBalance), caption: 'Combined balance', icon: DollarSign },
            { label: 'Active', value: activeCount, caption: 'Operational chamas', icon: ClipboardCheck },
          ].map(({ icon: Icon, ...item }) => (
            <div key={item.label} className="dashboard-tile p-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{item.value}</p>
              <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.caption}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Portfolio</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Organizations</h2>
            </div>
            <div className="section-body space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Focus organization</span>
                <select value={selectedOrganizationValue} onChange={(event) => setSelectedOrganizationId(event.target.value)} className="input mt-2 w-full">
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void refreshOrganizations()} className="btn btn-outline">
                <RefreshCw className="h-4 w-4" />
                Refresh portfolio
              </button>
              {selectedOrganization ? (
                <div className="overflow-hidden rounded-[1.35rem] border border-[var(--ds-border)] bg-white shadow-[var(--ds-shadow-soft)]">
                  <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Selected</p>
                    <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{selectedOrganization.name}</h3>
                    <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{selectedOrganization.description || 'No description provided.'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">{selectedOrganization.status}</span>
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">{selectedOrganization.slug}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={ROUTES.chama.dashboard(selectedOrganization.id)} className="btn btn-primary">
                        <ArrowUpRight className="h-4 w-4" />
                        Open workspace
                      </Link>
                      <Link to={ROUTES.admin.wallet} className="btn btn-outline">
                        Wallet
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Operations</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Admin shortcuts</h2>
            </div>
            <div className="section-body grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Role management', detail: 'Governance permissions and access levels.', to: ROUTES.admin.roles, icon: ShieldCheck },
                { label: 'Approvals', detail: 'Pending finance and membership reviews.', to: ROUTES.admin.approvals, icon: ClipboardCheck },
                { label: 'Wallet', detail: 'Balances, receipts, and transactions.', to: ROUTES.admin.wallet, icon: DollarSign },
                { label: 'M-Pesa', detail: 'STK pushes and reconciliation.', to: ROUTES.admin.mpesa, icon: BarChart3 },
              ].map(({ icon: Icon, ...item }) => (
                <Link key={item.label} to={item.to} className="dashboard-tile p-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 font-black text-[var(--ds-secondary)]">{item.label}</p>
                  <p className="mt-1 text-sm text-(--muted)">{item.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-[var(--ds-text-muted)]">Controls</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Portal entry points</h2>
          </div>
          <div className="section-body flex flex-wrap gap-3">
            <Link to={ROUTES.admin.roles} className="btn btn-outline">Role Management</Link>
            <Link to={ROUTES.admin.approvals} className="btn btn-outline">Approvals</Link>
            <Link to={ROUTES.admin.wallet} className="btn btn-outline">Wallet Management</Link>
            <Link to={ROUTES.admin.chamaSettings} className="btn btn-outline">Chama Settings</Link>
            <Link to={ROUTES.admin.auditLogs} className="btn btn-outline">Audit Logs</Link>
            <Link to={ROUTES.admin.mpesa} className="btn btn-outline">M-Pesa Settings</Link>
          </div>
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};

