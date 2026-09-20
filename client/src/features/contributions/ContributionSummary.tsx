type ContributionSummaryProps = {
  total: number;
  paid: number;
  pending: number;
};

export const ContributionSummary = ({ total, paid, pending }: ContributionSummaryProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Total</p>
      <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{total}</p>
    </div>
    <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Paid</p>
      <p className="mt-2 text-2xl font-black text-emerald-700">{paid}</p>
    </div>
    <div className="rounded-[var(--ds-radius-lg)] border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Pending</p>
      <p className="mt-2 text-2xl font-black text-amber-700">{pending}</p>
    </div>
  </div>
);