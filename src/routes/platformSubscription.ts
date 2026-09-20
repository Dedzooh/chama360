import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { isSelfPlatformOwnerDemotion, requirePlatformOwner, requireSystemAdmin } from '../middleware/systemAdmin';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { getPlanPrice, subscriptionPlans } from '../config/subscriptions';
import { billingDocumentService } from '../services/billingDocumentService';
import { config } from '../config/environment';
import { subscriptionPaymentService } from '../services/subscriptionPaymentService';

const router = Router();
router.use(authenticate, requireSystemAdmin);

router.post('/sms-credits', asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ organizationId: z.string().cuid(), credits: z.number().int().positive().max(1_000_000) }).parse(req.body);
  const wallet = await prisma.organizationSmsCredit.upsert({
    where: { organizationId: input.organizationId },
    create: { organizationId: input.organizationId, balance: input.credits, consumed: 0 },
    update: { balance: { increment: input.credits } },
  });
  res.status(201).json({ wallet, message: `${input.credits.toLocaleString()} SMS credits added.` });
}));

const planSchema = z.enum(['FREE', 'STARTER', 'GROWTH', 'PRO', 'INVESTMENT_AUTOMATION', 'ENTERPRISE']);
const statusSchema = z.enum(['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']);
const paymentStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);
const estimatedMpesaFee = (amount: number) => Math.min(amount * 0.0055, 200);

router.get('/access', asyncHandler(async (req: Request, res: Response) => {
  res.json({ isPlatformAdmin: true, platformRole: req.user?.platformRole ?? null });
}));

