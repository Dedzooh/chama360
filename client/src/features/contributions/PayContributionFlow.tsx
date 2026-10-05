import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { Button, TextField } from '../../design-system';
import {
  organizationService,
  type OutstandingObligationRecord,
  type OrganizationPaymentMethodRecord,
} from '../../services/organizationService';

// Member-facing contribution payment flow.
//
// Payer ≠ Beneficiary: the person who sends the money (the payer) is recorded
// separately from the member whose obligation is being settled. A member can
// pay for themselves, for another member, or for several members in one
// payment. Allocations are explicit — leftover money is never silently
// assigned; it is flagged as unallocated for the Treasurer.

type BeneficiaryChoice = {
  memberId: string;
  memberName: string;
  obligation: OutstandingObligationRecord;
  amount: number;
};

type PayContributionFlowProps = {
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  members: Array<{ id: string; userId?: string; user?: { firstName?: string; lastName?: string } | null; status?: string }>;
  onClose: () => void;
  onPaid?: (message: string) => void;
};

const formatMoney = (value: number) => `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PayContributionFlow = ({ organizationId, currentUserId, currentUserName, members, onClose, onPaid }: PayContributionFlowProps) => {
  const [step, setStep] = useState<'WHO' | 'HOW' | 'DONE'>('WHO');
  const [outstanding, setOutstanding] = useState<OutstandingObligationRecord[]>([]);
  const [methods, setMethods] = useState<OrganizationPaymentMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [choices, setChoices] = useState<BeneficiaryChoice[]>([]);
  const [methodId, setMethodId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      organizationService.listOutstanding(organizationId),
      organizationService.listPaymentMethods(organizationId).catch(() => ({ methods: [] as OrganizationPaymentMethodRecord[], canManage: false })),
    ])
      .then(([obligations, methodData]) => {
        if (cancelled) return;
        setOutstanding(obligations);
        const active = methodData.methods.filter((method) => method.status === 'ACTIVE');
        setMethods(active);
        setMethodId(active.find((method) => method.isDefault)?.id ?? active[0]?.id ?? '');
      })
      .catch(() => setError('Could not load your contribution obligations.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  const memberName = (userId: string) => {
    const member = members.find((candidate) => (candidate.userId ?? candidate.id) === userId);
    return member ? `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() || 'Member' : 'Member';
  };

  const myObligations = useMemo(() => outstanding.filter((item) => item.memberId === currentUserId), [outstanding, currentUserId]);
  const others = useMemo(() => {
    const byMember = new Map<string, OutstandingObligationRecord[]>();
    for (const item of outstanding) {
      if (item.memberId === currentUserId) continue;
      const list = byMember.get(item.memberId) ?? [];
      list.push(item);
      byMember.set(item.memberId, list);
    }
    return [...byMember.entries()]
      .map(([memberId, obligations]) => ({
        memberId,
        memberName: memberName(memberId),
        obligations: obligations.sort((a, b) => (a.period ?? '').localeCompare(b.period ?? '')),
        totalDue: obligations.reduce((sum, item) => sum + item.due, 0),
      }))
      .filter((entry) => !search.trim() || entry.memberName.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.totalDue - a.totalDue);
  }, [outstanding, currentUserId, search, members]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = choices.reduce((sum, choice) => sum + choice.amount, 0);

  const addMyself = () => {
    if (!myObligations.length) return;
    setChoices(myObligations.map((obligation) => ({
      memberId: currentUserId,
      memberName: currentUserName || 'Myself',
      obligation,
      amount: obligation.due,
    })));
  };

  const addOther = (obligation: OutstandingObligationRecord, memberLabel: string) => {
    setChoices((current) => {
      if (current.some((choice) => choice.obligation.contributionId === obligation.contributionId)) return current;
      return [...current, { memberId: obligation.memberId, memberName: memberLabel, obligation, amount: obligation.due }];
    });
  };

  const submit = async () => {
    if (!choices.length || totalAmount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await organizationService.recordPayment(organizationId, {
        amount: Number(totalAmount.toFixed(2)),
        paymentMethod: 'MPESA',
        paymentMethodId: methodId || undefined,
        transactionReference: reference.trim() || undefined,
        allocations: choices.map((choice) => ({
          memberId: choice.memberId,
          amount: Number(choice.amount.toFixed(2)),
          contributionId: choice.obligation.contributionId,
          period: choice.obligation.period ?? undefined,
          contributionType: choice.obligation.contributionType ?? undefined,
        })),
      });
      setDoneMessage(
        result.unallocated > 0
          ? `Payment recorded. ${formatMoney(result.unallocated)} is not yet allocated — the Treasurer will confirm what it covers.`
          : 'Payment recorded with its allocations. Thank you!',
      );
      setStep('DONE');
      onPaid?.(doneMessage);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not record the payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'DONE') {
    return (
      <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-2 text-lg font-black text-emerald-900">Payment recorded</h3>
        <p className="mt-1 text-sm text-emerald-800">{doneMessage}</p>
        <Button className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step === 'WHO' && (
        <>
          <div>
            <h3 className="text-lg font-black text-[var(--ds-secondary)]">Pay contribution</h3>
            <p className="text-sm text-[var(--ds-text-muted)]">Who are you paying for?</p>
          </div>

          {loading ? <p className="text-sm text-[var(--ds-text-muted)]">Loading obligations…</p> : (
            <>
              <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
                <p className="font-bold text-[var(--ds-secondary)]">Myself{currentUserName ? ` — ${currentUserName}` : ''}</p>
                {myObligations.length === 0 ? (
                  <p className="mt-1 text-sm text-emerald-700">You have no outstanding contributions. 🎉</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1 text-sm">
                      {myObligations.map((obligation) => (
                        <li key={obligation.contributionId} className="flex items-center justify-between gap-2">
                          <span>{obligation.period ?? 'Contribution'}{obligation.contributionType ? ` · ${obligation.contributionType}` : ''}</span>
                          <strong>{formatMoney(obligation.due)}</strong>
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-3 w-full" onClick={addMyself}>Pay my contributions ({formatMoney(myObligations.reduce((sum, item) => sum + item.due, 0))})</Button>
                  </>
                )}
              </div>

              <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
                <p className="font-bold text-[var(--ds-secondary)]"><Users className="mr-1 inline h-4 w-4" /> Another member</p>
                <p className="mt-1 text-xs text-[var(--ds-text-muted)]">You can pay on behalf of another member. The record will show you as the payer and them as the beneficiary.</p>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-muted)]" />
                  <input
                    className="w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-9 pr-3 text-sm"
                    placeholder="Search member…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {others.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--ds-text-muted)]">No outstanding contributions found for other members.</p>
                ) : (
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {others.map((entry) => (
                      <li key={entry.memberId} className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] p-2">
                        <div className="flex items-center justify-between text-sm"><strong>{entry.memberName}</strong><span>{formatMoney(entry.totalDue)} due</span></div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.obligations.map((obligation) => (
                            <button
                              key={obligation.contributionId}
                              type="button"
                              onClick={() => addOther(obligation, entry.memberName)}
                              disabled={choices.some((choice) => choice.obligation.contributionId === obligation.contributionId)}
                              className="rounded-full border border-[var(--ds-border)] px-2 py-0.5 text-xs disabled:opacity-40"
                            >
                              + {obligation.period ?? 'Contribution'} · {formatMoney(obligation.due)}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {choices.length > 0 && (
            <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-900">Paying {formatMoney(totalAmount)} for:</p>
              <ul className="mt-1 space-y-1 text-sm text-emerald-900">
                {choices.map((choice, index) => (
                  <li key={`${choice.obligation.contributionId}-${index}`} className="flex items-center justify-between gap-2">
                    <span>{choice.memberName} — {choice.obligation.period ?? 'Contribution'}</span>
                    <span className="flex items-center gap-2"><strong>{formatMoney(choice.amount)}</strong>
                      <button type="button" onClick={() => setChoices((current) => current.filter((_, i) => i !== index))} aria-label="Remove"><X className="h-4 w-4" /></button>
                    </span>
                  </li>
                ))}
              </ul>
              <Button className="mt-3 w-full" onClick={() => setStep('HOW')} disabled={!methods.length}>
                {methods.length ? 'Choose payment method' : 'No payment methods are active — ask the Treasurer'}
              </Button>
            </div>
          )}
        </>
      )}

      {step === 'HOW' && (
        <>
          <h3 className="text-lg font-black text-[var(--ds-secondary)]">Choose how to pay</h3>
          <p className="text-sm text-[var(--ds-text-muted)]">These are {`your Chama's`} own payment channels — never the Chama360 subscription number.</p>
          <div className="space-y-2">
            {methods.map((method) => (
              <label key={method.id} className={`flex cursor-pointer items-center justify-between rounded-[var(--ds-radius-md)] border-2 p-3 ${methodId === method.id ? 'border-emerald-500 bg-emerald-50' : 'border-[var(--ds-border)]'}`}>
                <input type="radio" name="payment-method" className="sr-only" checked={methodId === method.id} onChange={() => setMethodId(method.id)} />
                <span><strong>{method.label}</strong><br /><span className="text-xs text-[var(--ds-text-muted)]">{method.kind}{method.value ? `: ${method.value}` : ''}{method.account ? ` · ${method.account}` : ''}</span></span>
                {methodId === method.id && <Check className="h-5 w-5 text-emerald-600" />}
              </label>
            ))}
          </div>
          <TextField label="M-Pesa / bank reference (optional now, can be added after paying)" value={reference} onChange={(event) => setReference(event.target.value)} />
          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">
            Payer: <strong className="text-[var(--ds-secondary)]">{currentUserName}</strong> · Beneficiaries: {choices.map((choice) => choice.memberName).join(', ')} · Total: <strong className="text-[var(--ds-secondary)]">{formatMoney(totalAmount)}</strong>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('WHO')} disabled={submitting}>Back</Button>
            <Button className="flex-1" onClick={submit} loading={submitting}>Pay {formatMoney(totalAmount)}</Button>
          </div>
        </>
      )}
    </div>
  );
};
