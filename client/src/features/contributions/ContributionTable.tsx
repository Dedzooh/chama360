type ContributionRow = {
  id: string;
  period?: string;
  amount?: number | string;
  status?: string;
};

type ContributionTableProps = {
  rows: ContributionRow[];
};

export const ContributionTable = ({ rows }: ContributionTableProps) => (
  <div className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
    <div className="grid grid-cols-4 border-b border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">
      <span>Period</span>
      <span>Amount</span>
      <span>Status</span>
      <span>Reference</span>
    </div>
    {rows.map((row) => (
      <div key={row.id} className="grid grid-cols-4 border-b border-[var(--ds-border)] px-4 py-3 text-sm last:border-b-0">
        <span>{row.period ?? '—'}</span>
        <span>{row.amount ?? 0}</span>
        <span>{row.status ?? 'PENDING'}</span>
        <span>{row.id.slice(0, 8)}</span>
      </div>
    ))}
  </div>
);