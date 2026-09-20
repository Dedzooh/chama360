type LoanRepaymentPanelProps = {
  amount: string;
  method: string;
  reference: string;
};

export const LoanRepaymentPanel = ({ amount, method, reference }: LoanRepaymentPanelProps) => (
  <div className="rounded-[var(--ds-radius-lg)] border border-sky-200 bg-sky-50 p-4">
    <p className="text-xs uppercase tracking-[0.14em] text-sky-700">Repayment</p>
    <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">KES {amount}</p>
    <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Method: {method} · Ref: {reference || '—'}</p>
  </div>
);