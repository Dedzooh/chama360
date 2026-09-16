import { prisma } from '../config/database';
import { logger } from '../config/logger';
import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { config } from '../config/environment';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

export type LifecycleInput = { plan: SubscriptionPlan; status: SubscriptionStatus; currentPeriodEnd: Date | null; gracePeriodEnd: Date | null; cancelAtPeriodEnd: boolean };
export const getLifecycleTransition = (subscription: LifecycleInput, now = new Date()) => {
  if (subscription.plan === 'FREE' || !subscription.currentPeriodEnd || subscription.currentPeriodEnd > now) return null;
  if (subscription.cancelAtPeriodEnd) return { plan: 'FREE' as const, status: 'ACTIVE' as const, gracePeriodEnd: null, cancelAtPeriodEnd: false };
  if (subscription.status === 'ACTIVE') return { status: 'PAST_DUE' as const, gracePeriodEnd: new Date(subscription.currentPeriodEnd.getTime() + GRACE_PERIOD_MS) };
  if (subscription.status === 'PAST_DUE' && subscription.gracePeriodEnd && subscription.gracePeriodEnd <= now) return { plan: 'FREE' as const, status: 'ACTIVE' as const, gracePeriodEnd: null, cancelAtPeriodEnd: false };
  return null;
};

