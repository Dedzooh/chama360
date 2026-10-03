import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileWarning, RefreshCw, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { mpesaService } from '../../services/mpesaService';
import { ROUTES } from '../../config/routes';
import { Badge, Button, Card, EmptyState, SelectField, TextField } from '../../design-system';
import { Link } from 'react-router-dom';

const labels: Record<string, string> = {
  UNMATCHED_MPESA_RECEIPT: 'Unmatched M-Pesa receipts',
  AMOUNT_MISMATCH: 'Amount mismatch',
  UNKNOWN_MEMBER_REFERENCE: 'Unknown member reference',
  DUPLICATE_RECEIPT_ATTEMPT: 'Duplicate receipt attempt',
  FAILED_RECONCILIATION: 'Failed reconciliation',
  NEGATIVE_BALANCE_PREVENTION: 'Negative-balance prevention',
  PENDING_WEBHOOK_PROCESSING: 'Pending webhook processing',
  STALE_STK_REQUEST: 'Stale STK requests',
  REVERSAL_REQUEST: 'Reversal requests',
};

const tones: Record<string, 'error' | 'warning' | 'neutral' | 'info'> = {
  UNMATCHED_MPESA_RECEIPT: 'error',
  AMOUNT_MISMATCH: 'warning',
  UNKNOWN_MEMBER_REFERENCE: 'warning',
  DUPLICATE_RECEIPT_ATTEMPT: 'neutral',
  FAILED_RECONCILIATION: 'error',
  NEGATIVE_BALANCE_PREVENTION: 'warning',
  PENDING_WEBHOOK_PROCESSING: 'info',
  STALE_STK_REQUEST: 'error',
  REVERSAL_REQUEST: 'warning',
};

const formatMoney = (value: number | null) => (value === null ? 'Not available' : `KES ${Number(value).toLocaleString()}`);