router.get('/platform-admins', requirePlatformOwner, asyncHandler(async (_req: Request, res: Response) => {
  const admins = await prisma.user.findMany({
    where: { platformRole: { not: null } },
    select: { id: true, email: true, firstName: true, lastName: true, platformRole: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: [{ platformRole: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ admins });
}));

router.patch('/platform-admins/:id', requirePlatformOwner, asyncHandler(async (req: Request, res: Response) => {
  const userId = z.string().cuid().parse(req.params.id);
  const input = z.object({ role: z.enum(['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN']).nullable() }).parse(req.body);
  if (req.user && isSelfPlatformOwnerDemotion(req.user, userId, input.role)) throw new BadRequestError('A platform owner cannot remove their own owner access.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true } });
  if (!user) throw new NotFoundError('Platform administrator account not found');
  const updated = await prisma.user.update({ where: { id: userId }, data: { platformRole: input.role }, select: { id: true, email: true, firstName: true, lastName: true, platformRole: true, isActive: true, lastLoginAt: true, createdAt: true } });
  await prisma.auditLog.create({ data: { action: 'UPDATE', entityType: 'PlatformRole', entityId: userId, userId: req.user!.id, oldValues: { email: user.email }, newValues: { platformRole: input.role }, metadata: { operation: 'PLATFORM_ROLE_UPDATED' }, ipAddress: req.ip, userAgent: req.get('User-Agent') } });
  res.json({ admin: updated, message: input.role ? 'Platform role updated.' : 'Platform access removed.' });
}));

router.get('/custom-requests', asyncHandler(async (_req: Request, res: Response) => {
  const items = await prisma.customPlanRequest.findMany({
    include: { organization: { select: { id: true, name: true } }, requestedBy: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items });
}));

router.patch('/custom-requests/:id', asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ status: z.enum(['SUBMITTED', 'REVIEWING', 'CONTACTED', 'QUOTED', 'ACCEPTED', 'DECLINED', 'CLOSED']), adminNotes: z.string().trim().max(5000).optional() }).parse(req.body);
  const request = await prisma.customPlanRequest.update({ where: { id: z.string().cuid().parse(req.params.id) }, data: input, include: { organization: { select: { name: true } }, requestedBy: { select: { id: true, email: true } } } });
  const statusCopy: Record<string, string> = {
    REVIEWING: 'CHAMA360 is reviewing your requirements.', CONTACTED: 'CHAMA360 has started the consultation with your organization.', QUOTED: 'Your tailored scope and quotation are ready for discussion.', ACCEPTED: 'Your custom package has been accepted and is moving to onboarding.', DECLINED: 'The custom package request was not continued.', CLOSED: 'The custom package consultation has been closed.', SUBMITTED: 'Your custom package request is awaiting review.',
  };
  await prisma.notification.create({ data: { dedupeKey: `custom-plan:${request.id}:status:${request.status}:${request.updatedAt.getTime()}`, recipientId: request.requestedBy.id, organizationId: request.organizationId, type: 'GENERAL_UPDATE', priority: ['QUOTED', 'ACCEPTED', 'DECLINED'].includes(request.status) ? 'IMPORTANT' : 'INFO', title: `Custom package: ${request.status.toLowerCase().replace('_', ' ')}`, message: `${request.organization.name}: ${statusCopy[request.status]}`, channels: { create: [{ type: 'IN_APP', address: request.requestedBy.id }, { type: 'EMAIL', address: request.contactEmail || request.requestedBy.email }] } } });
  res.json({ request, message: 'Custom package request updated.' });
}));

router.get('/referrals', asyncHandler(async (_req: Request, res: Response) => {
  const referrals = await prisma.referral.findMany({
    where: { status: { in: ['CONVERTED', 'REWARDED'] } },
    include: { referrer: { select: { id: true, firstName: true, lastName: true, email: true } }, referredOrganization: { select: { id: true, name: true } } },
    orderBy: { convertedAt: 'desc' },
    take: 100,
  });
  res.json({ referrals });
}));

router.patch('/referrals/:id/reward', asyncHandler(async (req: Request, res: Response) => {
  const referralId = z.string().cuid().parse(req.params.id);
  const referral = await prisma.referral.findUnique({ where: { id: referralId }, include: { referrer: true, referredOrganization: { select: { name: true } } } });
  if (!referral || referral.status !== 'CONVERTED') throw new NotFoundError('Converted referral not found');
  if (referral.rewardAppliedAt) throw new BadRequestError('Referral reward has already been issued');
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.referral.updateMany({ where: { id: referralId, status: 'CONVERTED', rewardAppliedAt: null }, data: { rewardAppliedAt: now, status: 'REWARDED' } });
    if (claimed.count !== 1) throw new BadRequestError('Referral reward has already been issued');
    const subscription = await tx.subscription.findUnique({ where: { userId: referral.referrerId } });
    const paidSubscription = subscription && subscription.plan !== 'FREE' ? subscription : null;
    const credit = await tx.subscriptionCredit.create({ data: { userId: referral.referrerId, referralId, months: referral.rewardMonths, appliedAt: paidSubscription ? now : null, appliedSubscriptionId: paidSubscription?.id ?? null } });
    if (paidSubscription) {
      const periodEnd = paidSubscription.currentPeriodEnd && paidSubscription.currentPeriodEnd > now ? new Date(paidSubscription.currentPeriodEnd) : now;
      periodEnd.setMonth(periodEnd.getMonth() + referral.rewardMonths);
      await tx.subscription.update({ where: { id: paidSubscription.id }, data: { currentPeriodEnd: periodEnd } });
    }
    return { credit, applied: subscription?.plan !== 'FREE' };
  });
  await prisma.notification.create({ data: { dedupeKey: `referral:${referralId}:rewarded`, recipientId: referral.referrerId, type: 'GENERAL_UPDATE', priority: 'IMPORTANT', title: 'Referral reward issued', message: `${referral.rewardMonths}-month CHAMA360 subscription credit ${result.applied ? 'has been applied to your subscription' : 'is available for your next subscription'}.`, status: 'DELIVERED', sentAt: now, channels: { create: [{ type: 'IN_APP', address: referral.referrerId, status: 'DELIVERED', deliveredAt: now }] } } });
  res.json({ referral: { ...referral, rewardAppliedAt: now, status: 'REWARDED' }, credit: result.credit, message: result.applied ? 'Referral subscription credit applied.' : 'Referral subscription credit issued for the next subscription.' });
}));

router.get('/readiness', asyncHandler(async (_req: Request, res: Response) => {
  const checks = {
    database: true,
    mpesa: subscriptionPaymentService.isConfigured(),
    email: Boolean(config.email.host && config.email.user && config.email.password && config.email.from),
    sms: Boolean(config.sms.baseUrl && config.sms.apiKey && config.sms.senderId),
    businessIdentity: Boolean(config.billing.businessName && config.billing.businessAddress),
    taxIdentity: Boolean(config.billing.taxPin),
  };
  res.json({ checks, demoPaymentAvailable: config.server.isDevelopment, productionReady: checks.mpesa && checks.email && checks.businessIdentity, message: config.server.isDevelopment ? 'Development simulation is available. It never contacts M-Pesa or charges a phone.' : 'Payment simulation is disabled outside development.' });
}));

