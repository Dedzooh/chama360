import { prisma } from '../config/database';
import { logger } from '../config/logger';

type ContributionRules = {
  amount?: number;
  frequency?: string;
  deadlineDay?: number;
};

type ReconcileResult = {
  period: string;
  organizationsChecked: number;
  contributionsCreated: number;
  membersAlreadyCovered: number;
};

const nairobiPeriod = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')!.value;
  const month = parts.find((part) => part.type === 'month')!.value;
  return `${year}-${month}`;
};

const dueDateForPeriod = (period: string, requestedDay: number) => {
  const [year = 1970, month = 1] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(Math.trunc(requestedDay || 1), 1), lastDay);
  // Midday UTC preserves the intended calendar day across East African clients.
  return new Date(Date.UTC(year, month - 1, day, 12));
};

export class MonthlyContributionService {
  async reconcile(now = new Date()): Promise<ReconcileResult> {
    const period = nairobiPeriod(now);
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      include: {
        chama: { select: { id: true } },
        settings: { select: { contributionRules: true } },
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
      },
    });

    let contributionsCreated = 0;
    let membersAlreadyCovered = 0;

    for (const organization of organizations) {
      const rules = organization.settings?.contributionRules as ContributionRules | null;
      const amount = Number(rules?.amount ?? 0);
      if (!organization.chama?.id || rules?.frequency?.toLowerCase() !== 'monthly' || amount <= 0) continue;
      const chamaId = organization.chama.id;

      const dueDate = dueDateForPeriod(period, Number(rules.deadlineDay ?? 1));
      const createdMemberIds: string[] = [];

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly-contributions:${organization.id}:${period}`}))`;

        for (const member of organization.members) {
          const [allocation, existing] = await Promise.all([
            tx.contributionAllocation.findFirst({
              where: { organizationId: organization.id, memberId: member.userId, period },
              select: { id: true },
            }),
            tx.contribution.findFirst({
              where: {
                organizationId: organization.id,
                memberId: member.userId,
                period,
                status: { not: 'REVERSED' },
              },
              select: { id: true },
            }),
          ]);

          if (allocation || existing) {
            membersAlreadyCovered += 1;
            continue;
          }

          await tx.contribution.create({
            data: {
              chamaId,
              organizationId: organization.id,
              memberId: member.userId,
              amount,
              contributionType: 'Monthly contribution',
              period,
              dueDate,
              status: 'PENDING',
            },
          });
          createdMemberIds.push(member.userId);
          contributionsCreated += 1;
        }
      });

      for (const memberId of createdMemberIds) {
        await prisma.notification.upsert({
          where: { dedupeKey: `monthly-contribution:${organization.id}:${memberId}:${period}` },
          update: {},
          create: {
            dedupeKey: `monthly-contribution:${organization.id}:${memberId}:${period}`,
            recipientId: memberId,
            organizationId: organization.id,
            type: 'CONTRIBUTION_DUE',
            priority: 'IMPORTANT',
            title: `${period} contribution is due`,
            message: `Your KES ${amount.toLocaleString()} contribution is due by day ${dueDate.getUTCDate()} of the month.`,
            channels: { create: [{ type: 'IN_APP', address: memberId }] },
          },
        });
      }
    }

    const result = { period, organizationsChecked: organizations.length, contributionsCreated, membersAlreadyCovered };
    logger.info('Monthly contribution reconciliation completed', result);
    return result;
  }
}

export const monthlyContributionService = new MonthlyContributionService();
