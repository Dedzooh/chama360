import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CheckCircle2, CircleX, FileText, HandHeart, Landmark, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type PaymentProofRecord, type WelfareClaimRecord } from '../../services/organizationService';
import type { Loan } from '../../types';
import { ROUTES } from '../../config/routes';
import { Badge, Button, Card, EmptyState } from '../../design-system';

const money = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;
const roleCanReview = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'];

type QueueKind = 'all' | 'payments' | 'loans' | 'welfare' | 'members';

// Simplified approvals: one actionable list instead of a card maze. The two
// placeholder queues (expenses, reconciliation) are hidden until real records
// exist.
const queueItems: Array<{ kind: QueueKind; label: string; description: string; icon: typeof Wallet; tone: string }> = [
  { kind: 'all', label: 'All approvals', description: 'Everything waiting for a decision.', icon: Wallet, tone: 'green' },
  { kind: 'payments', label: 'Payment proofs', description: 'Member "I have paid" submissions to confirm.', icon: Banknote, tone: 'green' },
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
  const [proofs, setProofs] = useState<PaymentProofRecord[]>([]);
  const [proofNote, setProofNote] = useState('');
  const [proofsForbidden, setProofsForbidden] = useState(false);
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
      try {
        setProofs(await organizationService.listPaymentProofs(organizationId));
        setProofsForbidden(false);
      } catch (proofError) {
        // 403 means the role cannot see payment proofs — surface it instead of
        // silently showing an empty list (users thought there was nothing to
        // approve when the queue was actually hidden).
        setProofs([]);
        setProofsForbidden((proofError as any)?.response?.status === 403);
      }
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

  const reviewProof = async (proofId: string, action: 'approve' | 'reject') => {
    if (!organizationId) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'approve') await organizationService.approvePaymentProof(organizationId, proofId);
      else await organizationService.rejectPaymentProof(organizationId, proofId, proofNote.trim() || undefined);
      setProofNote('');
      await loadData();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update this payment proof.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama to review its approval queues." />;
  }

  const counts: Record<QueueKind, number> = {
    all: proofs.length + pendingLoans.length + pendingClaims.length + pendingMembers.length,
    payments: proofs.length,
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
        <UnifiedQueueList
          organizationId={currentOrganization.id}
          loans={pendingLoans}
          claims={pendingClaims}
          members={pendingMembers}
          proofs={proofs}
          proofsForbidden={proofsForbidden}
          activeKind={kind as QueueKind}
          counts={counts}
          canReview={canReview}
          saving={saving}
          proofNote={proofNote}
          onProofNoteChange={setProofNote}
          onReviewProof={reviewProof}
          onReload={loadData}
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
              <div><p className="text-sm text-[var(--ds-text-muted)]">{selectedQueue?.label}</p><h2 className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">Welfare claim review</h2></div>
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
              <QueueList kind={kind as QueueKind} loans={pendingLoans} claims={pendingClaims} members={pendingMembers} proofs={proofs} organizationId={currentOrganization.id} onReviewProof={reviewProof} onReload={loadData} canReview={canReview} saving={saving} proofNote={proofNote} onProofNoteChange={setProofNote} />
            )}
          </div>
        </section>
      )}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4"><p className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</p><p className="mt-1 font-bold text-[var(--ds-secondary)]">{value}</p></div>;

