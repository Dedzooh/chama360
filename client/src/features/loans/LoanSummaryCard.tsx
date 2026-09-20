type LoanSummaryCardProps = {
  title: string;
  value: string;
  detail: string;
};

export const LoanSummaryCard = ({ title, value, detail }: LoanSummaryCardProps) => (
  <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
    <p className="text-xs uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">{title}</p>
    <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{value}</p>
    <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{detail}</p>
  </div>
);