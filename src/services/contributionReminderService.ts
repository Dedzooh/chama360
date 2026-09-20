import { prisma } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { toDecimal } from '../utils/decimal';

type NotificationRules = {
  inApp?: boolean;
  email?: boolean;
  sms?: boolean;
  reminderDaysBefore?: number[];
  overdueReminderFrequencyDays?: number;
};

const nairobiDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')!.value),
    month: Number(parts.find((part) => part.type === 'month')!.value),
    day: Number(parts.find((part) => part.type === 'day')!.value),
  };
};

const dayNumber = ({ year, month, day }: { year: number; month: number; day: number }) =>
  Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);

const contributionDeadline = (period: string, requestedDay: number) => {
  const [year = 1970, month = 1] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(Math.max(Math.trunc(requestedDay || 1), 1), lastDay) };
};

export class ContributionReminderService {
  async reconcile(now = new Date()) {
    const today = dayNumber(nairobiDateParts(now));
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      include: { settings: { select: { contributionRules: true, notificationRules: true } } },
    });
    let remindersCreated = 0;

    for (const organization of organizations) {
      const contributionRules = organization.settings?.contributionRules as { deadlineDay?: number } | null;
      const notificationRules = organization.settings?.notificationRules as NotificationRules | null;
      if (!contributionRules || !notificationRules) continue;

      const beforeDays = [...new Set((notificationRules.reminderDaysBefore ?? [7, 3, 1])
        .map(Number).filter((day) => Number.isInteger(day) && day > 0))];
      const overdueFrequency = Math.max(1, Math.trunc(Number(notificationRules.overdueReminderFrequencyDays ?? 3)));
      const contributions = await prisma.contribution.findMany({
        where: { organizationId: organization.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, period: { not: null } },
        include: { member: { include: { notificationPreferences: true } } },
      });

      for (const contribution of contributions) {
        const advanceCoverage = await prisma.contributionAllocation.findFirst({
          where: { organizationId: organization.id, memberId: contribution.memberId, period: contribution.period! },
          select: { id: true },
        });
        if (advanceCoverage) continue;
        const deadline = dayNumber(contributionDeadline(contribution.period!, Number(contributionRules.deadlineDay ?? 1)));
        const daysUntil = deadline - today;
        let stage: string | null = null;
        let title = '';
        let message = '';
        const totalDue = toDecimal(contribution.amount).plus(toDecimal(contribution.penalties)).toNumber();

        if (beforeDays.includes(daysUntil)) {
          stage = `before-${daysUntil}`;
          title = `Contribution due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
          message = `Your ${contribution.period} contribution of KES ${totalDue.toLocaleString()} is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`;
        } else if (daysUntil === 0) {
          stage = 'deadline';
          title = 'Contribution deadline is today';
          message = `Your ${contribution.period} contribution of KES ${totalDue.toLocaleString()} is due today.`;
        } else if (daysUntil < 0 && Math.abs(daysUntil) % overdueFrequency === 0) {
          stage = `overdue-${Math.abs(daysUntil)}`;
          title = `Contribution overdue by ${Math.abs(daysUntil)} days`;
          message = `Your ${contribution.period} balance is overdue. The current amount due is KES ${totalDue.toLocaleString()}.`;
        }
        if (!stage) continue;

        const preferences = contribution.member.notificationPreferences;
        const channels: Array<{ type: 'IN_APP' | 'EMAIL' | 'SMS'; address: string }> = [];
        if (notificationRules.inApp !== false && preferences?.inAppEnabled !== false) channels.push({ type: 'IN_APP', address: contribution.memberId });
        if (notificationRules.email && preferences?.emailEnabled !== false && config.email.host && config.email.user && config.email.password) channels.push({ type: 'EMAIL', address: contribution.member.email });
        if (notificationRules.sms && preferences?.smsEnabled !== false && config.sms.baseUrl && config.sms.apiKey && config.sms.senderId) channels.push({ type: 'SMS', address: contribution.member.phone });
        if (!channels.length) continue;

        const dedupeKey = `contribution-reminder:${contribution.id}:${stage}`;
        const existing = await prisma.notification.findUnique({ where: { dedupeKey }, select: { id: true } });
        if (existing) continue;
        await prisma.notification.create({
          data: {
            dedupeKey, recipientId: contribution.memberId, organizationId: organization.id,
            type: 'CONTRIBUTION_DUE', priority: daysUntil <= 0 ? 'CRITICAL' : 'IMPORTANT', title, message,
            channels: { create: channels },
          },
        });
        remindersCreated += 1;
      }
    }

    const result = { organizationsChecked: organizations.length, remindersCreated };
    logger.info('Contribution reminder reconciliation completed', result);
    return result;
  }
}

export const contributionReminderService = new ContributionReminderService();