const QueueList = ({ kind, loans, claims, members, proofs = [], organizationId, onReviewProof, onReload, canReview, saving, proofNote, onProofNoteChange }: { kind: QueueKind; loans: Loan[]; claims: WelfareClaimRecord[]; members: Array<{ id: string; status: string; user?: { firstName?: string; lastName?: string } | null }>; proofs?: PaymentProofRecord[]; organizationId: string; onReviewProof?: (proofId: string, action: 'approve' | 'reject') => void; onReload?: () => void; canReview?: boolean; saving?: boolean; proofNote?: string; onProofNoteChange?: (value: string) => void }) => {
  if (kind === 'payments') return (
    <div className="space-y-3">
      {canReview ? <StatementReconciler organizationId={organizationId} onApplied={() => onReload?.()} /> : null}
      {proofs.map((proof) => (
        <div key={proof.id} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold text-[var(--ds-secondary)]">{proof.member ? `${proof.member.firstName ?? ''} ${proof.member.lastName ?? ''}` : 'Member'}</span>
            <Badge tone="warning">{money(proof.amount)}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
            {proof.paymentMethod} · Ref {proof.reference ?? '—'} · Submitted {new Date(proof.submittedAt).toLocaleString('en-KE')}
          </p>
          {proof.note ? <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Note: {proof.note}</p> : null}
          {canReview && onReviewProof ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={proofNote}
                onChange={(event) => onProofNoteChange?.(event.target.value)}
                placeholder="Rejection reason (optional)"
                className="input h-9 max-w-xs flex-1 text-sm"
              />
              <button type="button" disabled={saving} onClick={() => onReviewProof(proof.id, 'approve')} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />Confirm &amp; mark paid
              </button>
              <button type="button" disabled={saving} onClick={() => onReviewProof(proof.id, 'reject')} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">
                <CircleX className="h-4 w-4" />Reject
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {!proofs.length ? <EmptyState title="No payment proofs waiting" description={'When members submit “I have paid” proof, it appears here for confirmation.'} /> : null}
    </div>
  );
  if (kind === 'welfare') return <div className="space-y-3">{claims.map((claim) => <Link key={claim.id} to={ROUTES.chama.approvalItem(organizationId, 'welfare', claim.id)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 transition hover:border-[var(--ds-primary)]"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold text-[var(--ds-secondary)]">{claim.claimType ?? claim.type}</span><Badge tone="warning">{money(claim.amountRequested)}</Badge></div><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{claim.requestedBy ? `${claim.requestedBy.firstName} ${claim.requestedBy.lastName}` : 'Member'} · {claim.reason ?? claim.description}</p></Link>)}{!claims.length ? <EmptyState title="No welfare claims waiting" description="New pending claims will appear here." /> : null}</div>;
  if (kind === 'loans') return <div className="space-y-3">{loans.map((loan) => <Link key={loan.id} to={ROUTES.chama.loan(organizationId, loan.id)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold text-[var(--ds-secondary)]">{loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Borrower'}</span><Badge tone="warning">{money(loan.amountRequested)}</Badge></div><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{loan.purpose ?? 'Loan application'} · Pending review</p></Link>)}{!loans.length ? <EmptyState title="No loan applications waiting" description="New pending applications will appear here." /> : null}</div>;
  if (kind === 'members') return <div className="space-y-3">{members.map((member) => <Link key={member.id} to={ROUTES.chama.members(organizationId)} className="block rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><p className="font-bold text-[var(--ds-secondary)]">{member.user ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}` : 'Member request'}</p><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{member.status.replace('_', ' ')}</p></Link>)}{!members.length ? <EmptyState title="No member requests waiting" description="New join requests will appear here." /> : null}</div>;
  return <EmptyState title={kind === 'expenses' ? 'Expense approval queue' : 'Reconciliation exception queue'} description="This queue is ready for finance workflow integration. Items will appear when the corresponding records are available." />;
};

// Simplified approvals landing: filter chips + one merged actionable list.
// Payments and member requests have inline one-click actions; welfare and
// loans link to their detail views (documents/reasons matter there).
const UnifiedQueueList = ({ organizationId, loans, claims, members, proofs = [], proofsForbidden, activeKind, counts, canReview, saving, proofNote, onProofNoteChange, onReviewProof, onReload }: {
  organizationId: string;
  loans: Loan[];
  claims: WelfareClaimRecord[];
  members: Array<{ id: string; status: string; user?: { firstName?: string; lastName?: string } | null }>;
  proofs?: PaymentProofRecord[];
  proofsForbidden?: boolean;
  activeKind: QueueKind;
  counts: Record<QueueKind, number>;
  canReview?: boolean;
  saving?: boolean;
  proofNote?: string;
  onProofNoteChange?: (value: string) => void;
  onReviewProof?: (proofId: string, action: 'approve' | 'reject') => void;
  onReload?: () => void;
}) => {
  type UnifiedRow = { key: string; category: Exclude<QueueKind, 'all'>; who: string; what: string; detail: string; when?: string; link?: string; inline?: 'payment-proof'; id?: string };
  const rows: UnifiedRow[] = [
    ...proofs.map((proof): UnifiedRow => ({
      key: `proof-${proof.id}`,
      category: 'payments',
      who: proof.member ? `${proof.member.firstName ?? ''} ${proof.member.lastName ?? ''}`.trim() || 'Member' : 'Member',
      what: 'Payment proof',
      detail: `${money(proof.amount)} · ${proof.paymentMethod} · Ref ${proof.reference ?? '—'}`,
      when: proof.submittedAt ? new Date(proof.submittedAt).toLocaleDateString('en-KE') : undefined,
      inline: 'payment-proof',
      id: proof.id,
    })),
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
        {queueItems.map((item) => {
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

      {proofsForbidden && (activeKind === 'all' || activeKind === 'payments') ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          Payment proofs aren't visible to your role. Ask a Chairperson or Treasurer to review them, or update your role in Members.
        </Card>
      ) : null}

      {visible.length ? (
        <div className="divide-y divide-[var(--ds-border)] overflow-hidden rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
          {visible.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-[var(--ds-surface-2)]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.category === 'payments' ? 'success' : row.category === 'welfare' ? 'warning' : row.category === 'loans' ? 'info' : 'neutral'}>{row.category.replace('_', ' ')}</Badge>
                  <span className="font-bold text-[var(--ds-secondary)]">{row.who}</span>
                  <span className="text-sm text-[var(--ds-text-muted)]">{row.what}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--ds-text-muted)]">{row.detail}{row.when ? ` · ${row.when}` : ''}</p>
              </div>
              {row.inline === 'payment-proof' && row.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  {canReview ? (
                    <>
                      <button type="button" disabled={saving} onClick={() => onReviewProof?.(row.id!, 'approve')} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Approve</button>
                      <button type="button" disabled={saving} onClick={() => onReviewProof?.(row.id!, 'reject')} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50"><CircleX className="h-4 w-4" />Reject</button>
                    </>
                  ) : (
                    <Badge tone="neutral">Read only</Badge>
                  )}
                </div>
              ) : row.link ? (
                <Link to={row.link} className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] px-3 py-2 text-sm font-bold text-[var(--ds-primary)] transition hover:border-[var(--ds-primary)]">Review<ArrowRight className="h-4 w-4" /></Link>
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

const StatementReconciler = ({ organizationId, onApplied }: { organizationId: string; onApplied: () => void }) => {
  const [statement, setStatement] = useState('');
  const [format, setFormat] = useState<'auto' | 'mpesa' | 'csv'>('auto');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof organizationService.reconcileStatementPreview>> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const runPreview = async () => {
    if (!statement.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setPreview(await organizationService.reconcileStatementPreview(organizationId, statement, format));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Could not read the statement');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const applyMatches = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await organizationService.reconcileStatementApply(organizationId, statement, format);
      setResult(`${outcome.approved} of ${outcome.matched} matched payment${outcome.approved === 1 ? '' : 's'} confirmed automatically.`);
      setPreview(null);
      setStatement('');
      onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not apply the matches');
    } finally {
      setBusy(false);
    }
  };

  const confidenceLabel: Record<string, string> = {
    EXACT: 'Receipt match',
    AMOUNT_DATE: 'Amount + date',
    AMOUNT_ONLY: 'Amount only',
  };

  return (
    <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-bold text-[var(--ds-secondary)]">Reconcile from statement</span>
          <span className="mt-0.5 block text-sm text-[var(--ds-text-muted)]">Paste your M-Pesa or bank statement — matched proofs are confirmed automatically.</span>
        </span>
        <Badge tone={open ? 'success' : 'neutral'}>{open ? 'Close' : 'Open'}</Badge>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['auto', 'mpesa', 'csv'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFormat(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${format === value ? 'bg-[var(--ds-secondary)] text-white' : 'bg-[var(--ds-surface-3)] text-[var(--ds-text-muted)]'}`}>
                {value === 'auto' ? 'Auto-detect' : value === 'mpesa' ? 'M-Pesa text' : 'CSV'}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--ds-secondary)]">Statement content</span>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              rows={6}
              className="input min-h-32 w-full font-mono text-xs"
              placeholder={'Paste M-Pesa SMS lines or bank statement rows here, e.g.\n2026-09-30 Deposit RCB7QX1P2A KES 1,000.00 JANE WANJIKU\n—or a CSV with Date, Amount, Reference, Details columns'}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !statement.trim()} loading={busy} onClick={() => void runPreview()} startIcon={!busy ? <RefreshCw className="h-4 w-4" /> : undefined}>
              Check statement
            </Button>
            {preview && preview.matched > 0 ? (
              <Button type="button" disabled={busy} onClick={() => void applyMatches()} startIcon={!busy ? <CheckCircle2 className="h-4 w-4" /> : undefined}>
                Confirm {preview.matched} match{preview.matched === 1 ? '' : 'es'}
              </Button>
            ) : null}
          </div>
          {preview ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--ds-text-muted)]">{preview.rows} payment row{preview.rows === 1 ? '' : 's'} found · {preview.matched} matched to pending proofs</p>
              {preview.matches.map((match) => (
                <div key={match.proofId} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--ds-radius-lg)] bg-emerald-50 p-3 text-sm">
                  <span className="font-semibold text-emerald-900">{money(match.row.amount)} · {match.row.reference ?? 'no ref'} {match.row.date ? `· ${match.row.date}` : ''}</span>
                  <Badge tone="success">{confidenceLabel[match.confidence] ?? match.confidence}</Badge>
                </div>
              ))}
              {preview.unmatchedRows.length ? (
                <div className="rounded-[var(--ds-radius-lg)] bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-bold">{preview.unmatchedRows.length} statement row{preview.unmatchedRows.length === 1 ? '' : 's'} not matched</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {preview.unmatchedRows.slice(0, 5).map((row, index) => (
                      <li key={index}>{money(row.amount)} · {row.reference ?? 'no ref'} {row.date ? `· ${row.date}` : ''} {row.details ? `· ${row.details}` : ''}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">These deposits have no matching member proof — check if a member paid but never submitted.</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {result ? <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{result}</div> : null}
          {error ? <div className="rounded-[var(--ds-radius-lg)] border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
};
