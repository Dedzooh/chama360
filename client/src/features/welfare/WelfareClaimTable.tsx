type WelfareClaimRow = {
  id: string;
  claimType?: string;
  status?: string;
  amountRequested?: number | string;
};

type WelfareClaimTableProps = {
  rows: WelfareClaimRow[];
};

export const WelfareClaimTable = ({ rows }: WelfareClaimTableProps) => (
  <div className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
    <div className="grid grid-cols-4 border-b border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">
      <span>Claim</span>
      <span>Amount</span>
      <span>Status</span>
      <span>Reference</span>
    </div>
    {rows.map((row) => (
      <div key={row.id} className="grid grid-cols-4 border-b border-[var(--ds-border)] px-4 py-3 text-sm last:border-b-0">
        <span>{row.claimType ?? 'Claim'}</span>
        <span>{row.amountRequested ?? 0}</span>
        <span>{row.status ?? 'PENDING'}</span>
        <span>{row.id.slice(0, 8)}</span>
      </div>
    ))}
  </div>
);