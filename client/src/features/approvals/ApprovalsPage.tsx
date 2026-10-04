import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CircleX, FileText, HandHeart, Landmark, RefreshCw, Users, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type WelfareClaimRecord } from '../../services/organizationService';
import type { Loan } from '../../types';
import { ROUTES } from '../../config/routes';
import { Badge, Button, Card, EmptyState } from '../../design-system';

const money = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;
const roleCanReview = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'];

type QueueKind = 'all' | 'loans' | 'welfare' | 'members';

// Simplified approvals: one actionable list instead of a card maze. Payment
// proofs were replaced by statement reconciliation in the finance module —
// the queues here are loans, welfare claims and member requests.
const queueItems: Array<{ kind: QueueKind; label: string; description: string; icon: typeof Wallet; tone: string }> = [
  { kind: 'all', label: 'All approvals', description: 'Everything waiting for a decision.', icon: Wallet, tone: 'green' },
  { kind: 'loans', label: 'Loan applications', description: 'Credit requests waiting for a decision.', icon: Landmark, tone: 'blue' },
  { kind: 'welfare', label: 'Welfare claims', description: 'Member support requests requiring review.', icon: HandHeart, tone: 'pink' },
  { kind: 'members', label: 'Member requests', description: 'Join and access requests from members.', icon: Users, tone: 'green' },
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
  // Creator-of-chama bypass (same rule as Members): ownership is independent
  // of the member role.
  const isCreator = Boolean((currentOrganization as any)?.isOwner);
  const canReview = isCreator || roleCanReview.includes((currentOrganization?.myRole ?? '').toUpperCase());
  // Module scoping: welfare/loan queues only appear for chamas that enabled
  // those modules (savings-only groups see members only — payment proofs were
  // replaced by statement reconciliation in the finance module).
  const enabledModules = ((currentOrganization?.enabledModules ?? {}) as Record<string, boolean | null>);
  const visibleQueues = queueItems.filter((item) => item.kind === 'all' || item.kind === 'members' || (item.kind === 'welfare' && enabledModules.welfare !== false) || (item.kind === 'loans' && enabledModules.loans !== false));
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
    all: pendingLoans.length + pendingClaims.length + pendingMembers.length,
    loans: pendingLoans.length,
    welfare: pendingClaims.length,
    members: pendingMembers.length,
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
            <small>One place to review welfare, credit, and member decisions before they move forward.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync queue
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          {visibleQueues.filter((item) => item.kind !== 'all').slice(0, 4).map((item) => {
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
        <UnifiedQueueList
          organizationId={currentOrganization.id}
          loans={pendingLoans}
          claims={pendingClaims}
          members={pendingMembers}
          activeKind={(kind as QueueKind) || 'all'}
          counts={counts}
          visibleQueues={visibleQueues}
        />
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
                  <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Decision history</p>{selectedClaim.approvals?.length ? <div className="mt-3 space-y-2">{selectedClaim.approvals.map((approval) => <div key={approval.id} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><span>{approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName}` : approval.approverId}</span><Badge tone={approval.decision === 'APPROVED' ? 'success' : 'error'}>{approval.decision === 'APPROVED' ? 'Approved' : 'Rejected'}</Badge></div><p className="mt-1 text-xs text-[var(--ds-text-muted)]">{new Date(approval.createdAt).toLocaleString('en-KE')}</p>{approval.comment ? <p className="mt-2 text-[var(--ds-secondary)]">Reason: {approval.comment}</p> : null}</div>)}</div> : <p className="mt-2 text-sm text-[var(--ds-text-muted)]">No decisions have been recorded yet.</p>}</div>
                  {selectedClaim.status === 'PENDING' ? <div className="mt-6 flex flex-wrap gap-3"><Button disabled={!canReview || saving} loading={saving} onClick={() => void reviewClaim('approve')} startIcon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button><Button variant="outline" disabled={!canReview || saving} onClick={() => void reviewClaim('reject')} startIcon={<CircleX className="h-4 w-4" />}>Reject</Button></div> : null}
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
};

// Simplified approvals landing: filter chips + one merged actionable list.
// Payments and member requests have inline one-click actions; welfare and
// loans link to their detail views (documents/reasons matter there).
const UnifiedQueueList = ({ organizationId, loans, claims, members, activeKind, counts, visibleQueues = queueItems }: {
  organizationId: string;
  loans: Loan[];
  claims: WelfareClaimRecord[];
  members: Array<{ id: string; status: string; user?: { firstName?: string; lastName?: string } | null }>;
  activeKind: QueueKind;
  counts: Record<QueueKind, number>;
  visibleQueues?: typeof queueItems;
}) => {
  type UnifiedRow = { key: string; category: Exclude<QueueKind, 'all'>; who: string; what: string; detail: string; when?: string; link?: string };
  const rows: UnifiedRow[] = [
    ...claims.map((claim): UnifiedRow => ({
      key: `claim-${claim.id}`,
      category: 'welfare',
      who: claim.requestedBy ? `${claim.requestedBy.firstName} ${claim.requestedBy.lastName}` : 'Member',
      what: claim.claimType ?? claim.type ?? 'Welfare claim',
      detail: money(claim.amountRequested),
      link: ROUTES.chama.approvalItem(organizationId, 'welfare', claim.id),
    })),
    ...loans.map((loan): UnifiedRow => ({
      key: `loan-${loan.id}`,
      category: 'loans',
      who: loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Borrower',
      what: 'Loan application',
      detail: money(loan.amountRequested),
      link: ROUTES.chama.loan(organizationId, loan.id),
    })),
    ...members.map((member): UnifiedRow => ({
      key: `member-${member.id}`,
      category: 'members',
      who: member.user ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() || 'New member' : 'New member',
      what: 'Member request',
      detail: member.status.replace('_', ' '),
      link: ROUTES.chama.members(organizationId),
    })),
  ];
  const visible = activeKind === 'all' ? rows : rows.filter((row) => row.category === activeKind);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {visibleQueues.map((item) => {
          const active = item.kind === activeKind;
          return (
            <Link
              key={item.kind}
              to={ROUTES.chama.approvalQueue(organizationId, item.kind)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-[var(--ds-primary)] bg-[var(--ds-primary)] text-white' : 'border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-secondary)] hover:border-[var(--ds-primary)]'}`}
            >
              {item.label}
              {item.kind !== 'all' ? <Badge tone={active ? 'neutral' : counts[item.kind] > 0 ? 'warning' : 'neutral'}>{counts[item.kind]}</Badge> : null}
            </Link>
          );
        })}
      </div>

      {visible.length ? (
        <div className="divide-y divide-[var(--ds-border)] overflow-hidden rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
          {visible.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-[var(--ds-surface-2)]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.category === 'welfare' ? 'warning' : row.category === 'loans' ? 'info' : 'neutral'}>{row.category.replace('_', ' ')}</Badge>
                  <span className="font-bold text-[var(--ds-secondary)]">{row.who}</span>
                  <span className="text-sm text-[var(--ds-text-muted)]">{row.what}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--ds-text-muted)]">{row.detail}{row.when ? ` · ${row.when}` : ''}</p>
              </div>
              {row.link ? (
                <Link to={row.link} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] px-3 py-2 text-sm font-bold text-[var(--ds-primary)] transition hover:border-[var(--ds-primary)]">Review →</Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={activeKind === 'all' ? 'Nothing waiting for a decision' : 'No items in this queue'}
          description="New member submissions appear here the moment they arrive."
        />
      )}
    </div>
  );
};
const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4"><p className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</p><p className="mt-1 font-bold text-[var(--ds-secondary)]">{value}</p></div>;
