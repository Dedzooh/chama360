import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CircleX, FileText, HandHeart, Landmark, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type WelfareClaimRecord } from '../../services/organizationService';
import type { Loan } from '../../types';
import { ROUTES } from '../../config/routes';
import { Badge, Button, Card, EmptyState } from '../../design-system';

const money = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;
const roleCanReview = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'];

type QueueKind = 'loans' | 'welfare' | 'members' | 'expenses' | 'reconciliation';

const queueItems: Array<{ kind: QueueKind; label: string; description: string; icon: typeof Wallet; tone: string }> = [
  { kind: 'loans', label: 'Loan applications', description: 'Credit requests waiting for a decision.', icon: Landmark, tone: 'blue' },
  { kind: 'welfare', label: 'Welfare claims', description: 'Member support requests requiring review.', icon: HandHeart, tone: 'pink' },
  { kind: 'members', label: 'Member requests', description: 'Join and access requests from members.', icon: Users, tone: 'green' },
  { kind: 'expenses', label: 'Expense approval', description: 'Expenses queued for finance approval.', icon: Wallet, tone: 'gold' },
  { kind: 'reconciliation', label: 'Reconciliation exceptions', description: 'Transactions needing finance attention.', icon: ShieldCheck, tone: 'purple' },
];

const getDocuments = (claim: WelfareClaimRecord) => {
  const documents = claim.documents ?? claim.supportingDocuments ?? [];
  if (!Array.isArray(documents)) return [];
  return documents.map((document) => (typeof document === 'string' ? document : JSON.stringify(document)));
};

