import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Building2, CircleDollarSign, FileText, ReceiptText, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react';
import { AdminWorkspaceFrame } from '../components/admin/AdminWorkspaceFrame';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { ROUTES } from '../config/routes';

const money = (value: number) => `KES ${value.toLocaleString()}`;

export const AdminWallet = () => {
  const { organizations, refreshOrganizations } = useOrganizationWorkspace();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0] ?? null;
  const selectedOrganizationValue = selectedOrganizationId || selectedOrganization?.id || '';

  const totalBalance = useMemo(
    () => organizations.reduce((sum, organization) => sum + Number(organization.wallet?.balance ?? organization.balance ?? 0), 0),
    [organizations]
  );
  const selectedBalance = Number(selectedOrganization?.wallet?.balance ?? selectedOrganization?.balance ?? 0);

  return (
    <AdminWorkspaceFrame
      title="Wallet management"
      subtitle="Review portfolio balances and open the relevant chama wallet when action is required."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Portfolio balance', value: money(totalBalance), caption: 'Across all wallets', icon: CircleDollarSign },
            { label: 'Organizations', value: organizations.length, caption: 'Available accounts', icon: Building2 },
            { label: 'Selected balance', value: money(selectedBalance), caption: selectedOrganization?.name ?? 'No chama selected', icon: Wallet },
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

        <section className="section-shell overflow-hidden">
          <div className="section-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Scope</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Choose organization</h2>
            </div>
            <select
              value={selectedOrganizationValue}
              onChange={(event) => setSelectedOrganizationId(event.target.value)}
              className="input w-full lg:w-[26rem]"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="section-body space-y-4">
            {selectedOrganization ? (
              <div className="overflow-hidden rounded-[1.35rem] border border-[var(--ds-border)] bg-white shadow-[var(--ds-shadow-soft)]">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Selected wallet</p>
                    <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{selectedOrganization.name}</h3>
                    <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Wallet balance {money(selectedBalance)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">{selectedOrganization.status}</span>
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">{selectedOrganization.slug}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link to={ROUTES.chama.dashboard(selectedOrganization.id)} className="btn btn-primary">
                      Open workspace
                    </Link>
                    <Link to={ROUTES.chama.contributions(selectedOrganization.id)} className="btn btn-outline">
                      Contributions
                    </Link>
                    <Link to={ROUTES.chama.loans(selectedOrganization.id)} className="btn btn-outline">
                      Loans
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state p-8 text-center text-(--muted)">Create or join a chama to inspect wallet balances.</div>
            )}
            <button type="button" onClick={() => void refreshOrganizations()} className="btn btn-outline">
              <RefreshCcw className="h-4 w-4" />
              Refresh portfolio
            </button>
          </div>
        </section>

        <section className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-[var(--ds-text-muted)]">Operations</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Money workflows</h2>
          </div>
          <div className="section-body grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'Receipts', detail: 'Track recorded contributions and payment references.', icon: ReceiptText },
              { label: 'Reconciliation', detail: 'Compare wallet balances against expected totals.', icon: ArrowRightLeft },
              { label: 'Transfers', detail: 'Review movement between savings, loans, and welfare.', icon: Wallet },
              { label: 'Approvals', detail: 'Escalate payment requests and disbursements.', icon: ShieldCheck },
              { label: 'Statements', detail: 'Generate wallet statements for audits and reporting.', icon: FileText },
              { label: 'Ledger', detail: 'Inspect transaction history across the portfolio.', icon: CircleDollarSign },
            ].map(({ icon: Icon, ...item }) => (
              <div key={item.label} className="dashboard-tile p-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 font-black text-[var(--ds-secondary)]">{item.label}</p>
                <p className="mt-1 text-sm text-(--muted)">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="section-body pt-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ds-surface-2)] px-4 py-2 text-sm font-bold text-[var(--ds-text-muted)]">
              <ArrowRightLeft className="h-4 w-4" />
              Use the workspace to perform live wallet actions.
            </div>
          </div>
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};
