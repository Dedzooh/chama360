import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock3, FileWarning, RefreshCw, RotateCcw, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { ROUTES } from '../../config/routes';
import { Badge, Button, Card, EmptyState } from '../../design-system';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      setExceptions(await organizationService.listFinancialExceptions(currentOrganization.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load financial exceptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [currentOrganization?.id]);

  const counts = useMemo(() => Object.keys(labels).map((type) => ({ type, label: labels[type], count: exceptions.filter((item) => item.type === type).length })), [exceptions]);

  if (!currentOrganization) return <EmptyState title="No chama selected" description="Open a Chama to review financial exceptions." />;

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline"><span>Finance controls</span><strong>Treasurer workspace</strong></div>
          <div className="chama360-module-hero-copy"><p>{currentOrganization.name}</p><h1>Financial Exceptions</h1><small>Investigate payments that could not be matched, processed, or safely posted to the books.</small></div>
          <div className="chama360-module-hero-actions"><button type="button" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" />Refresh exceptions</button><Link to={ROUTES.chama.reports(currentOrganization.id)}><Wallet className="h-4 w-4" />Open reports</Link></div>
        </div>
        <div className="chama360-module-hero-stats">
          <article><span className="pink"><AlertTriangle className="h-5 w-5" /></span><p>Open</p><strong>{loading ? '...' : exceptions.length}</strong><small>Needs attention</small></article>
          <article><span className="gold"><Clock3 className="h-5 w-5" /></span><p>Webhooks</p><strong>{loading ? '...' : exceptions.filter((item) => item.source === 'MPESA_CALLBACK').length}</strong><small>Awaiting processing</small></article>
          <article><span className="red"><FileWarning className="h-5 w-5" /></span><p>Critical</p><strong>{loading ? '...' : exceptions.filter((item) => ['FAILED_RECONCILIATION', 'STALE_STK_REQUEST', 'UNMATCHED_MPESA_RECEIPT'].includes(item.type)).length}</strong><small>Finance review</small></article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counts.map((item) => <div key={item.type} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><p className="text-sm font-semibold text-[var(--ds-text-muted)]">{item.label}</p><p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{loading ? '...' : item.count}</p></div>)}
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--ds-text-muted)]">Immutable transaction signals</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Open exceptions</h2></div><Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div>
        <div className="section-body space-y-3">
          {loading ? <><div className="h-24 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" /><div className="h-24 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" /></> : exceptions.length === 0 ? <EmptyState title="No financial exceptions" description="All known M-Pesa and transaction records are currently processing normally." /> : exceptions.map((item) => <article key={`${item.source}-${item.id}`} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={tones[item.type] ?? 'neutral'}>{labels[item.type] ?? item.type}</Badge><span className="text-xs font-semibold text-[var(--ds-text-muted)]">{item.source === 'MPESA_CALLBACK' ? 'M-Pesa callback' : item.status}</span></div><h3 className="mt-2 font-black text-[var(--ds-secondary)]">{item.member ? `${item.member.firstName} ${item.member.lastName}` : 'Unassigned payment'}</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.reason}</p></div><div className="text-right"><p className="font-black text-[var(--ds-secondary)]">{formatMoney(item.amount)}</p><p className="mt-1 text-xs text-[var(--ds-text-muted)]">{item.reference}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-[var(--ds-text-muted)]">Received {new Date(item.createdAt).toLocaleString('en-KE')}</span><div className="flex flex-wrap gap-2">{item.source === 'TRANSACTION' ? <Link to={ROUTES.admin.mpesa} className="inline-flex items-center gap-2 font-bold text-[var(--ds-primary)]">Open M-Pesa tools <ArrowRight className="h-4 w-4" /></Link> : <Link to={ROUTES.admin.mpesa} className="inline-flex items-center gap-2 font-bold text-[var(--ds-primary)]"><RotateCcw className="h-4 w-4" />Process callback</Link>}</div></div></article>)}
        </div>
      </section>
    </div>
  );
};
