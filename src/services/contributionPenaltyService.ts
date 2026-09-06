import { prisma } from '../config/database';
import { logger } from '../config/logger';

type PenaltyRules = {
  lateContributionPenalty?: number;
  penaltyType?: string;
  gracePeriodDays?: number;
};

type ContributionRules = {
  deadlineDay?: number;
  gracePeriodDays?: number;
  latePenalty?: number;
  penaltyRules?: PenaltyRules;
};

type PenaltyResult = {
  organizationsChecked: number;
  contributionsMarkedOverdue: number;
  penaltiesApplied: number;
};

const deadlineCutoff = (period: string, deadlineDay: number, graceDays: number) => {
  const [year = 1970, month = 1] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(Math.trunc(deadlineDay || 1), 1), lastDay);
  // 21:00 UTC on the final allowed day is midnight at the start of the next day in Nairobi.
  return new Date(Date.UTC(year, month - 1, day + Math.max(0, Math.trunc(graceDays)), 21));
};

const calculatePenalty = (amount: number, rules: ContributionRules) => {
  const configured = Number(rules.penaltyRules?.lateContributionPenalty ?? rules.latePenalty ?? 0);
  if (configured <= 0) return 0;
  return rules.penaltyRules?.penaltyType?.toUpperCase() === 'PERCENTAGE'
    ? Math.round(amount * configured) / 100
    : configured;
};

export class ContributionPenaltyService {
  async reconcile(now = new Date()): Promise<PenaltyResult> {
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      include: { settings: { select: { contributionRules: true } } },
    });

    let contributionsMarkedOverdue = 0;
    let penaltiesApplied = 0;

    for (const organization of organizations) {
      const rules = organization.settings?.contributionRules as ContributionRules | null;
      if (!rules) continue;
      const graceDays = Number(rules.penaltyRules?.gracePeriodDays ?? rules.gracePeriodDays ?? 0);
      const penaltyConfigured = calculatePenalty(1, rules) > 0;
      const candidates = await prisma.contribution.findMany({
        where: {
          organizationId: organization.id,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          period: { not: null },
        },
        select: { id: true, memberId: true, amount: true, period: true, status: true, penalties: true },
      });

      for (const contribution of candidates) {
        const period = contribution.period!;
        const advanceCoverage = await prisma.contributionAllocation.findFirst({
          where: { organizationId: organization.id, memberId: contribution.memberId, period },
          select: { id: true },
        });
        if (advanceCoverage) continue;
        const cutoff = deadlineCutoff(period, Number(rules.deadlineDay ?? 1), graceDays);
        if (now < cutoff) continue;

        const penalty = calculatePenalty(Number(contribution.amount), rules);
        const hasPenalty = Number(contribution.penalties) > 0;
        const shouldApplyPenalty = penaltyConfigured && penalty > 0 && !hasPenalty;
        if (contribution.status === 'OVERDUE' && !shouldApplyPenalty) continue;

        const updated = await prisma.contribution.updateMany({
          where: {
            id: contribution.id,
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            ...(shouldApplyPenalty ? { penalties: 0 } : {}),
          },
          data: {
            status: 'OVERDUE',
            ...(shouldApplyPenalty ? { penalties: penalty } : {}),
          },
        });
        if (!updated.count) continue;
        if (contribution.status !== 'OVERDUE') contributionsMarkedOverdue += 1;
        if (shouldApplyPenalty) penaltiesApplied += 1;

        await prisma.notification.upsert({
          where: { dedupeKey: `contribution-overdue:${contribution.id}` },
          update: {},
          create: {
            dedupeKey: `contribution-overdue:${contribution.id}`,
            recipientId: contribution.memberId,
            organizationId: organization.id,
            type: 'CONTRIBUTION_DUE',
            priority: 'CRITICAL',
            title: `${period} contribution is overdue`,
            message: shouldApplyPenalty
              ? `Your contribution is overdue. A KES ${penalty.toLocaleString()} late penalty has been applied.`
              : 'Your contribution deadline has passed. Please make payment as soon as possible.',
            channels: { create: [{ type: 'IN_APP', address: contribution.memberId }] },
          },
        });
      }
    }

    const result = { organizationsChecked: organizations.length, contributionsMarkedOverdue, penaltiesApplied };
    logger.info('Contribution penalty reconciliation completed', result);
    return result;
  }
}

export const contributionPenaltyService = new ContributionPenaltyService();
