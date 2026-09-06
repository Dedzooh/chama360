import type { ContributionRecord, WelfareClaimRecord } from '../services/organizationService';
import type { Loan, MeetingRecord } from '../types';

const dayMs = 24 * 60 * 60 * 1000;

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const money = (value: number) => `KES ${Math.round(value).toLocaleString()}`;

export interface SmartInsightItem {
  label: string;
  value: string;
  detail: string;
}

export interface SmartReminderItem {
  title: string;
  detail: string;
  tone: 'info' | 'warning' | 'danger';
}

export interface SmartRiskItem {
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SmartInsights {
  insights: SmartInsightItem[];
  reminders: SmartReminderItem[];
  risks: SmartRiskItem[];
}

export const buildSmartInsights = ({
  walletBalance,
  members,
  contributions,
  loans,
  claims,
  meetings,
}: {
  walletBalance: number;
  members: Array<{ reliabilityScore?: number }>;
  contributions: ContributionRecord[];
  loans: Loan[];
  claims: WelfareClaimRecord[];
  meetings: MeetingRecord[];
}): SmartInsights => {
  const paidContributions = contributions.filter((item) => item.status === 'PAID');
  const pendingContributions = contributions.filter((item) => item.status === 'PENDING' || item.status === 'OVERDUE' || item.status === 'PARTIAL');
  const overdueContributions = contributions.filter((item) => item.status === 'OVERDUE');
  const pendingLoans = loans.filter((item) => item.status === 'PENDING');
  const defaultedLoans = loans.filter((item) => item.status === 'DEFAULTED');
  const pendingClaims = claims.filter((item) => item.status === 'PENDING');
  const reversedContributions = contributions.filter((item) => item.status === 'REVERSED');

  const totalPaid = paidContributions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const averagePaid = paidContributions.length ? totalPaid / paidContributions.length : 0;
  const projectedInflow = Math.max(averagePaid * Math.max(pendingContributions.length, 1), 0);
  const projectedOutflow = pendingClaims.reduce((sum, item) => sum + Number(item.amountRequested ?? 0), 0) * 0.5;
  const projectedBalance = Math.max(walletBalance + projectedInflow - projectedOutflow, 0);

  const contributionHealth = contributions.length
    ? Math.max(0, Math.round((paidContributions.length / contributions.length) * 100))
    : 0;
  const loanSafety = loans.length
    ? Math.max(0, Math.round(((loans.length - defaultedLoans.length) / loans.length) * 100))
    : 100;
  const walletHealth = Math.min(100, Math.round(walletBalance / Math.max((members.length || 1) * 1000, 1)));
  const eligibilityScore = Math.max(0, Math.min(100, Math.round((contributionHealth * 0.55) + (loanSafety * 0.25) + (walletHealth * 0.2))));

  const nextMeeting = meetings
    .map((meeting) => ({ meeting, date: safeDate(meeting.dateTime) }))
    .filter((entry): entry is { meeting: MeetingRecord; date: Date } => Boolean(entry.date))
    .filter((entry) => entry.date.getTime() >= Date.now())
    .sort((left, right) => left.date.getTime() - right.date.getTime())[0];

  const nextDueContribution = contributions
    .map((item) => ({ item, dueDate: safeDate(item.dueDate) }))
    .filter((entry): entry is { item: ContributionRecord; dueDate: Date } => Boolean(entry.dueDate))
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
    .find((entry) => entry.item.status !== 'PAID' && entry.item.status !== 'REVERSED');

  const insights: SmartInsightItem[] = [
    {
      label: '30-day forecast',
      value: money(projectedBalance),
      detail: `${money(projectedInflow)} expected inflow and ${money(projectedOutflow)} pending welfare exposure.`,
    },
    {
      label: 'Loan eligibility',
      value: `${eligibilityScore}%`,
      detail: `${contributionHealth}% contribution health and ${loanSafety}% loan safety.`,
    },
    {
      label: 'Savings trend',
      value: `${paidContributions.length}/${contributions.length || 1}`,
      detail: `${money(totalPaid)} collected from paid contributions.`,
    },
  ];

  const reminders: SmartReminderItem[] = [];
  if (nextDueContribution) {
    const daysAway = Math.max(0, Math.ceil((nextDueContribution.dueDate.getTime() - Date.now()) / dayMs));
    reminders.push({
      title: 'Contribution due soon',
      detail: `${nextDueContribution.item.member?.firstName ?? 'A member'} owes ${money(Number(nextDueContribution.item.amount ?? 0))} in ${daysAway} day${daysAway === 1 ? '' : 's'}.`,
      tone: daysAway <= 1 ? 'danger' : 'warning',
    });
  }
  if (nextMeeting) {
    const daysAway = Math.max(0, Math.ceil((nextMeeting.date.getTime() - Date.now()) / dayMs));
    reminders.push({
      title: 'Upcoming meeting',
      detail: `${nextMeeting.meeting.title} is scheduled in ${daysAway} day${daysAway === 1 ? '' : 's'}.`,
      tone: daysAway <= 2 ? 'warning' : 'info',
    });
  }
  if (pendingLoans.length) {
    reminders.push({
      title: 'Loan queue',
      detail: `${pendingLoans.length} loan request${pendingLoans.length === 1 ? '' : 's'} need review.`,
      tone: 'info',
    });
  }

  const risks: SmartRiskItem[] = [];
  if (overdueContributions.length) {
    risks.push({
      label: 'Overdue contributions',
      detail: `${overdueContributions.length} payment${overdueContributions.length === 1 ? '' : 's'} are overdue.`,
      severity: overdueContributions.length > 3 ? 'high' : 'medium',
    });
  }
  if (defaultedLoans.length) {
    risks.push({
      label: 'Loan default risk',
      detail: `${defaultedLoans.length} loan${defaultedLoans.length === 1 ? '' : 's'} are marked defaulted.`,
      severity: 'high',
    });
  }
  if (reversedContributions.length) {
    risks.push({
      label: 'Reversed entries',
      detail: `${reversedContributions.length} contribution${reversedContributions.length === 1 ? '' : 's'} were reversed and should be reviewed.`,
      severity: 'medium',
    });
  }
  if (!risks.length) {
    risks.push({
      label: 'Fraud watch',
      detail: 'No high-risk ledger patterns detected in the current workspace data.',
      severity: 'low',
    });
  }

  return { insights, reminders, risks };
};
