import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, Eye, RefreshCw, Send, Wallet } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService } from '../services/organizationService';
import type { Loan, LoanSummary } from '../types';
import { Badge, Button, Card, EmptyState, MetricCard, SelectField, TextField } from '../design-system';
import { ROUTES } from '../config/routes';
import { useAuthStore } from '../store/authStore';

const CURRENCY = 'KES';
const formatMoney = (value: number | string | undefined | null) => `${CURRENCY} ${Number(value ?? 0).toLocaleString()}`;

const getRequiredGuarantorCount = (rules?: Record<string, any> | null) => {
  const value = rules?.guarantorsRequired;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 1;
};

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DEFAULTED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const roleUpper = (value?: string) => (value ?? '').toUpperCase();

type LoanGuarantorRecord = NonNullable<Loan['guarantors']>[number];
type LoanRepaymentItem = NonNullable<Loan['repayments']>[number];

export const Loans = () => {
  const { loanId } = useParams<{ loanId?: string }>();
  const { currentOrganization } = useOrganizationWorkspace();
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [purpose, setPurpose] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [repaymentPeriodMonths, setRepaymentPeriodMonths] = useState('6');
  const [guarantors, setGuarantors] = useState<string[]>([]);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState('CASH');
  const [repaymentReference, setRepaymentReference] = useState('');

  const members = currentOrganization?.members ?? [];
  const loanRules = (currentOrganization && 'settings' in currentOrganization ? currentOrganization.settings?.loanRules : undefined) as Record<string, any> | undefined;
  const requiredGuarantors = getRequiredGuarantorCount(loanRules);
  const maxLoanAmount = Number(loanRules?.maxLoanAmount ?? 0);
  const borrowerId = memberId || user?.id || '';
  const guarantorOptions = members.filter((member) => (member.userId ?? member.id) !== borrowerId);
  const selectedGuarantors = guarantors.filter((guarantorId) => guarantorId !== borrowerId);
  const isReadOnly = ['CLOSED', 'ARCHIVED'].includes(roleUpper(currentOrganization?.status));
  const canApply = !isReadOnly && selectedGuarantors.length >= requiredGuarantors;
  const canApprove = ['OWNER', 'FOUNDER', 'CHAIR', 'ADMIN'].includes(roleUpper(currentOrganization?.myRole));
  const canFinance = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'].includes(roleUpper(currentOrganization?.myRole));

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, loansData, detailData] = await Promise.all([
        organizationService.getLoanSummary(currentOrganization.id),
        organizationService.listLoans(currentOrganization.id),
        loanId ? organizationService.getLoan(currentOrganization.id, loanId) : Promise.resolve(null),
      ]);
      setSummary(summaryData);
      setLoans(loansData);
      setSelectedLoan(detailData ?? loansData.find((loan) => loan.id === loanId) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, loanId]);

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.applyForLoan(currentOrganization.id, {
        memberId: memberId || undefined,
        amountRequested: Number(amountRequested),
        purpose: purpose || undefined,
        interestRate: Number(interestRate),
        repaymentPeriodMonths: Number(repaymentPeriodMonths),
        guarantors: selectedGuarantors,
      });
      setMemberId('');
      setAmountRequested('');
      setPurpose('');
      setInterestRate('5');
      setRepaymentPeriodMonths('6');
      setGuarantors([]);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to apply for loan');
    } finally {
      setSaving(false);
    }
  };

  const reviewLoan = async (loan: Loan, action: 'approve' | 'reject') => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'approve') {
        await organizationService.approveLoan(currentOrganization.id, loan.id);
      } else {
        await organizationService.rejectLoan(currentOrganization.id, loan.id);
      }
      await loadData();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Failed to review loan');
    } finally {
      setSaving(false);
    }
  };

  const disburseLoan = async (loan: Loan) => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.disburseLoan(currentOrganization.id, loan.id);
      await loadData();
    } catch (disburseError) {
      setError(disburseError instanceof Error ? disburseError.message : 'Failed to disburse loan');
    } finally {
      setSaving(false);
    }
  };

  const respondToGuarantee = async (loan: Loan, action: 'accept' | 'decline') => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'accept') {
        await organizationService.acceptLoanGuarantee(currentOrganization.id, loan.id);
      } else {
        await organizationService.declineLoanGuarantee(currentOrganization.id, loan.id);
      }
      await loadData();
    } catch (guaranteeError) {
      setError(guaranteeError instanceof Error ? guaranteeError.message : 'Failed to update guarantee request');
    } finally {
      setSaving(false);
    }
  };

  const recordRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedLoan) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.recordLoanRepayment(currentOrganization.id, selectedLoan.id, {
        amount: Number(repaymentAmount),
        paymentMethod: repaymentMethod,
        reference: repaymentReference || undefined,
      });
      setRepaymentAmount('');
      setRepaymentMethod('CASH');
      setRepaymentReference('');
      await loadData();
    } catch (repaymentError) {
      setError(repaymentError instanceof Error ? repaymentError.message : 'Failed to record repayment');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage loans." />;
  }

  const currentDetail = selectedLoan ?? loans.find((loan) => loan.id === loanId) ?? null;

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-loans">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Loan workflow</span>
            <strong>{isReadOnly ? 'Read only' : 'Active'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Loans</h1>
            <small>Apply, review, disburse, and track repayments with visible approval states.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#loan-application">
              <Send className="h-4 w-4" />
              Apply
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Wallet className="h-5 w-5" /></span>
            <p>Total</p>
            <strong>{loading ? '...' : (summary?.total ?? 0).toString()}</strong>
            <small>Loan requests</small>
          </article>
          <article>
            <span className="gold"><Send className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{loading ? '...' : (summary?.pending ?? 0).toString()}</strong>
            <small>Awaiting review</small>
          </article>
          <article>
            <span className="blue"><CheckCircle2 className="h-5 w-5" /></span>
            <p>Active</p>
            <strong>{loading ? '...' : (summary?.active ?? 0).toString()}</strong>
            <small>Current loans</small>
          </article>
          <article>
            <span className="pink"><Wallet className="h-5 w-5" /></span>
            <p>Outstanding</p>
            <strong>{loading ? '...' : formatMoney(summary?.outstanding)}</strong>
            <small>Remaining balance</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Total" value={loading ? '...' : (summary?.total ?? 0).toString()} caption="Loan requests" tone="emerald" icon={<Wallet className="h-5 w-5" />} />
        <MetricCard title="Pending" value={loading ? '...' : (summary?.pending ?? 0).toString()} caption="Awaiting review" tone="warning" icon={<Badge tone="warning">Review</Badge>} />
        <MetricCard title="Disbursed" value={loading ? '...' : (summary?.active ?? 0).toString()} caption="Current loans" tone="success" icon={<Badge tone="success">Active</Badge>} />
        <MetricCard title="Outstanding" value={loading ? '...' : (summary?.outstanding ?? 0).toString()} caption="Remaining balance" tone="info" icon={<Badge tone="info">Balance</Badge>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Loans</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Loan applications</h2>
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
            ) : loans.length === 0 ? (
              <EmptyState title="No loans yet." description="Submitted loan requests and approval states will appear here." />
            ) : (
              loans.map((loan) => {
                const loanName = loan.purpose || 'Loan request';
                const myGuarantee = loan.guarantors?.find((guarantor) => guarantor.memberId === user?.id);
                const pendingGuarantees = loan.guarantors?.filter((guarantor) => guarantor.status === 'PENDING').length ?? 0;
                return (
                  <Card key={loan.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ds-secondary)]">{loanName}</p>
                        <p className="text-sm text-[var(--ds-text-muted)]">
                          {loan.borrower?.firstName ?? 'Member'} {loan.borrower?.lastName ?? ''}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[loan.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{loan.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ds-text-muted)]">
                      <span>Requested {formatMoney(loan.amountRequested)}</span>
                      {loan.amountApproved !== null && loan.amountApproved !== undefined ? <span>Approved {formatMoney(loan.amountApproved)}</span> : null}
                      <span>{loan.interestRate}% interest</span>
                      {loan.repaymentPeriodMonths ? <span>{loan.repaymentPeriodMonths} months</span> : null}
                      <span>Balance {formatMoney(loan.balance)}</span>
                      {loan.guarantors?.length ? <span>{pendingGuarantees} guarantee request{pendingGuarantees === 1 ? '' : 's'} pending</span> : null}
                    </div>
                    {myGuarantee?.status === 'PENDING' ? (
                      <div className="mt-3 rounded-[var(--ds-radius-lg)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        You have been asked to guarantee this loan.
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={ROUTES.chama.loan(currentOrganization.id, loan.id)}>
                        <Button variant="outline" startIcon={<Eye className="h-4 w-4" />}>
                          Details
                        </Button>
                      </Link>
                      {canApprove && loan.status === 'PENDING' ? (
                        <>
                          <Button disabled={saving} onClick={() => void reviewLoan(loan, 'approve')} startIcon={<CheckCircle2 className="h-4 w-4" />}>
                            Approve
                          </Button>
                          <Button variant="outline" disabled={saving} onClick={() => void reviewLoan(loan, 'reject')} startIcon={<CircleSlash className="h-4 w-4" />}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {canFinance && loan.status === 'APPROVED' ? (
                        <Button variant="outline" disabled={saving} onClick={() => void disburseLoan(loan)} startIcon={<Wallet className="h-4 w-4" />}>
                          Disburse
                        </Button>
                      ) : null}
                      {myGuarantee?.status === 'PENDING' ? (
                        <>
                          <Button variant="outline" disabled={saving} onClick={() => void respondToGuarantee(loan, 'accept')} startIcon={<CheckCircle2 className="h-4 w-4" />}>
                            Accept guarantee
                          </Button>
                          <Button variant="outline" disabled={saving} onClick={() => void respondToGuarantee(loan, 'decline')} startIcon={<CircleSlash className="h-4 w-4" />}>
                            Decline
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="loan-application" className="p-6">
            <p className="text-sm text-[var(--ds-text-muted)]">New application</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Apply for loan</h2>
            {isReadOnly ? <p className="mt-2 text-sm text-amber-700">This Chama is read-only. Loan applications are disabled.</p> : null}
            <p className="mt-2 text-sm text-[var(--ds-text-muted)]">
              Chama rules require {requiredGuarantors} guarantor{requiredGuarantors === 1 ? '' : 's'}
              {maxLoanAmount > 0 ? ` and cap loans at ${formatMoney(maxLoanAmount)}.` : '.'}
            </p>
            <form onSubmit={submitLoan} className="mt-5 space-y-4">
              <SelectField label="Member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                <option value="">Self / current member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.userId ?? member.id}>
                    {member.user?.firstName} {member.user?.lastName}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Amount requested" type="number" min="0" max={maxLoanAmount > 0 ? maxLoanAmount : undefined} step="0.01" value={amountRequested} onChange={(event) => setAmountRequested(event.target.value)} />
                <TextField label="Interest rate %" type="number" min="0" step="0.01" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Repayment months" type="number" min="1" step="1" value={repaymentPeriodMonths} onChange={(event) => setRepaymentPeriodMonths(event.target.value)} />
                <TextField label="Purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
              </div>
              <SelectField
                label="Guarantors"
                value={guarantors[0] ?? ''}
                onChange={(event) => setGuarantors(event.target.value ? [event.target.value] : [])}
                helperText="Pick one or more guarantors using the multi-select below."
              >
                <option value="">Select guarantor</option>
                {guarantorOptions.map((member) => (
                  <option key={member.id} value={member.userId ?? member.id}>
                    {member.user?.firstName} {member.user?.lastName}
                  </option>
                ))}
              </SelectField>
              <select multiple value={guarantors} onChange={(event) => setGuarantors(Array.from(event.target.selectedOptions).map((option) => option.value))} className="input h-32 w-full">
                {guarantorOptions.map((member) => (
                  <option key={member.id} value={member.userId ?? member.id}>
                    {member.user?.firstName} {member.user?.lastName}
                  </option>
                ))}
              </select>
              {selectedGuarantors.length < requiredGuarantors ? (
                <p className="text-sm font-medium text-amber-700">
                  Select {requiredGuarantors - selectedGuarantors.length} more guarantor{requiredGuarantors - selectedGuarantors.length === 1 ? '' : 's'} to meet Chama rules.
                </p>
              ) : null}
              <Button type="submit" disabled={saving || !canApply} loading={saving} className="w-full" startIcon={!saving ? <Send className="h-4 w-4" /> : undefined}>
                Submit application
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ds-text-muted)]">Loan details</p>
                <h2 className="text-xl font-black text-[var(--ds-secondary)]">{currentDetail ? 'Selected loan' : 'Select a loan'}</h2>
              </div>
              {currentDetail ? <Link to={ROUTES.chama.loans(currentOrganization.id)} className="text-sm font-medium text-[var(--ds-text-muted)]">Back to list</Link> : null}
            </div>

            {currentDetail ? (
              <div className="mt-4 space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--ds-secondary)]">{currentDetail.purpose || 'Loan request'}</p>
                      <p className="text-sm text-[var(--ds-text-muted)]">
                        {currentDetail.borrower?.firstName ?? 'Member'} {currentDetail.borrower?.lastName ?? ''}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[currentDetail.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{currentDetail.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ds-text-muted)]">
                    <span>Requested {formatMoney(currentDetail.amountRequested)}</span>
                    {currentDetail.amountApproved !== null && currentDetail.amountApproved !== undefined ? <span>Approved {formatMoney(currentDetail.amountApproved)}</span> : null}
                    <span>Balance {formatMoney(currentDetail.balance)}</span>
                    <span>{currentDetail.interestRate}% interest</span>
                    {currentDetail.repaymentPeriodMonths ? <span>{currentDetail.repaymentPeriodMonths} months</span> : null}
                  </div>
                  {currentDetail.guarantors?.length ? (
                    <div className="mt-3 text-sm text-[var(--ds-text-muted)]">
                      Guarantors: {currentDetail.guarantors.map((guarantor: LoanGuarantorRecord) => {
                        const name = guarantor.member ? `${guarantor.member.firstName} ${guarantor.member.lastName}` : guarantor.memberId;
                        return `${name} (${guarantor.status ?? 'PENDING'})`;
                      }).join(', ')}
                    </div>
                  ) : null}
                  {currentDetail.guarantors?.some((guarantor) => guarantor.memberId === user?.id && guarantor.status === 'PENDING') ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" disabled={saving} onClick={() => void respondToGuarantee(currentDetail, 'accept')} startIcon={<CheckCircle2 className="h-4 w-4" />}>
                        Accept guarantee
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => void respondToGuarantee(currentDetail, 'decline')} startIcon={<CircleSlash className="h-4 w-4" />}>
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </Card>

                {canFinance && currentDetail.status === 'ACTIVE' ? (
                  <Card className="p-4">
                    <h3 className="font-semibold text-[var(--ds-secondary)]">Record repayment</h3>
                    <form onSubmit={recordRepayment} className="mt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField label="Amount" type="number" min="0" step="0.01" value={repaymentAmount} onChange={(event) => setRepaymentAmount(event.target.value)} />
                        <SelectField label="Method" value={repaymentMethod} onChange={(event) => setRepaymentMethod(event.target.value)}>
                          <option value="CASH">Cash</option>
                          <option value="MPESA">M-Pesa</option>
                          <option value="BANK">Bank</option>
                        </SelectField>
                      </div>
                      <TextField label="Reference" value={repaymentReference} onChange={(event) => setRepaymentReference(event.target.value)} />
                      <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <Wallet className="h-4 w-4" /> : undefined}>
                        Record repayment
                      </Button>
                    </form>
                  </Card>
                ) : null}

                {currentDetail.repayments?.length ? (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">Repayment history</h3>
                    <div className="mt-3 space-y-2">
                      {currentDetail.repayments.map((repayment: LoanRepaymentItem) => (
                        <div key={repayment.id} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">
                          <div className="flex items-center justify-between gap-3">
                            <span>{formatMoney(repayment.amount)}</span>
                            <span>{repayment.paymentMethod ?? 'Unspecified'}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3">
                            {repayment.reference ? <span>Ref {repayment.reference}</span> : null}
                            {repayment.paidAt ? <span>Paid {repayment.paidAt.slice(0, 10)}</span> : null}
                            {repayment.recordedBy ? <span>Recorded by {repayment.recordedBy.firstName} {repayment.recordedBy.lastName}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {!currentDetail.repayments?.length ? <EmptyState title="No repayment history yet." description="Repayments will show here after the loan is disbursed and repaid." /> : null}
              </div>
            ) : (
              <EmptyState title="Select a loan" description="Pick a loan from the list to view approvals, guarantors, and repayments." />
            )}
          </Card>
        </div>
      </section>
    </div>
  );
};