export const ApprovalsPage = () => {
  const navigate = useNavigate();
  const { organizationId, kind, itemId } = useParams<{ organizationId?: string; kind?: string; itemId?: string }>();
  const { currentOrganization } = useOrganizationWorkspace();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [claims, setClaims] = useState<WelfareClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [loanData, claimData] = await Promise.all([
        organizationService.listLoans(organizationId),
        organizationService.listWelfareClaims(organizationId),
      ]);
      setLoans(loanData);
      setClaims(claimData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load approval queues.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [organizationId]);

  const pendingLoans = useMemo(() => loans.filter((loan) => loan.status === 'PENDING'), [loans]);
  const pendingClaims = useMemo(() => claims.filter((claim) => claim.status === 'PENDING'), [claims]);
  const pendingMembers = useMemo(
    () => (currentOrganization?.members ?? []).filter((member) => ['PENDING', 'PENDING_APPROVAL', 'INVITATION_SENT'].includes(member.status)),
    [currentOrganization?.members],
  );
  const selectedClaim = kind === 'welfare' ? pendingClaims.find((claim) => claim.id === itemId) ?? claims.find((claim) => claim.id === itemId) : null;
  const selectedQueue = queueItems.find((item) => item.kind === kind) ?? null;
  const canReview = roleCanReview.includes((currentOrganization?.myRole ?? '').toUpperCase());
  const walletBalance = currentOrganization?.wallet?.balance ?? currentOrganization?.balance ?? 0;
  const welfareRules = ((currentOrganization?.metadata ?? {}) as { welfareRules?: { approvalMode?: string; requireDocuments?: boolean } }).welfareRules;
  const requiredApprovals = welfareRules?.approvalMode === 'CHAIR_TREASURER' ? 'Chairperson and Treasurer' : welfareRules?.approvalMode === 'MEMBER_VOTE' ? 'Member vote' : 'Committee review';

  const reviewClaim = async (action: 'approve' | 'reject') => {
    if (!organizationId || !selectedClaim) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'approve') await organizationService.approveWelfareClaim(organizationId, selectedClaim.id);
      else await organizationService.rejectWelfareClaim(organizationId, selectedClaim.id);
      await loadData();
      navigate(ROUTES.chama.approvals(organizationId));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update this claim.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama to review its approval queues." />;
  }

  const counts: Record<QueueKind, number> = {
    loans: pendingLoans.length,
    welfare: pendingClaims.length,
    members: pendingMembers.length,
    expenses: 1,
    reconciliation: 2,
  };

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Operations workspace</span>
            <strong>{canReview ? 'Official review queue' : 'Read only'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Approvals</h1>
            <small>One place to review member, welfare, credit, and finance decisions before they move forward.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync queue
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          {queueItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.kind}>
                <span className={item.tone}><Icon className="h-5 w-5" /></span>
                <p>{item.label.replace(' applications', '').replace(' claims', '').replace(' requests', '')}</p>
                <strong>{loading ? '...' : counts[item.kind]}</strong>
                <small>Waiting review</small>
              </article>
            );
          })}
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      {!selectedClaim ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queueItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.kind} to={ROUTES.chama.approvalQueue(currentOrganization.id, item.kind)} className="group rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-[var(--ds-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--ds-primary)]">
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ds-surface-2)] text-[var(--ds-primary)]`}><Icon className="h-5 w-5" /></span>
                  <span className="text-3xl font-black text-[var(--ds-secondary)]">{loading ? '...' : counts[item.kind]}</span>
                </div>
                <h2 className="mt-5 text-lg font-black text-[var(--ds-secondary)]">{item.label}</h2>
                <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.description}</p>
                <span className="mt-4 inline-flex text-sm font-bold text-[var(--ds-primary)]">Open queue</span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <Link to={ROUTES.chama.approvals(currentOrganization.id)} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ds-text-muted)]"><ArrowLeft className="h-4 w-4" />All approvals</Link>
            {queueItems.map((item) => (
              <Link key={item.kind} to={ROUTES.chama.approvalQueue(currentOrganization.id, item.kind)} className={`flex items-center justify-between rounded-[var(--ds-radius-lg)] border px-4 py-3 ${item.kind === kind ? 'border-[var(--ds-primary)] bg-emerald-50' : 'border-[var(--ds-border)] bg-[var(--ds-surface)]'}`}>
                <span className="text-sm font-bold text-[var(--ds-secondary)]">{item.label}</span>
                <Badge tone={item.kind === kind ? 'success' : 'neutral'}>{counts[item.kind]}</Badge>
              </Link>
            ))}
          </aside>

          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm text-[var(--ds-text-muted)]">{selectedQueue?.label}</p><h2 className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">{selectedClaim ? 'Welfare claim review' : 'Queue items'}</h2></div>
              <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            {selectedClaim ? (
              <Card className="overflow-hidden p-0">
                <div className="h-2 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-sm font-semibold text-[var(--ds-text-muted)]">Requested by</p><h3 className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">{selectedClaim.requestedBy ? `${selectedClaim.requestedBy.firstName} ${selectedClaim.requestedBy.lastName}` : 'Member'}</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{selectedClaim.requestedBy?.email ?? 'Member account'}</p></div>
                    <Badge tone={selectedClaim.status === 'PENDING' ? 'warning' : selectedClaim.status === 'APPROVED' ? 'success' : 'error'}>{selectedClaim.status}</Badge>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Info label="Category" value={selectedClaim.claimType ?? selectedClaim.type ?? 'Welfare claim'} />
                    <Info label="Amount" value={money(selectedClaim.amountRequested)} />
                    <Info label="Eligibility" value={selectedClaim.status === 'PENDING' ? 'Ready for official review' : 'Review completed'} />
                    <Info label="Previous claims" value={`${claims.filter((claim) => claim.requestedById === selectedClaim.requestedById && claim.id !== selectedClaim.id).length} previous claim(s)`} />
                    <Info label="Wallet balance" value={money(walletBalance)} />
                    <Info label="Required approvals" value={requiredApprovals} />
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Reason</p><p className="mt-2 text-sm leading-6 text-[var(--ds-secondary)]">{selectedClaim.reason ?? selectedClaim.description ?? 'No reason supplied.'}</p></div>
                    <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Documents</p>{getDocuments(selectedClaim).length ? <ul className="mt-2 space-y-2 text-sm text-[var(--ds-secondary)]">{getDocuments(selectedClaim).map((document, index) => <li key={`${document}-${index}`} className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-primary)]" />{document}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{welfareRules?.requireDocuments ? 'Required documents are missing.' : 'No supporting documents attached.'}</p>}</div>
                  </div>
                  <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Approvals received</p>{selectedClaim.approvals?.length ? <div className="mt-3 space-y-2">{selectedClaim.approvals.map((approval) => <div key={approval.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-3 text-sm"><span>{approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName}` : approval.approverId}</span><Badge tone={approval.decision === 'APPROVED' ? 'success' : 'error'}>{approval.decision}</Badge></div>)}</div> : <p className="mt-2 text-sm text-[var(--ds-text-muted)]">No approvals received yet.</p>}</div>
                  {selectedClaim.status === 'PENDING' ? <div className="mt-6 flex flex-wrap gap-3"><Button disabled={!canReview || saving} loading={saving} onClick={() => void reviewClaim('approve')} startIcon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button><Button variant="outline" disabled={!canReview || saving} onClick={() => void reviewClaim('reject')} startIcon={<CircleX className="h-4 w-4" />}>Reject</Button></div> : null}
                </div>
              </Card>
            ) : (
              <QueueList kind={kind as QueueKind} loans={pendingLoans} claims={pendingClaims} members={pendingMembers} organizationId={currentOrganization.id} />
            )}
          </div>
        </section>
      )}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4"><p className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</p><p className="mt-1 font-bold text-[var(--ds-secondary)]">{value}</p></div>;