export const subscriptionLifecycleService = {
  async reconcileUser(userId: string) {
    const subscription = await prisma.subscription.upsert({ where: { userId }, create: { userId }, update: {} });
    const now = new Date();
    const transition = getLifecycleTransition(subscription, now);
    return transition ? prisma.subscription.update({ where: { id: subscription.id }, data: transition }) : subscription;
  },

  async reconcileOrganization(organizationId: string) {
    const existing = await prisma.organizationSubscription.findUnique({ where: { organizationId } });
    const now = new Date();
    const subscription = existing ?? await prisma.organizationSubscription.create({
      data: { organizationId },
    });
    if (subscription.plan === 'FREE' && (subscription.trialEndsAt || subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED')) {
      return prisma.organizationSubscription.update({ where: { id: subscription.id }, data: { trialEndsAt: null, status: 'ACTIVE' } });
    }
    const transition = getLifecycleTransition(subscription, now);
    return transition ? prisma.organizationSubscription.update({ where: { id: subscription.id }, data: transition }) : subscription;
  },

  async reconcileAll() {
    const due = await prisma.subscription.findMany({ where: { plan: { not: 'FREE' }, currentPeriodEnd: { lte: new Date() } }, select: { userId: true } });
    await Promise.all(due.map(({ userId }) => this.reconcileUser(userId)));
    const organizationDue = await prisma.organizationSubscription.findMany({ where: { plan: { not: 'FREE' }, currentPeriodEnd: { lte: new Date() } }, select: { organizationId: true } });
    await Promise.all(organizationDue.map(({ organizationId }) => this.reconcileOrganization(organizationId)));
    if (due.length || organizationDue.length) logger.info('Subscription lifecycle reconciliation completed', { users: due.length, organizations: organizationDue.length });
    await this.sendRenewalNotifications();
    await this.sendOrganizationSubscriptionNotifications();
  },

  async sendOrganizationSubscriptionNotifications() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 8 * 86400000);
    const subscriptions = await prisma.organizationSubscription.findMany({
      where: { OR: [{ trialEndsAt: { lte: windowEnd } }, { currentPeriodEnd: { gte: new Date(now.getTime() - GRACE_PERIOD_MS), lte: windowEnd } }, { status: 'PAST_DUE' }] },
      include: { organization: { select: { name: true, members: { where: { status: 'ACTIVE' }, include: { role: true, user: { select: { id: true, email: true, phone: true, notificationPreferences: true } } } } } } },
    });

    const notifyAdministrators = async (subscription: typeof subscriptions[number], marker: string, title: string, message: string, priority: 'INFO' | 'IMPORTANT' | 'CRITICAL' = 'IMPORTANT') => {
      const administrators = subscription.organization.members.filter((member) => ['OWNER', 'FOUNDER', 'ADMIN', 'CHAIR', 'TREASURER'].includes(member.role?.name ?? ''));
      for (const member of administrators) {
        const preferences = member.user.notificationPreferences;
        const channels = [
          ...(preferences?.inAppEnabled !== false ? [{ type: 'IN_APP' as const, address: member.user.id }] : []),
          ...(preferences?.emailEnabled !== false && config.email.host && config.email.user && config.email.from ? [{ type: 'EMAIL' as const, address: member.user.email }] : []),
          ...(preferences?.smsEnabled !== false && config.sms.baseUrl && config.sms.apiKey && config.sms.senderId ? [{ type: 'SMS' as const, address: member.user.phone }] : []),
        ];
        if (!channels.length) continue;
        const dedupeKey = `ORG_SUBSCRIPTION_${subscription.id}_${marker}_${member.user.id}`;
        await prisma.notification.upsert({
          where: { dedupeKey }, update: {},
          create: { dedupeKey, recipientId: member.user.id, organizationId: subscription.organizationId, type: 'GENERAL_UPDATE', priority, title, message, channels: { create: channels } },
        });
      }
    };

    for (const subscription of subscriptions) {
      if (subscription.plan === 'FREE' && subscription.trialEndsAt) {
        const days = Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86400000);
        const marker = days <= 0 ? `TRIAL_EXPIRED_${subscription.trialEndsAt.toISOString()}` : [7, 3, 1].includes(days) ? `TRIAL_${days}D_${subscription.trialEndsAt.toISOString()}` : null;
        if (marker) await notifyAdministrators(subscription, marker, days <= 0 ? `${subscription.organization.name} trial has ended` : `${subscription.organization.name} trial ends in ${days} day${days === 1 ? '' : 's'}`, days <= 0 ? 'Choose a CHAMA360 plan now to restore full chama access and retain your records.' : 'Open Plans to choose Starter, Growth, Pro, or Enterprise before premium access ends.', days <= 1 ? 'CRITICAL' : 'IMPORTANT');
      } else if (subscription.currentPeriodEnd) {
        const days = Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / 86400000);
        const marker = subscription.status === 'PAST_DUE' ? `GRACE_${subscription.currentPeriodEnd.toISOString()}` : [7, 3, 1].includes(days) ? `RENEWAL_${days}D_${subscription.currentPeriodEnd.toISOString()}` : null;
        if (marker) await notifyAdministrators(subscription, marker, subscription.status === 'PAST_DUE' ? `${subscription.organization.name} payment is overdue` : `${subscription.organization.name} renews in ${days} day${days === 1 ? '' : 's'}`, subscription.status === 'PAST_DUE' ? 'Renew during the three-day grace period to avoid losing premium features.' : `Renew the ${subscription.plan} plan before ${subscription.currentPeriodEnd.toLocaleDateString()} to keep service uninterrupted.`, subscription.status === 'PAST_DUE' || days === 1 ? 'CRITICAL' : 'IMPORTANT');
      }
    }

    const failedPayments = await prisma.planChangeRequest.findMany({ where: { organizationId: { not: null }, status: 'FAILED', updatedAt: { gte: new Date(now.getTime() - 2 * 86400000) } }, include: { organization: { select: { name: true } }, user: { select: { id: true, email: true, phone: true, notificationPreferences: true } } } });
    for (const payment of failedPayments) {
      const preferences = payment.user.notificationPreferences;
      const channels = [
        ...(preferences?.inAppEnabled !== false ? [{ type: 'IN_APP' as const, address: payment.user.id }] : []),
        ...(preferences?.emailEnabled !== false && config.email.host && config.email.user && config.email.from ? [{ type: 'EMAIL' as const, address: payment.user.email }] : []),
        ...(preferences?.smsEnabled !== false && config.sms.baseUrl && config.sms.apiKey && config.sms.senderId ? [{ type: 'SMS' as const, address: payment.user.phone }] : []),
      ];
      if (!channels.length) continue;
      const dedupeKey = `ORG_SUBSCRIPTION_PAYMENT_FAILED_${payment.id}`;
      await prisma.notification.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, recipientId: payment.user.id, organizationId: payment.organizationId, type: 'GENERAL_UPDATE', priority: 'IMPORTANT', title: `${payment.organization?.name ?? 'Chama'} payment was not completed`, message: `${payment.failureReason || 'The payment could not be confirmed.'} Open Plans to retry safely; no subscription was activated or charged by CHAMA360.`, channels: { create: channels } } });
    }
  },

  async sendRenewalNotifications() {
    const now = new Date();
    const subscriptions = await prisma.subscription.findMany({ where: { plan: { not: 'FREE' }, currentPeriodEnd: { gte: new Date(now.getTime() - GRACE_PERIOD_MS), lte: new Date(now.getTime() + 8 * 86400000) } } });
    for (const subscription of subscriptions) {
      const days = Math.ceil(((subscription.currentPeriodEnd?.getTime() ?? now.getTime()) - now.getTime()) / 86400000);
      const marker = subscription.status === 'PAST_DUE' ? 'GRACE' : [7, 3, 1].includes(days) ? `${days}D` : null;
      if (!marker) continue;
      const dedupeKey = `SUBSCRIPTION_${subscription.id}_${subscription.currentPeriodEnd?.toISOString()}_${marker}`;
      await prisma.notification.upsert({
        where: { dedupeKey }, update: {},
        create: {
          dedupeKey, recipientId: subscription.userId, type: 'GENERAL_UPDATE', priority: marker === 'GRACE' || marker === '1D' ? 'IMPORTANT' : 'INFO',
          title: marker === 'GRACE' ? 'Your subscription is in its grace period' : `Your ${subscription.plan} plan renews in ${days} day${days === 1 ? '' : 's'}`,
          message: marker === 'GRACE' ? 'Renew now to keep your premium CHAMA360 features active.' : `Renew before ${subscription.currentPeriodEnd?.toLocaleDateString()} to avoid interruption.`,
          channels: { create: { type: 'IN_APP', address: subscription.userId } },
        },
      });
    }
  },
};
