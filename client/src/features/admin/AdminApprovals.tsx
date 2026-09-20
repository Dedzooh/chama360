import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleX, Clock3, HandHeart, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import { AdminWorkspaceFrame } from '../../components/admin/AdminWorkspaceFrame';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type ContributionRecord, type WelfareClaimRecord } from '../../services/organizationService';
import type { Loan } from '../../types';
import { ROUTES } from '../../config/routes';

const money = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;

export const AdminApprovals = () => {
  const { organizations } = useOrganizationWorkspace();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [claims, setClaims] = useState<WelfareClaimRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId) ?? organizations[0] ?? null;

  useEffect(() => {
    if (!organizationId && organizations[0]?.id) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;
      setLoading(true);
      try {
        const [contributionData, loanData, claimData] = await Promise.all([
          organizationService.listContributions(organizationId),
          organizationService.listLoans(organizationId),
          organizationService.listWelfareClaims(organizationId),
        ]);
        setContributions(contributionData);
        setLoans(loanData);
        setClaims(claimData);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId]);

  const pendingContributions = useMemo(() => contributions.filter((item) => item.status === 'PENDING' || item.status === 'OVERDUE'), [contributions]);
  const pendingLoans = useMemo(() => loans.filter((item) => item.status === 'PENDING'), [loans]);
  const pendingClaims = useMemo(() => claims.filter((item) => item.status === 'PENDING'), [claims]);
  const totalPending = pendingContributions.length + pendingLoans.length + pendingClaims.length;

  return (
    <AdminWorkspaceFrame
      title="Approvals"
      subtitle="Review pending contribution, loan, and welfare actions across a selected organization."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Contributions', value: pendingContributions.length, caption: 'Payment reviews', icon: Wallet },
            { label: 'Loans', value: pendingLoans.length, caption: 'Credit decisions', icon: Landmark },
            { label: 'Welfare', value: pendingClaims.length, caption: 'Claim reviews', icon: HandHeart },
            { label: 'Queue', value: loading ? '...' : totalPending, caption: loading ? 'Loading items' : 'Ready for review', icon: Clock3 },
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
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="input w-full lg:w-[26rem]">
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="section-body">
            {selectedOrganization ? (
              <div className="overflow-hidden rounded-[1.35rem] border border-[var(--ds-border)] bg-white shadow-[var(--ds-shadow-soft)]">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Pending actions</p>
                    <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{selectedOrganization.name}</h3>
                    <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Use the workspace links to approve, reject, or disburse items.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ds-surface-2)] px-4 py-2 text-sm font-bold text-[var(--ds-text-muted)]">
                    <Clock3 className="h-4 w-4" />
                    {totalPending} pending
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state p-8 text-center text-(--muted)">Create or join a chama to see approvals.</div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Contributions</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Pending payments</h2>
            </div>
            <div className="section-body space-y-3">
              {pendingContributions.length === 0 ? (
                <div className="empty-state p-6 text-center text-(--muted)">No contribution approvals waiting.</div>
              ) : (
                pendingContributions.map((contribution) => (
                  <div key={contribution.id} className="dashboard-tile p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                        <Wallet className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-(--secondary)">
                          {contribution.member?.firstName ?? 'Member'} {contribution.member?.lastName ?? ''}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{money(contribution.amount)} - {contribution.status}</p>
                        <Link
                          to={selectedOrganization ? ROUTES.chama.contributions(selectedOrganization.id) : ROUTES.app.myChamas}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-(--primary)"
                        >
                          <Wallet className="h-4 w-4" />
                          Open ledger
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Loans</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Pending loans</h2>
            </div>
            <div className="section-body space-y-3">
              {pendingLoans.length === 0 ? (
                <div className="empty-state p-6 text-center text-(--muted)">No loan approvals waiting.</div>
              ) : (
                pendingLoans.map((loan) => (
                  <div key={loan.id} className="dashboard-tile p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(38,102,236,0.12)] text-blue-700">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-(--secondary)">
                          {loan.borrower?.firstName ?? 'Borrower'} {loan.borrower?.lastName ?? ''}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{money(loan.amountRequested)}</p>
                        <Link
                          to={selectedOrganization ? ROUTES.chama.loan(selectedOrganization.id, loan.id) : ROUTES.app.myChamas}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-(--primary)"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Review loan
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Welfare</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Pending claims</h2>
            </div>
            <div className="section-body space-y-3">
              {pendingClaims.length === 0 ? (
                <div className="empty-state p-6 text-center text-(--muted)">No welfare claims waiting.</div>
              ) : (
                pendingClaims.map((claim) => (
                  <div key={claim.id} className="dashboard-tile p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(232,55,114,0.12)] text-rose-600">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-(--secondary)">{claim.claimType ?? claim.type}</p>
                        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{money(claim.amountRequested)} - {claim.reason || claim.description}</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Link
                            to={selectedOrganization ? ROUTES.chama.welfare(selectedOrganization.id) : ROUTES.app.myChamas}
                            className="inline-flex items-center gap-2 text-sm font-bold text-(--primary)"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Open welfare
                          </Link>
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ds-text-muted)]">
                            <CircleX className="h-4 w-4" />
                            {claim.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};