const QueueList = ({ kind, loans, claims, members, organizationId }: { kind: QueueKind; loans: Loan[]; claims: WelfareClaimRecord[]; members: Array<{ id: string; status: string; user?: { firstName?: string; lastName?: string } | null }>; organizationId: string }) => {
  if (kind === 'welfare') return <div className="space-y-3">{claims.map((claim) => <Link key={claim.id} to={ROUTES.chama.approvalItem(organizationId, 'welfare', claim.id)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 transition hover:border-[var(--ds-primary)]"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold text-[var(--ds-secondary)]">{claim.claimType ?? claim.type}</span><Badge tone="warning">{money(claim.amountRequested)}</Badge></div><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{claim.requestedBy ? `${claim.requestedBy.firstName} ${claim.requestedBy.lastName}` : 'Member'} · {claim.reason ?? claim.description}</p></Link>)}{!claims.length ? <EmptyState title="No welfare claims waiting" description="New pending claims will appear here." /> : null}</div>;
  if (kind === 'loans') return <div className="space-y-3">{loans.map((loan) => <Link key={loan.id} to={ROUTES.chama.loan(organizationId, loan.id)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold text-[var(--ds-secondary)]">{loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Borrower'}</span><Badge tone="warning">{money(loan.amountRequested)}</Badge></div><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{loan.purpose ?? 'Loan application'} · Pending review</p></Link>)}{!loans.length ? <EmptyState title="No loan applications waiting" description="New pending applications will appear here." /> : null}</div>;
  if (kind === 'members') return <div className="space-y-3">{members.map((member) => <Link key={member.id} to={ROUTES.chama.members(organizationId)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><p className="font-bold text-[var(--ds-secondary)]">{member.user ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}` : 'Member request'}</p><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{member.status.replace('_', ' ')}</p></Link>)}{!members.length ? <EmptyState title="No member requests waiting" description="New join requests will appear here." /> : null}</div>;
  return <EmptyState title={kind === 'expenses' ? 'Expense approval queue' : 'Reconciliation exception queue'} description="This queue is ready for finance workflow integration. Items will appear when the corresponding records are available." />;
};
