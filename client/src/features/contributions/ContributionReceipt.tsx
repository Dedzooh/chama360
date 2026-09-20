type ContributionReceiptProps = {
  memberName: string;
  reference: string;
  amount: string | number;
};

export const ContributionReceipt = ({ memberName, reference, amount }: ContributionReceiptProps) => (
  <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
    <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Receipt</p>
    <p className="mt-2 font-bold text-[var(--ds-secondary)]">{memberName}</p>
    <p className="text-sm text-[var(--ds-text-muted)]">Reference: {reference}</p>
    <p className="mt-2 text-xl font-black text-[var(--ds-secondary)]">KES {amount}</p>
  </div>
);