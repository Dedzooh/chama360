import type { ContributionRecord } from '../services/organizationService';

export type StatementStatus = 'Paid' | 'Due' | 'Overdue' | 'Partial';

export const contributionStatementStatus = (contribution: ContributionRecord, today: Date): StatementStatus => {
  if (contribution.status === 'PAID') return 'Paid';
  if (contribution.status === 'PARTIAL') return 'Partial';
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return contribution.dueDate.slice(0, 10) < localDate || contribution.status === 'OVERDUE' ? 'Overdue' : 'Due';
};

export const buildMonthlyStatement = (contributions: ContributionRecord[], month: string, today = new Date()) => {
  const rows = contributions.filter((item) => item.status !== 'REVERSED' && item.dueDate?.slice(0, 7) === month)
    .map((item) => ({ contribution: item, status: contributionStatementStatus(item, today) }));
  const count = (status: StatementStatus) => rows.filter((row) => row.status === status).length;
  return {
    rows,
    paid: count('Paid'),
    due: count('Due'),
    overdue: count('Overdue'),
    partial: count('Partial'),
    scheduledAmount: rows.reduce((sum, row) => sum + Number(row.contribution.amount ?? 0), 0),
    paidAmount: rows.filter((row) => row.status === 'Paid').reduce((sum, row) => sum + Number(row.contribution.amount ?? 0), 0),
  };
};
