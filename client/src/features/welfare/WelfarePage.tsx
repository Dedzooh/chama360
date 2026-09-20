import { FormEvent, useEffect, useMemo, useState } from 'react';
import { HeartHandshake, Plus, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { useCompactLayout } from '../../hooks/useCompactLayout';
import { organizationService, type WelfareClaimRecord } from '../../services/organizationService';
import { getEnabledWelfareCategories, normalizeWelfareRules, WELFARE_APPROVAL_OPTIONS } from '../../config/welfareRules';
import { Badge, Button, Card, Chip, EmptyState, MetricCard, SelectField, TextField, Timeline, WalletCard } from '../../design-system';

const formatMoney = (value: number | string | undefined | null) => `KES ${Number(value ?? 0).toLocaleString()}`;
const financeRoles = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'];
const reviewRoles = ['OWNER', 'FOUNDER', 'CHAIR', 'ADMIN'];

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  PARTIALLY_APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const Welfare = () => {
  const compactLayout = useCompactLayout();
  const { currentOrganization } = useOrganizationWorkspace();
  const [claims, setClaims] = useState<WelfareClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimType, setClaimType] = useState('MEDICAL');
  const [reason, setReason] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [documentsText, setDocumentsText] = useState('');

  const canReview = useMemo(() => reviewRoles.includes((currentOrganization?.myRole ?? '').toUpperCase()), [currentOrganization?.myRole]);
  const canMarkPaid = useMemo(() => financeRoles.includes((currentOrganization?.myRole ?? '').toUpperCase()), [currentOrganization?.myRole]);
  const welfareRules = useMemo(() => {
    const metadata = (currentOrganization?.metadata ?? {}) as { welfareRules?: unknown };
    return normalizeWelfareRules(metadata.welfareRules, Boolean(currentOrganization?.enabledModules?.welfare));
  }, [currentOrganization?.enabledModules?.welfare, currentOrganization?.metadata]);
  const enabledWelfareCategories = useMemo(() => getEnabledWelfareCategories(welfareRules), [welfareRules]);
  const selectedCategoryRule = enabledWelfareCategories.find((category) => category.key === claimType) ?? enabledWelfareCategories[0] ?? null;

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.listWelfareClaims(currentOrganization.id);
      setClaims(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load welfare claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (!enabledWelfareCategories.length) return;
    if (!enabledWelfareCategories.some((category) => category.key === claimType)) {
      setClaimType(enabledWelfareCategories[0].key);
    }
  }, [claimType, enabledWelfareCategories]);

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    const requestedAmount = Number(amountRequested);
    const documents = documentsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!welfareRules.enabled) {
      setError('Welfare claims are disabled for this chama.');
      return;
    }
    if (!selectedCategoryRule) {
      setError('Enable at least one welfare claim category before submitting a claim.');
      return;
    }
    if (requestedAmount > welfareRules.maxClaimAmount) {
      setError(`This claim exceeds the chama maximum of ${formatMoney(welfareRules.maxClaimAmount)}.`);
      return;
    }
    if (selectedCategoryRule.limit > 0 && requestedAmount > selectedCategoryRule.limit) {
      setError(`${selectedCategoryRule.label} claims are limited to ${formatMoney(selectedCategoryRule.limit)}.`);
      return;
    }
    if (welfareRules.requireDocuments && documents.length === 0) {
      setError('This welfare chama requires supporting documents for claims.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await organizationService.submitWelfareClaim(currentOrganization.id, {
        claimType,
        reason,
        amountRequested: requestedAmount,
        documents,
      });
      setClaimType(enabledWelfareCategories[0]?.key ?? 'MEDICAL');
      setReason('');
      setAmountRequested('');
      setDocumentsText('');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit welfare claim');
    } finally {
      setSaving(false);
    }
  };

  const reviewClaim = async (claimId: string, action: 'approve' | 'reject') => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'approve') {
        await organizationService.approveWelfareClaim(currentOrganization.id, claimId);
      } else {
        await organizationService.rejectWelfareClaim(currentOrganization.id, claimId);
      }
      await loadData();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Failed to review welfare claim');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (claimId: string) => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.markWelfareClaimPaid(currentOrganization.id, claimId);
      await loadData();
    } catch (paidError) {
      setError(paidError instanceof Error ? paidError.message : 'Failed to mark claim as paid');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage welfare claims." />;
  }

  const pendingCount = claims.filter((claim) => claim.status === 'PENDING').length;
  const paidCount = claims.filter((claim) => claim.status === 'PAID').length;
  const requestedTotal = claims.reduce((sum, claim) => sum + Number(claim.amountRequested ?? 0), 0);
  const approvalLabel = WELFARE_APPROVAL_OPTIONS.find((option) => option.value === welfareRules.approvalMode)?.label ?? welfareRules.approvalMode;
  const categoryLimitText = selectedCategoryRule ? `Limit: ${formatMoney(Math.min(selectedCategoryRule.limit || welfareRules.maxClaimAmount, welfareRules.maxClaimAmount))}` : 'No category enabled';
  const documentPlaceholder = selectedCategoryRule?.documents.length ? selectedCategoryRule.documents.join('\n') : 'One document reference or URL per line';

  const mobileLayout = (
    <div className="space-y-4 md:hidden">
      <section className="hero-card mobile-finance-card overflow-hidden p-0">
        <div className="mobile-primary-strip p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Welfare</p>
          <h1 className="mt-2 text-2xl font-black">{currentOrganization.name}</h1>
          <p className="mt-1 text-sm text-white/82">Claims and support</p>
        </div>
        <div className="p-4">
          <WalletCard name="Welfare queue" balance={formatMoney(claims.reduce((sum, claim) => sum + Number(claim.amountRequested ?? 0), 0))} detail={`${pendingCount} pending | ${paidCount} paid | max ${formatMoney(welfareRules.maxClaimAmount)}`} status={welfareRules.enabled ? 'Support fund' : 'Claims paused'} />
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid grid-cols-3 gap-2.5">
        <MetricCard title="Claims" value={loading ? '...' : claims.length.toString()} caption="Submitted" tone="emerald" icon={<Wallet className="h-5 w-5" />} className="p-4" />
        <MetricCard title="Pending" value={loading ? '...' : pendingCount.toString()} caption="Need review" tone="warning" icon={<Badge tone="warning">Open</Badge>} className="p-4" />
        <MetricCard title="Paid" value={loading ? '...' : paidCount.toString()} caption="Completed" tone="success" icon={<Badge tone="success">Done</Badge>} className="p-4" />
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Rules</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Welfare policy</h2>
        </div>
        <div className="section-body grid gap-2 text-sm text-[var(--ds-text-muted)]">
          <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-2">Monthly: {formatMoney(welfareRules.monthlyContribution)}</span>
          <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-2">Max claim: {formatMoney(welfareRules.maxClaimAmount)}</span>
          <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-2">{approvalLabel}</span>
          <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-2">{enabledWelfareCategories.length} active categories</span>
        </div>
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Filters</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Review claims</h2>
        </div>
        <div className="section-body flex flex-wrap gap-2">
          <Chip active onClick={() => void loadData()}>
            Refresh
          </Chip>
          <Chip active={canReview} onClick={() => void loadData()}>
            Committee
          </Chip>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <>
            <div className="h-24 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
            <div className="h-24 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
          </>
        ) : claims.length === 0 ? (
          <EmptyState title="No welfare claims yet." description="Claims will appear once members submit requests for support." />
        ) : (
          claims.map((claim) => {
            const canApprove = canReview && claim.status === 'PENDING';
            const canPay = canMarkPaid && (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED');
            return (
              <Card key={claim.id} className="mobile-finance-card overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{claim.claimType ?? claim.type ?? 'Claim'}</p>
                      <h3 className="mt-2 text-lg font-black text-[var(--ds-secondary)]">{claim.reason ?? claim.description}</h3>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[claim.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{claim.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                      <p className="text-xs text-[var(--ds-text-muted)]">Requested</p>
                      <p className="mt-1 font-bold text-[var(--ds-text)]">{formatMoney(claim.amountRequested)}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                      <p className="text-xs text-[var(--ds-text-muted)]">Approved</p>
                      <p className="mt-1 font-bold text-[var(--ds-text)]">{formatMoney(claim.amountApproved ?? 0)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ds-text-muted)]">
                    <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">
                      By {claim.requestedBy?.firstName ?? 'Member'} {claim.requestedBy?.lastName ?? ''}
                    </span>
                    {Array.isArray(claim.documents) ? <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{claim.documents.length} document(s)</span> : null}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {canApprove ? (
                      <>
                        <Button className="flex-1" disabled={saving} onClick={() => void reviewClaim(claim.id, 'approve')} startIcon={<ThumbsUp className="h-4 w-4" />}>
                          Approve
                        </Button>
                        <Button variant="outline" className="flex-1" disabled={saving} onClick={() => void reviewClaim(claim.id, 'reject')} startIcon={<ThumbsDown className="h-4 w-4" />}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {canPay ? (
                      <Button variant="outline" className="flex-1" disabled={saving} onClick={() => void markPaid(claim.id)} startIcon={<Wallet className="h-4 w-4" />}>
                        Mark paid
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Submit</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">New welfare claim</h2>
        </div>
        <div className="section-body">
          <form onSubmit={submitClaim} className="space-y-4">
            <SelectField label="Category" value={claimType} onChange={(event) => setClaimType(event.target.value)}>
              {enabledWelfareCategories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </SelectField>
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">{categoryLimitText}</p>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Reason</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="input min-h-28 w-full" />
            </label>
            <TextField label="Amount requested" type="number" min="0" step="0.01" value={amountRequested} onChange={(e) => setAmountRequested(e.target.value)} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Documents</span>
              <textarea
                value={documentsText}
                onChange={(e) => setDocumentsText(e.target.value)}
                rows={3}
                className="input min-h-24 w-full"
                placeholder={documentPlaceholder}
              />
            </label>
            <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <Plus className="h-4 w-4" /> : undefined}>
              Submit claim
            </Button>
          </form>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      {compactLayout ? mobileLayout : <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-welfare">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Welfare workflow</span>
            <strong>{canReview ? 'Committee' : 'Member support'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Welfare</h1>
            <small>Submit claims, verify documents, and review support decisions with clear approval states.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#welfare-claim">
              <Plus className="h-4 w-4" />
              New claim
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><HeartHandshake className="h-5 w-5" /></span>
            <p>Claims</p>
            <strong>{loading ? '...' : claims.length.toString()}</strong>
            <small>Submitted</small>
          </article>
          <article>
            <span className="gold"><ShieldCheck className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{loading ? '...' : pendingCount.toString()}</strong>
            <small>Waiting review</small>
          </article>
          <article>
            <span className="blue"><ThumbsUp className="h-5 w-5" /></span>
            <p>Paid</p>
            <strong>{loading ? '...' : paidCount.toString()}</strong>
            <small>Completed claims</small>
          </article>
          <article>
            <span className="pink"><Wallet className="h-5 w-5" /></span>
            <p>Requested</p>
            <strong>{loading ? '...' : formatMoney(requestedTotal)}</strong>
            <small>Total support value</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Claims" value={loading ? '...' : claims.length.toString()} caption="Submitted" tone="emerald" icon={<Wallet className="h-5 w-5" />} />
        <MetricCard title="Pending" value={loading ? '...' : claims.filter((claim) => claim.status === 'PENDING').length.toString()} caption="Waiting review" tone="warning" icon={<Badge tone="warning">Open</Badge>} />
        <MetricCard title="Paid" value={loading ? '...' : claims.filter((claim) => claim.status === 'PAID').length.toString()} caption="Completed claims" tone="success" icon={<Badge tone="success">Paid</Badge>} />
      </section>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-[var(--ds-text-muted)]">Custom rules</p>
            <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Welfare policy</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ds-text-muted)]">
              Monthly contribution {formatMoney(welfareRules.monthlyContribution)}, maximum claim {formatMoney(welfareRules.maxClaimAmount)}, {welfareRules.waitingPeriodDays} day waiting period.
            </p>
          </div>
          <Badge tone={welfareRules.enabled ? 'success' : 'neutral'}>{welfareRules.enabled ? 'Claims enabled' : 'Claims paused'}</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-[var(--ds-surface-2)] px-4 py-3">
            <p className="text-xs text-[var(--ds-text-muted)]">Approval</p>
            <p className="mt-1 font-bold text-[var(--ds-secondary)]">{approvalLabel}</p>
          </div>
          <div className="rounded-2xl bg-[var(--ds-surface-2)] px-4 py-3">
            <p className="text-xs text-[var(--ds-text-muted)]">Categories</p>
            <p className="mt-1 font-bold text-[var(--ds-secondary)]">{enabledWelfareCategories.length} active</p>
          </div>
          <div className="rounded-2xl bg-[var(--ds-surface-2)] px-4 py-3">
            <p className="text-xs text-[var(--ds-text-muted)]">Documents</p>
            <p className="mt-1 font-bold text-[var(--ds-secondary)]">{welfareRules.requireDocuments ? 'Required' : 'Optional'}</p>
          </div>
          <div className="rounded-2xl bg-[var(--ds-surface-2)] px-4 py-3">
            <p className="text-xs text-[var(--ds-text-muted)]">Partial approval</p>
            <p className="mt-1 font-bold text-[var(--ds-secondary)]">{welfareRules.allowPartialApproval ? 'Allowed' : 'Off'}</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card id="welfare-claim" className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Claims</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Submitted welfare claims</h2>
            </div>
            <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
                <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
                <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
              </div>
            ) : claims.length === 0 ? (
              <EmptyState title="No welfare claims yet." description="Claims will appear once members submit requests for support." />
            ) : (
              claims.map((claim) => {
                const canApprove = canReview && claim.status === 'PENDING';
                const canPay = canMarkPaid && (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED');
                return (
                  <Card key={claim.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ds-secondary)]">{claim.claimType ?? claim.type ?? 'Claim'}</p>
                        <p className="text-sm text-[var(--ds-text-muted)]">{claim.reason ?? claim.description}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[claim.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{claim.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ds-text-muted)]">
                      <span>Requested {formatMoney(claim.amountRequested)}</span>
                      {claim.amountApproved !== null && claim.amountApproved !== undefined ? <span>Approved {formatMoney(claim.amountApproved)}</span> : null}
                      <span>
                        By {claim.requestedBy?.firstName ?? 'Member'} {claim.requestedBy?.lastName ?? ''}
                      </span>
                      {Array.isArray(claim.documents) ? <span>{claim.documents.length} document(s)</span> : null}
                      {claim.paidAt ? <span>Paid {claim.paidAt.slice(0, 10)}</span> : null}
                    </div>
                    {canApprove || canPay ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canApprove ? (
                          <>
                            <Button disabled={saving} onClick={() => void reviewClaim(claim.id, 'approve')} startIcon={<ThumbsUp className="h-4 w-4" />}>
                              Approve
                            </Button>
                            <Button variant="outline" disabled={saving} onClick={() => void reviewClaim(claim.id, 'reject')} startIcon={<ThumbsDown className="h-4 w-4" />}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {canPay ? (
                          <Button variant="outline" disabled={saving} onClick={() => void markPaid(claim.id)} startIcon={<Wallet className="h-4 w-4" />}>
                            Mark paid
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-[var(--ds-text-muted)]">New claim</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Submit welfare claim</h2>
          <form onSubmit={submitClaim} className="mt-5 space-y-4">
            <SelectField label="Category" value={claimType} onChange={(event) => setClaimType(event.target.value)}>
              {enabledWelfareCategories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </SelectField>
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">{categoryLimitText}</p>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="input min-h-28 w-full"
              />
            </label>
            <TextField label="Amount requested" type="number" min="0" step="0.01" value={amountRequested} onChange={(e) => setAmountRequested(e.target.value)} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Documents</span>
              <textarea
                value={documentsText}
                onChange={(e) => setDocumentsText(e.target.value)}
                rows={3}
                className="input min-h-24 w-full"
                placeholder={documentPlaceholder}
              />
            </label>
            <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <Plus className="h-4 w-4" /> : undefined}>
              Submit claim
            </Button>
          </form>
        </Card>
      </section>

      <Card className="p-6">
        <p className="text-sm text-[var(--ds-text-muted)]">Workflow</p>
        <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Review sequence</h2>
        <div className="mt-4">
          <Timeline
            items={[
              { title: 'Submit claim', description: 'Member files request and uploads documents' },
              { title: 'Committee review', description: 'Reviewers approve or reject the request' },
              { title: 'Payment', description: 'Finance marks the claim as paid after disbursement' },
            ]}
          />
        </div>
      </Card>
      </div>}
    </div>
  );
};