router.get('/summary', asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const [subscriptions, paymentGroups, completedPayments, recentCompleted, creditNotes, recentCreditNotes, cancelledRecently, deliveryStatuses, deliveryTypes, registeredUsers, createdOrganizations, memberGroups, contributionGroups, premiumOrganizations, checkoutRequests, newSubscriptions, renewalPayments, failedPayments, annualSubscriptions, monthlySubscriptions, monthRevenue, yearRevenue, pricingViews, funnelCheckoutStarts, funnelEvents] = await Promise.all([
    prisma.organizationSubscription.findMany({ include: { organization: { select: { id: true, name: true, members: { where: { status: 'ACTIVE' }, select: { id: true } } } } } }),
    prisma.planChangeRequest.groupBy({ by: ['status'], where: { organizationId: { not: null } }, _count: { _all: true } }),
    prisma.planChangeRequest.findMany({ where: { organizationId: { not: null }, status: 'COMPLETED' }, select: { amount: true, paidAt: true, checkoutRequestId: true } }),
    prisma.planChangeRequest.findMany({ where: { organizationId: { not: null }, status: 'COMPLETED', paidAt: { gte: thirtyDaysAgo } }, select: { amount: true } }),
    prisma.billingDocument.findMany({ where: { type: 'CREDIT_NOTE', status: 'REFUNDED' }, select: { total: true } }),
    prisma.billingDocument.findMany({ where: { type: 'CREDIT_NOTE', status: 'REFUNDED', issuedAt: { gte: thirtyDaysAgo } }, select: { total: true } }),
    prisma.organizationSubscription.count({ where: { status: 'CANCELLED', updatedAt: { gte: monthStart } } }),
    prisma.notificationChannel.groupBy({ by: ['status'], where: { notification: { organizationId: { not: null }, createdAt: { gte: thirtyDaysAgo } } }, _count: { _all: true } }),
    prisma.notificationChannel.groupBy({ by: ['type'], where: { notification: { organizationId: { not: null }, createdAt: { gte: thirtyDaysAgo } } }, _count: { _all: true } }),
    prisma.user.count(),
    prisma.organization.count(),
    prisma.organizationMember.groupBy({ by: ['organizationId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
    prisma.contribution.groupBy({ by: ['organizationId'], _count: { _all: true } }),
    prisma.organizationSubscription.count({ where: { plan: { not: 'FREE' }, status: { in: ['ACTIVE', 'PAST_DUE'] } } }),
    prisma.planChangeRequest.count({ where: { organizationId: { not: null }, status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } } }),
    prisma.organizationSubscription.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.planChangeRequest.count({ where: { organizationId: { not: null }, status: 'COMPLETED', createdAt: { lt: monthStart } } }),
    prisma.planChangeRequest.count({ where: { organizationId: { not: null }, status: 'FAILED' } }),
    prisma.organizationSubscription.count({ where: { billingCycle: 'ANNUAL', status: { in: ['ACTIVE', 'PAST_DUE'] } } }),
    prisma.organizationSubscription.count({ where: { billingCycle: 'MONTHLY', status: { in: ['ACTIVE', 'PAST_DUE'] } } }),
    prisma.planChangeRequest.aggregate({ where: { organizationId: { not: null }, status: 'COMPLETED', paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.planChangeRequest.aggregate({ where: { organizationId: { not: null }, status: 'COMPLETED', paidAt: { gte: new Date(now.getFullYear(), 0, 1) } }, _sum: { amount: true } }),
    prisma.commercialFunnelEvent.count({ where: { eventType: 'PRICING_VIEWED' } }),
    prisma.commercialFunnelEvent.count({ where: { eventType: 'CHECKOUT_STARTED' } }),
    prisma.commercialFunnelEvent.groupBy({ by: ['eventType'], _count: { _all: true } }),
  ]);
  const funnelCounts = Object.fromEntries(funnelEvents.map((row) => [row.eventType, row._count._all]));

  const active = subscriptions.filter((item) => ['ACTIVE', 'PAST_DUE'].includes(item.status));
  const paying = active.filter((item) => item.plan !== 'FREE' && !item.trialEndsAt);
  const trials = subscriptions.filter((item) => item.trialEndsAt && item.trialEndsAt > now);
  const expiredTrials = subscriptions.filter((item) => item.trialEndsAt && item.trialEndsAt <= now);
  const mrr = paying.reduce((sum, item) => sum + (item.billingCycle === 'ANNUAL' ? subscriptionPlans[item.plan].annualPrice / 12 : subscriptionPlans[item.plan].monthlyPrice), 0);
  const grossRevenue = completedPayments.reduce((sum, item) => sum + Number(item.amount), 0);
  const grossRevenue30Days = recentCompleted.reduce((sum, item) => sum + Number(item.amount), 0);
  const refunds = creditNotes.reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);
  const refunds30Days = recentCreditNotes.reduce((sum, item) => sum + Math.abs(Number(item.total)), 0);
  const netCollectedRevenue = Math.max(0, grossRevenue - refunds);
  const netRevenue30Days = Math.max(0, grossRevenue30Days - refunds30Days);
  const estimatedFees = completedPayments.reduce((sum, item) => sum + (item.checkoutRequestId ? estimatedMpesaFee(Number(item.amount)) : 0), 0);
  const estimatedNetRevenue = netCollectedRevenue - estimatedFees;
  const capacityWarnings = active.flatMap((item) => {
    const limit = subscriptionPlans[item.plan].memberLimit;
    const members = item.organization.members.length;
    return limit !== null && members >= limit * 0.8 ? [{ organizationId: item.organizationId, organizationName: item.organization.name, plan: item.plan, members, limit, percentage: Math.round((members / limit) * 100) }] : [];
  }).sort((a, b) => b.percentage - a.percentage);

  res.json({
    plans: Object.fromEntries(Object.keys(subscriptionPlans).map((plan) => [plan, subscriptions.filter((item) => item.plan === plan).length])),
    statuses: Object.fromEntries(['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].map((status) => [status, subscriptions.filter((item) => item.status === status).length])),
    payments: Object.fromEntries(paymentGroups.map((row) => [row.status, row._count._all])),
    delivery: { statuses: Object.fromEntries(deliveryStatuses.map((row) => [row.status, row._count._all])), types: Object.fromEntries(deliveryTypes.map((row) => [row.type, row._count._all])), total: deliveryStatuses.reduce((sum, row) => sum + row._count._all, 0), deliveryRatePercent: deliveryStatuses.reduce((sum, row) => sum + row._count._all, 0) ? Math.round(((deliveryStatuses.find((row) => row.status === 'DELIVERED')?._count._all ?? 0) / deliveryStatuses.reduce((sum, row) => sum + row._count._all, 0)) * 1000) / 10 : 0 },
    metrics: {
      activeSubscriptions: paying.length, activeTrials: trials.length, expiredTrials: expiredTrials.length,
      mrr: Math.round(mrr), arr: Math.round(mrr * 12),
      totalRevenue: grossRevenue, grossRevenue, refunds, netCollectedRevenue,
      revenue30Days: netRevenue30Days, grossRevenue30Days, refunds30Days, netRevenue30Days,
      estimatedTransactionFees: Math.round(estimatedFees), estimatedNetRevenue: Math.round(estimatedNetRevenue),
      grossMarginPercent: grossRevenue ? Math.round((estimatedNetRevenue / grossRevenue) * 1000) / 10 : 0,
      trialConversionPercent: paying.length + expiredTrials.length ? Math.round((paying.length / (paying.length + expiredTrials.length)) * 1000) / 10 : 0,
      monthlyCancellationRate: active.length + cancelledRecently ? Math.round((cancelledRecently / (active.length + cancelledRecently)) * 1000) / 10 : 0,
      payingChamas: paying.length,
      freeChamas: subscriptions.filter((item) => item.plan === 'FREE').length,
      trialGraceChamas: trials.length + subscriptions.filter((item) => item.status === 'PAST_DUE').length,
      newSubscriptions,
      renewals: renewalPayments,
      failedPayments,
      annualSubscriptions,
      monthlySubscriptions,
      averageRevenuePerChama: paying.length ? Math.round(mrr / paying.length) : 0,
      revenueThisMonth: Number(monthRevenue._sum.amount ?? 0),
      revenueThisYear: Number(yearRevenue._sum.amount ?? 0),
      outstandingRenewals: subscriptions.filter((item) => item.status === 'PAST_DUE' || (item.currentPeriodEnd && item.currentPeriodEnd <= new Date(now.getTime() + 14 * 86400000))).length,
      funnel: {
        visitors: funnelCounts.LANDING_VISITED ?? null,
        registeredUsers: funnelCounts.ACCOUNT_CREATED ?? registeredUsers,
        createdChamas: funnelCounts.CHAMA_CREATED ?? createdOrganizations,
        addedMembers: memberGroups.filter((group) => group._count._all > 1).length,
        usedContributions: funnelCounts.FIRST_CONTRIBUTION ?? contributionGroups.length,
        hitPremiumFeature: funnelCounts.PREMIUM_FEATURE_ATTEMPTED ?? premiumOrganizations,
        viewedPricing: funnelCounts.PRICING_VIEWED ?? pricingViews,
        startedCheckout: checkoutRequests,
        paid: funnelCounts.PAID ?? paying.length,
        pricingViews,
        checkoutStarts: funnelCheckoutStarts,
      },
    },
    capacityWarnings: capacityWarnings.slice(0, 10),
  });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), plan: planSchema.optional(), status: statusSchema.optional(), search: z.string().trim().max(100).optional() }).parse(req.query);
  const where = { ...(query.plan ? { plan: query.plan } : {}), ...(query.status ? { status: query.status } : {}), ...(query.search ? { organization: { name: { contains: query.search, mode: 'insensitive' as const } } } : {}) };
  const [items, total] = await Promise.all([
    prisma.organizationSubscription.findMany({ where, include: { organization: { select: { id: true, name: true, slug: true, createdById: true, members: { where: { status: 'ACTIVE' }, select: { id: true } } } } }, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.organizationSubscription.count({ where }),
  ]);
  res.json({ items: items.map((item) => ({ ...item, memberCount: item.organization.members.length, memberLimit: subscriptionPlans[item.plan].memberLimit, organization: { ...item.organization, members: undefined } })), pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

router.get('/payments', asyncHandler(async (req: Request, res: Response) => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: paymentStatusSchema.optional() }).parse(req.query);
  const where = { organizationId: { not: null }, ...(query.status ? { status: query.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.planChangeRequest.findMany({ where, include: { user: { select: { firstName: true, lastName: true, email: true } }, organization: { select: { name: true } }, billingDocuments: { select: { id: true, type: true, documentNumber: true, status: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.planChangeRequest.count({ where }),
  ]);
  res.json({ items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}));

router.post('/payments/:id/refund', asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ reason: z.string().trim().min(5).max(500), refundReference: z.string().trim().min(3).max(100) }).parse(req.body);
  try {
    const creditNote = await billingDocumentService.recordRefund(z.string().cuid().parse(req.params.id), input.reason, input.refundReference);
    await prisma.auditLog.create({ data: { action: 'PAYMENT_PROCESSED', entityType: 'BillingDocument', entityId: creditNote.id, userId: req.user!.id, organizationId: creditNote.organizationId, newValues: { type: 'CREDIT_NOTE', refundReference: input.refundReference, reason: input.reason, total: Number(creditNote.total) }, metadata: { operation: 'SUBSCRIPTION_REFUND_RECORDED' } } });
    res.json({ creditNote, message: `Refund recorded. Credit note ${creditNote.documentNumber} is ready.` });
  } catch (error) { throw new BadRequestError((error as Error).message); }
}));

router.post('/payments/:id/simulate-success', asyncHandler(async (req: Request, res: Response) => {
  if (!config.server.isDevelopment) throw new BadRequestError('Payment simulation is disabled outside development.');
  const id = z.string().cuid().parse(req.params.id);
  const request = await prisma.planChangeRequest.findUnique({ where: { id } });
  if (!request?.organizationId || !['PENDING', 'PROCESSING'].includes(request.status)) throw new BadRequestError('Only an open organization payment can be simulated.');
  const now = new Date(); const periodEnd = new Date(now); if (request.billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1); else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const reference = `DEV-${Date.now()}-${request.id.slice(-5).toUpperCase()}`;
  await prisma.$transaction([
    prisma.planChangeRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', receiptNumber: reference, paidAt: now, failureReason: null, callbackPayload: { simulated: true, environment: 'development', confirmedBy: req.user!.id } } }),
    prisma.organizationSubscription.upsert({ where: { organizationId: request.organizationId }, create: { organizationId: request.organizationId, plan: request.requestedPlan, billingCycle: request.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, provider: 'DEVELOPMENT_SIMULATOR', providerReference: reference }, update: { plan: request.requestedPlan, billingCycle: request.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, gracePeriodEnd: null, cancelAtPeriodEnd: false, trialEndsAt: null, provider: 'DEVELOPMENT_SIMULATOR', providerReference: reference } }),
  ]);
  const documents = await billingDocumentService.ensureForPayment(request.id);
  await prisma.auditLog.create({ data: { action: 'PAYMENT_PROCESSED', entityType: 'PlanChangeRequest', entityId: request.id, userId: req.user!.id, organizationId: request.organizationId, newValues: { status: 'COMPLETED', reference, simulated: true }, metadata: { operation: 'DEVELOPMENT_PAYMENT_SIMULATION' } } });
  res.json({ reference, documents, message: 'Development payment completed. No phone or M-Pesa account was charged.' });
}));

router.get('/billing-documents/:id/pdf', asyncHandler(async (req: Request, res: Response) => {
  const rendered = await billingDocumentService.renderPdf(z.string().cuid().parse(req.params.id));
  if (!rendered) throw new NotFoundError('Billing document');
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${rendered.item.documentNumber}.pdf"`); res.send(rendered.buffer);
}));

router.get('/reconciliation.csv', asyncHandler(async (_req: Request, res: Response) => {
  const report = await billingDocumentService.reconciliationCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="CHAMA360-billing-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`); res.send(report);
}));

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ plan: planSchema.optional(), status: statusSchema.optional(), billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(), extendTrialDays: z.number().int().min(1).max(365).optional() }).refine((value) => Object.values(value).some((item) => item !== undefined), 'Provide at least one change').parse(req.body);
  const existing = await prisma.organizationSubscription.findUnique({ where: { id: req.params.id }, include: { organization: { select: { name: true } } } });
  if (!existing) throw new NotFoundError('Organization subscription');
  if (input.plan === 'FREE' && input.billingCycle) throw new BadRequestError('The Free trial does not use a billing cycle.');
  const trialEndsAt = input.extendTrialDays ? new Date(Math.max(Date.now(), existing.trialEndsAt?.getTime() ?? 0) + input.extendTrialDays * 86400000) : undefined;
  const subscription = await prisma.organizationSubscription.update({ where: { id: existing.id }, data: { plan: input.plan, status: input.extendTrialDays ? 'ACTIVE' : input.status, billingCycle: input.billingCycle, trialEndsAt, ...(input.plan && input.plan !== 'FREE' ? { trialEndsAt: null } : {}) } });
  res.json({ subscription, message: `${existing.organization.name} subscription updated.` });
}));

router.post('/:id/manual-payment', asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ plan: z.enum(['STARTER', 'GROWTH', 'PRO', 'INVESTMENT_AUTOMATION', 'ENTERPRISE']), billingCycle: z.enum(['MONTHLY', 'ANNUAL']), reference: z.string().trim().min(3).max(100) }).parse(req.body);
  const existing = await prisma.organizationSubscription.findUnique({ where: { id: req.params.id }, include: { organization: true } });
  if (!existing) throw new NotFoundError('Organization subscription');
  const duplicateReference = await prisma.planChangeRequest.findFirst({ where: { receiptNumber: input.reference, status: 'COMPLETED' } });
  if (duplicateReference) throw new BadRequestError('This payment reference has already been recorded.');
  const now = new Date(); const periodEnd = new Date(now);
  if (input.billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1); else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const amount = getPlanPrice(input.plan, input.billingCycle);
  const [subscription] = await prisma.$transaction([
    prisma.organizationSubscription.update({ where: { id: existing.id }, data: { plan: input.plan, billingCycle: input.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, gracePeriodEnd: null, cancelAtPeriodEnd: false, provider: 'MANUAL', providerReference: input.reference, trialEndsAt: null } }),
    prisma.planChangeRequest.create({ data: { userId: req.user!.id, organizationId: existing.organizationId, requestedPlan: input.plan, billingCycle: input.billingCycle, amount, status: 'COMPLETED', receiptNumber: input.reference, paidAt: now } }),
  ]);
  const payment = await prisma.planChangeRequest.findFirst({ where: { organizationId: existing.organizationId, receiptNumber: input.reference, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' } });
  if (payment) await billingDocumentService.ensureForPayment(payment.id);
  res.json({ subscription, amount, message: `Manual payment recorded for ${existing.organization.name}.` });
}));

router.post('/payments/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const request = await prisma.planChangeRequest.findFirst({ where: { id: req.params.id, status: { in: ['PENDING', 'PROCESSING'] } } });
  if (!request) throw new NotFoundError('Open payment request');
  const updated = await prisma.planChangeRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED', failureReason: 'Cancelled by CHAMA360 support' } });
  res.json({ request: updated, message: 'Payment request cancelled. No plan was activated.' });
}));

export { router as platformSubscriptionRouter };
