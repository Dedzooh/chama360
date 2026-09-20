type LoanTableProps = {
  rows: Array<{ id: string; borrower?: string; purpose?: string; status?: string; amount?: number | string }>; 
};

export const LoanTable = ({ rows }: LoanTableProps) => (
  <div className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface)]">
    <div className="grid grid-cols-4 border-b border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">
      <span>Borrower</span>
      <span>Purpose</span>
      <span>Status</span>
      <span>Amount</span>
    </div>
    {rows.map((row) => (
      <div key={row.id} className="grid grid-cols-4 border-b border-[var(--ds-border)] px-4 py-3 text-sm last:border-b-0">
        <span>{row.borrower ?? 'Member'}</span>
        <span>{row.purpose ?? 'Loan'}</span>
        <span>{row.status ?? 'PENDING'}</span>
        <span>{row.amount ?? 0}</span>
      </div>
    ))}
  </div>
);