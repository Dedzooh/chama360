import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Download, History, ReceiptText, RefreshCw, Search, Send, Smartphone, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService } from '../services/organizationService';
import { mpesaService, type MpesaHistoryRecord } from '../services/mpesaService';

const formatMoney = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;

export const MpesaAdmin = () => {
  const { currentOrganization } = useOrganizationWorkspace();
  const [contributions, setContributions] = useState<Array<{ id: string; amount: number; status: string; period?: string | null; penalties?: number; member?: { firstName: string; lastName: string } | null }>>([]);
  const [history, setHistory] = useState<MpesaHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [statusResult, setStatusResult] = useState<string>('');
  const [selectedContributionId, setSelectedContributionId] = useState('');
  const [initPhone, setInitPhone] = useState('');
  const [accountReference, setAccountReference] = useState('');
  const [transactionDesc, setTransactionDesc] = useState('Contribution payment');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [bulkText, setBulkText] = useState('');

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const [contributionData, historyData] = await Promise.all([
        organizationService.listContributions(currentOrganization.id),
        mpesaService.history({ chamaId: currentOrganization.id, limit: 50 }),
      ]);
      setContributions(
        contributionData.filter((item) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(item.status)).map((item) => ({
          id: item.id,
          amount: item.amount,
          status: item.status,
          period: item.period,
          penalties: item.penalties,
          member: item.member ? { firstName: item.member.firstName, lastName: item.member.lastName } : null,
        }))
      );
      setHistory(historyData.payments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load M-Pesa data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const filteredHistory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return history.filter((payment) => {
      if (!term) return true;
      return (
        payment.reference?.toLowerCase().includes(term) ||
        payment.mpesaReceiptNumber?.toLowerCase().includes(term) ||
        payment.contributionId?.toLowerCase().includes(term) ||
        payment.member?.firstName?.toLowerCase().includes(term) ||
        payment.member?.lastName?.toLowerCase().includes(term)
      );
    });
  }, [history, searchTerm]);

  const initiate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedContributionId || !initPhone.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await mpesaService.initiate({
        contributionId: selectedContributionId,
        phoneNumber: initPhone.trim(),
        accountReference: accountReference.trim() || undefined,
        transactionDesc: transactionDesc.trim() || undefined,
      });
      setMessage(`STK push sent: ${response.data.checkoutRequestId}`);
      setCheckoutRequestId(response.data.checkoutRequestId);
      await loadData();
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : 'Failed to initiate payment');
    } finally {
      setSaving(false);
    }
  };

  const queryStatus = async () => {
    if (!checkoutRequestId.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const status = await mpesaService.queryStatus(checkoutRequestId.trim());
      setStatusResult(`${status.status ?? 'UNKNOWN'}${status.mpesaReceiptNumber ? ` - ${status.mpesaReceiptNumber}` : ''}${status.resultDescription ? ` - ${status.resultDescription}` : ''}`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to query status');
    } finally {
      setSaving(false);
    }
  };

  const manualReconcile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedContributionId || !manualReceipt.trim() || !manualAmount.trim() || !manualDate) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await mpesaService.manualReconcile({
        contributionId: selectedContributionId,
        mpesaReceiptNumber: manualReceipt.trim(),
        amount: Number(manualAmount),
        phoneNumber: manualPhone.trim() || undefined,
        transactionDate: new Date(manualDate).toISOString(),
      });
      setMessage('Payment reconciled successfully.');
      setManualReceipt('');
      setManualAmount('');
      setManualPhone('');
      await loadData();
    } catch (reconcileError) {
      setError(reconcileError instanceof Error ? reconcileError.message : 'Failed to reconcile payment');
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    if (!selectedContributionId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await mpesaService.retryPayment(selectedContributionId, initPhone.trim() || undefined);
      setMessage(`Retry initiated: ${response.data.checkoutRequestId}`);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry payment');
    } finally {
      setSaving(false);
    }
  };

  const bulkReconcile = async () => {
    const payments = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [contributionId, mpesaReceiptNumber, amount, phoneNumber, transactionDate] = line.split(',').map((part) => part.trim());
        return {
          contributionId,
          mpesaReceiptNumber,
          amount: Number(amount),
          phoneNumber: phoneNumber || undefined,
          transactionDate: new Date(transactionDate || new Date()).toISOString(),
        };
      })
      .filter((payment) => payment.contributionId && payment.mpesaReceiptNumber && Number.isFinite(payment.amount));

    if (!payments.length) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await mpesaService.bulkReconcile(payments);
      setMessage(`Bulk reconcile completed: ${response.summary.successful}/${response.summary.total} successful.`);
      setBulkText('');
      await loadData();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Failed to bulk reconcile');
    } finally {
      setSaving(false);
    }
  };

  const reviewUnmatchedPayment = (payment: MpesaHistoryRecord) => {
    setManualReceipt(payment.mpesaReceiptNumber ?? payment.reference?.replace(/^MPESA-C2B-/, '') ?? '');
    setManualAmount(String(payment.amount ?? ''));
    setManualPhone(payment.phoneNumber ?? '');
    setManualDate(new Date(payment.createdAt ?? Date.now()).toISOString().slice(0, 16));
    window.setTimeout(() => document.getElementById('mpesa-manual')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  if (!currentOrganization) {
    return <div className="section-shell p-6">Open a Chama from My Chamas to manage M-Pesa settings.</div>;
  }

  const totalCollected = history.filter((payment) => ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'].includes(payment.status.toUpperCase())).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const successfulPayments = history.filter((payment) => ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID'].includes(payment.status.toUpperCase())).length;
  const reconciliationRequired = history.filter((payment) => payment.reconciliationRequired).length;

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-mpesa">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>M-Pesa Admin</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Payments and reconciliation</h1>
            <p>Initiate STK Push requests, query payment status, and reconcile contribution receipts.</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#mpesa-stk">
              <Smartphone className="h-4 w-4" />
              STK Push
            </a>
            <a href="#mpesa-history">
              <History className="h-4 w-4" />
              History
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Banknote className="h-5 w-5" /></span>
            <p>Collected</p>
            <strong>{loading ? '...' : formatMoney(totalCollected)}</strong>
            <small>From payment history</small>
          </article>
          <article>
            <span className="blue"><ReceiptText className="h-5 w-5" /></span>
            <p>Payments</p>
            <strong>{loading ? '...' : history.length}</strong>
            <small>{successfulPayments} successful · {reconciliationRequired} need review</small>
          </article>
          <article>
            <span className="gold"><Wallet className="h-5 w-5" /></span>
            <p>Ready for STK</p>
            <strong>{loading ? '...' : contributions.length}</strong>
            <small>{statusResult ? 'Status checked' : 'No query yet'}</small>
          </article>
        </div>
      </section>

      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}
      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <form id="mpesa-stk" onSubmit={initiate} className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">STK Push</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Initiate payment</h2>
            </div>
            <div className="section-body space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Contribution</span>
                <select value={selectedContributionId} onChange={(event) => setSelectedContributionId(event.target.value)} className="mt-1 w-full input">
                  <option value="">Select contribution</option>
                  {contributions.map((contribution) => (
                    <option key={contribution.id} value={contribution.id}>
                      {contribution.period ?? contribution.id.slice(0, 8)} · {contribution.status} · {formatMoney(Number(contribution.amount) + Number(contribution.penalties ?? 0))} {contribution.member ? `· ${contribution.member.firstName} ${contribution.member.lastName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[var(--ds-secondary)]">Phone number</span>
                  <input value={initPhone} onChange={(event) => setInitPhone(event.target.value)} className="mt-1 w-full input" placeholder="2547..." />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-[var(--ds-secondary)]">Account reference</span>
                  <input value={accountReference} onChange={(event) => setAccountReference(event.target.value)} className="mt-1 w-full input" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Transaction description</span>
                <input value={transactionDesc} onChange={(event) => setTransactionDesc(event.target.value)} className="mt-1 w-full input" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  Send STK
                </button>
                <button type="button" onClick={() => void retry()} disabled={saving} className="btn btn-outline disabled:opacity-60">
                  Retry payment
                </button>
              </div>
            </div>
          </form>

          <section id="mpesa-history" className="section-shell overflow-hidden">
            <div className="section-header flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--ds-text-muted)]">History</p>
                <h2 className="text-xl font-black text-[var(--ds-secondary)]">Payment history</h2>
              </div>
              <button type="button" onClick={() => void loadData()} className="btn btn-outline">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            <div className="section-body space-y-3">
              <label className="flex items-center gap-3 rounded-2xl border border-(--border) bg-white px-4 py-3">
                <Search className="h-4 w-4 text-(--muted)" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search receipt, reference, member, contribution" />
              </label>
              {loading ? (
                <div className="space-y-3">
                  <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="empty-state p-6 text-center text-(--muted)">No payment history found.</div>
              ) : (
              filteredHistory.map((payment) => (
                <div key={payment.id} className="dashboard-tile p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                        <ReceiptText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-(--secondary)">{payment.mpesaReceiptNumber || payment.reference || payment.id}</p>
                        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
                          {payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : 'Unknown member'}
                        </p>
                        {payment.accountReference ? <p className="mt-1 text-xs font-semibold text-[var(--ds-text-muted)]">Account ref: {payment.accountReference}</p> : null}
                        {payment.reconciliationRequired ? <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Manual reconciliation required</p> : null}
                        {payment.reconciliationRequired ? <button type="button" onClick={() => reviewUnmatchedPayment(payment)} className="mt-2 block text-sm font-bold text-[var(--ds-primary)] hover:underline">Review and assign payment</button> : null}
                        <p className="mt-1 text-xs text-[var(--ds-text-muted)]">{payment.createdAt ? new Date(payment.createdAt).toLocaleString() : ''}</p>
                      </div>
                    </div>
                      <div className="text-left lg:text-right">
                        <p className="font-black text-[var(--ds-secondary)]">{formatMoney(payment.amount)}</p>
                        <p className="mt-1 inline-flex rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-sm font-bold text-[var(--ds-text-muted)]">{payment.status}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section id="mpesa-query" className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Query</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Check payment status</h2>
            </div>
            <div className="section-body space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Checkout request ID</span>
                <input value={checkoutRequestId} onChange={(event) => setCheckoutRequestId(event.target.value)} className="mt-1 w-full input" />
              </label>
              <button type="button" onClick={() => void queryStatus()} disabled={saving} className="btn btn-primary disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" />
                Query status
              </button>
              {statusResult ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{statusResult}</div>
              ) : null}
            </div>
          </section>

          <section id="mpesa-manual" className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-[var(--ds-text-muted)]">Manual reconcile</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Record receipt</h2>
            </div>
            <form onSubmit={manualReconcile} className="section-body space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Receipt number</span>
                <input value={manualReceipt} onChange={(event) => setManualReceipt(event.target.value)} className="mt-1 w-full input" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[var(--ds-secondary)]">Amount</span>
                  <input value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full input" />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-[var(--ds-secondary)]">Phone number</span>
                  <input value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} className="mt-1 w-full input" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-[var(--ds-secondary)]">Transaction date</span>
                <input value={manualDate} onChange={(event) => setManualDate(event.target.value)} type="datetime-local" className="mt-1 w-full input" />
              </label>
              <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
                <Wallet className="h-4 w-4" />
                Reconcile payment
              </button>
            </form>
          </section>

          <section id="mpesa-bulk" className="section-shell overflow-hidden">
            <div className="section-header flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--ds-text-muted)]">Bulk</p>
                <h2 className="text-xl font-black text-[var(--ds-secondary)]">Bulk reconcile</h2>
              </div>
              <Download className="h-4 w-4 text-(--muted)" />
            </div>
            <div className="section-body space-y-4">
              <p className="text-sm text-[var(--ds-text-muted)]">Paste one payment per line: contributionId, mpesaReceiptNumber, amount, phoneNumber, transactionDate.</p>
              <textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={6} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
              <button type="button" onClick={() => void bulkReconcile()} disabled={saving} className="btn btn-outline disabled:opacity-60">
                <AlertTriangle className="h-4 w-4" />
                Bulk reconcile
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