export const FinancialExceptionsPage = () => {
  const { currentOrganization } = useOrganizationWorkspace();
  const [exceptions, setExceptions] = useState<Awaited<ReturnType<typeof organizationService.listFinancialExceptions>>>([]);
  const [contributions, setContributions] = useState<Awaited<ReturnType<typeof organizationService.listContributions>>>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [exceptionItems, contributionItems] = await Promise.all([
        organizationService.listFinancialExceptions(currentOrganization.id),
        organizationService.listContributions(currentOrganization.id),
      ]);
      setExceptions(exceptionItems);
      setContributions(contributionItems.filter((item) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(item.status)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load financial exceptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [currentOrganization?.id]);

  const reconcile = async (item: (typeof exceptions)[number]) => {
    const contributionId = assignments[item.id] ?? item.contributionId ?? undefined;
    const contribution = contributions.find((record) => record.id === contributionId);
    const receipt = (receipts[item.id] ?? item.mpesaReceiptNumber ?? '').trim().toUpperCase();
    if (!contribution || !item.amount || !receipt) { setError('Choose a contribution and enter the M-Pesa receipt before matching.'); return; }
    if (!/^\w{10}$/.test(receipt)) { setError('Enter the 10-character M-Pesa receipt shown on the payment confirmation.'); return; }
    if (Number(item.amount) > Number(contribution.amount) + Number(contribution.penalties ?? 0)) { setError('This payment is larger than the selected contribution amount and penalties. Choose the correct contribution or review it outside this flow.'); return; }
    setSavingId(item.id); setError(null); setNotice('');
    try {
      await mpesaService.manualReconcile({ transactionId: item.id, contributionId, mpesaReceiptNumber: receipt, amount: Number(item.amount), phoneNumber: item.phoneNumber ?? undefined, transactionDate: item.createdAt });
      setNotice(`Payment ${receipt} was matched and posted to ${contribution.member?.firstName ?? 'the member'}’s contribution.`);
      await loadData();
    } catch (reconcileError) { setError(reconcileError instanceof Error ? reconcileError.message : 'Could not match this payment.'); }
    finally { setSavingId(''); }
  };

  const counts = useMemo(() => Object.keys(labels).map((type) => ({ type, label: labels[type], count: exceptions.filter((item) => item.isActionable && item.type === type).length })), [exceptions]);

  if (!currentOrganization) return <EmptyState title="No chama selected" description="Open a Chama to review financial exceptions." />;

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline"><span>Finance controls</span><strong>Treasurer workspace</strong></div>
          <div className="chama360-module-hero-copy"><p>{currentOrganization.name}</p><h1>M-Pesa matching queue</h1><small>Match unmatched receipts to a member contribution and record the outcome. Amounts are checked against the original payment before posting.</small></div>
          <div className="chama360-module-hero-actions"><button type="button" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" />Refresh queue</button><Link to={ROUTES.chama.reports(currentOrganization.id)}><Wallet className="h-4 w-4" />Open reports</Link></div>
        </div>
        <div className="chama360-module-hero-stats">
          <article><span className="pink"><AlertTriangle className="h-5 w-5" /></span><p>Open</p><strong>{loading ? '...' : exceptions.filter((item) => item.isActionable).length}</strong><small>Needs attention</small></article>
          <article><span className="gold"><Clock3 className="h-5 w-5" /></span><p>Webhooks</p><strong>{loading ? '...' : exceptions.filter((item) => item.source === 'MPESA_CALLBACK').length}</strong><small>Awaiting processing</small></article>
          <article><span className="red"><FileWarning className="h-5 w-5" /></span><p>Critical</p><strong>{loading ? '...' : exceptions.filter((item) => ['FAILED_RECONCILIATION', 'STALE_STK_REQUEST', 'UNMATCHED_MPESA_RECEIPT'].includes(item.type)).length}</strong><small>Finance review</small></article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card> : null}
      {notice ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counts.map((item) => <div key={item.type} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><p className="text-sm font-semibold text-[var(--ds-text-muted)]">{item.label}</p><p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{loading ? '...' : exceptions.filter((entry) => entry.isActionable && entry.type === item.type).length}</p></div>)}
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--ds-text-muted)]">Only unmatched payments can be actioned here</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Open payment matches</h2></div><Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div>
        <div className="section-body space-y-3">
          {loading ? <><div className="h-24 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" /><div className="h-24 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" /></> : !exceptions.some((item) => item.isActionable) && !exceptions.some((item) => item.source === 'MPESA_CALLBACK') ? <EmptyState title="No unmatched payments" description="All M-Pesa receipts that need action have been matched." /> : exceptions.filter((item) => item.isActionable || item.source === 'MPESA_CALLBACK').map((item) => <article key={`${item.source}-${item.id}`} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={tones[item.type] ?? 'neutral'}>{labels[item.type] ?? item.type}</Badge><span className="text-xs font-semibold text-[var(--ds-text-muted)]">{item.source === 'MPESA_CALLBACK' ? 'M-Pesa callback' : item.status}</span></div><h3 className="mt-2 font-black text-[var(--ds-secondary)]">{item.member ? `${item.member.firstName} ${item.member.lastName}` : 'Unassigned payment'}</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.reason}</p></div><div className="text-right"><p className="font-black text-[var(--ds-secondary)]">{formatMoney(item.amount)}</p><p className="mt-1 text-xs text-[var(--ds-text-muted)]">{item.mpesaReceiptNumber ?? item.reference}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-[var(--ds-text-muted)]">Received {new Date(item.createdAt).toLocaleString('en-KE')}{item.phoneNumber ? ` · ${item.phoneNumber}` : ''}</span>{item.isActionable ? <div className="grid w-full gap-3 border-t border-[var(--ds-border)] pt-4 md:grid-cols-[1fr_auto] md:items-end"><div className="grid gap-3 sm:grid-cols-2"><SelectField label="Match to contribution" value={assignments[item.id] ?? item.contributionId ?? ''} onChange={(event) => setAssignments((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">Choose member and contribution</option>{contributions.map((contribution) => <option key={contribution.id} value={contribution.id}>{contribution.member?.firstName} {contribution.member?.lastName} · {contribution.period ?? 'Contribution'} · Due KES {(Number(contribution.amount) + Number(contribution.penalties ?? 0)).toLocaleString()}</option>)}</SelectField><TextField label="M-Pesa receipt" value={receipts[item.id] ?? item.mpesaReceiptNumber ?? ''} onChange={(event) => setReceipts((current) => ({ ...current, [item.id]: event.target.value.toUpperCase() }))} placeholder="e.g. QWE1234567" /></div><Button disabled={savingId === item.id || !assignments[item.id] && !item.contributionId || (receipts[item.id] ?? item.mpesaReceiptNumber ?? '').trim().length !== 10} onClick={() => void reconcile(item)} startIcon={<Wallet className="h-4 w-4" />}>{savingId === item.id ? 'Matching…' : 'Match payment'}</Button></div> : <span className="text-sm text-[var(--ds-text-muted)]">Callback received · automatic processing is pending</span>}</div></article>)}
        </div>
      </section>
    </div>
  );
};
