import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, ForbiddenError, UnauthorizedError, UpgradeRequiredError } from './errorHandler';
import { planHasFeature, subscriptionPlans } from '../config/subscriptions';
import { subscriptionLifecycleService } from '../services/subscriptionLifecycleService';
import { prisma } from '../config/database';

const asString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const isSubscriptionFeatureActive = (subscription: { status: string; gracePeriodEnd?: Date | null }, now = new Date()) =>
  ['ACTIVE', 'PAST_DUE'].includes(subscription.status) && (!subscription.gracePeriodEnd || subscription.gracePeriodEnd > now);

async function resolveOrganizationId(req: Request): Promise<string> {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const explicit = asString(req.params.organizationId) ?? asString(req.params.id) ?? asString(body.organizationId) ?? asString(req.query.organizationId);
  if (explicit) return explicit;

  const organizationIds = new Set<string>();
  const chamaId = asString(body.chamaId) ?? asString(req.query.chamaId);
  if (chamaId) {
    const [chama, organization] = await Promise.all([
      prisma.chama.findUnique({ where: { id: chamaId }, select: { organizationId: true } }),
      prisma.organization.findUnique({ where: { id: chamaId }, select: { id: true } }),
    ]);
    const resolved = chama?.organizationId ?? organization?.id;
    if (resolved) organizationIds.add(resolved);
  }

  const contributionIds = [
    asString(req.params.contributionId),
    asString(body.contributionId),
    ...(Array.isArray(body.payments) ? body.payments.map((payment: unknown) => asString((payment as { contributionId?: unknown })?.contributionId)) : []),
  ].filter((value): value is string => Boolean(value));
  if (contributionIds.length) {
    const contributions = await prisma.contribution.findMany({
      where: { id: { in: [...new Set(contributionIds)] } },
      select: { organizationId: true, chama: { select: { organizationId: true } } },
    });
    if (contributions.length !== new Set(contributionIds).size) throw new BadRequestError('One or more contributions could not be resolved');
    for (const contribution of contributions) {
      const resolved = contribution.organizationId ?? contribution.chama.organizationId;
      if (!resolved) throw new BadRequestError('Contribution is not linked to an organization');
      organizationIds.add(resolved);
    }
  }

  const checkoutRequestId = asString(req.params.checkoutRequestId);
  if (checkoutRequestId) {
    const transaction = await prisma.transaction.findUnique({
      where: { idempotencyKey: checkoutRequestId },
      select: { organizationId: true, chama: { select: { organizationId: true } } },
    });
    const resolved = transaction?.organizationId ?? transaction?.chama.organizationId;
    if (!resolved) throw new BadRequestError('Payment is not linked to an organization');
    organizationIds.add(resolved);
  }

  if (organizationIds.size === 0) throw new BadRequestError('Organization context is required for this paid feature');
  if (organizationIds.size > 1) throw new BadRequestError('A paid-feature request cannot span multiple organizations');
  return [...organizationIds][0]!;
}

export const requireSubscriptionFeature = (feature: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return next(new UnauthorizedError());
    const organizationId = await resolveOrganizationId(req);
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: req.user.id } },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE') return next(new ForbiddenError('Active organization membership is required'));

    await prisma.commercialFunnelEvent.create({ data: { eventType: 'PREMIUM_FEATURE_ATTEMPTED', userId: req.user.id, organizationId } });

    const subscription = await subscriptionLifecycleService.reconcileOrganization(organizationId);
    const active = isSubscriptionFeatureActive(subscription);
    if (!active || !planHasFeature(subscription.plan, feature)) {
      const requiredPlan = Object.entries(subscriptionPlans).find(([, plan]) => plan.features.includes(feature))?.[0] ?? 'PRO';
      return next(new UpgradeRequiredError(feature, requiredPlan));
    }
    res.locals.organizationId = organizationId;
    return next();
  } catch (error) {
    return next(error);
  }
};
