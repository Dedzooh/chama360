import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { getPlanPrice, subscriptionPlans } from '../config/subscriptions';
import { subscriptionPaymentService, type SubscriptionCallback } from '../services/subscriptionPaymentService';
import { logger } from '../config/logger';
import { subscriptionLifecycleService } from '../services/subscriptionLifecycleService';
import { billingDocumentService } from '../services/billingDocumentService';
import { config } from '../config/environment';

const router = Router();

const organizationIdSchema = z.string().cuid();

async function requireOrganizationBillingAccess(organizationId: string, userId: string, requireAdmin = false) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { role: true, organization: { select: { id: true, name: true } } },
  });
  if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenError('Active chama membership is required.');
  const role = membership.role?.name;
  if (requireAdmin && !['OWNER', 'FOUNDER', 'ADMIN', 'CHAIR', 'TREASURER'].includes(role ?? '')) {
    throw new ForbiddenError('Only a chama administrator or treasurer can manage billing.');
  }
  return membership;
}

router.get('/plans', (_req, res) => res.json({ plans: subscriptionPlans }));

router.get('/billing-organizations', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: req.user!.id,
      status: 'ACTIVE',
      role: { name: { in: ['FOUNDER', 'CHAIR', 'TREASURER'] } },
    },
    select: {
      organizationId: true,
      role: { select: { name: true, label: true } },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
        },
      },
    },
    orderBy: { organization: { name: 'asc' } },
  });

  res.json({
    organizations: memberships.map((membership) => ({
      ...membership.organization,
      memberCount: membership.organization._count.members,
      _count: undefined,
      role: membership.role?.name ?? null,
      roleLabel: membership.role?.label ?? null,
      subscription: membership.organization.subscription ?? { plan: 'FREE', status: 'ACTIVE', currentPeriodEnd: null },
    })),
  });
}));

router.get('/custom-request', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const organizationId = organizationIdSchema.parse(req.query.organizationId);
  await requireOrganizationBillingAccess(organizationId, req.user!.id);
  const request = await prisma.customPlanRequest.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ request });
}));

router.post('/custom-request', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({
    organizationId: organizationIdSchema,
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().email().max(200),
    contactPhone: z.string().trim().max(30).optional().or(z.literal('')),
    estimatedMembers: z.coerce.number().int().positive().max(10_000_000).optional(),
    requirements: z.string().trim().min(20, 'Please provide at least 20 characters describing your requirements.').max(5000),
    preferredTimeline: z.string().trim().max(120).optional().or(z.literal('')),
  }).parse(req.body);
  const membership = await requireOrganizationBillingAccess(input.organizationId, req.user!.id, true);
  const openRequest = await prisma.customPlanRequest.findFirst({
    where: { organizationId: input.organizationId, status: { in: ['SUBMITTED', 'REVIEWING', 'CONTACTED'] } },
  });
  if (openRequest) throw new BadRequestError('Your organization already has a custom package request under review.');
  const request = await prisma.customPlanRequest.create({
    data: {
      organizationId: input.organizationId,
      requestedById: req.user!.id,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone || null,
      estimatedMembers: input.estimatedMembers,
      requirements: input.requirements,
      preferredTimeline: input.preferredTimeline || null,
    },
  });
  await prisma.organizationAuditLog.create({
    data: { organizationId: input.organizationId, userId: req.user!.id, action: 'CREATE', entityType: 'CustomPlanRequest', entityId: request.id, newValues: { status: request.status, estimatedMembers: request.estimatedMembers } },
  });
  const confirmationTitle = 'Custom package request received';
  const confirmationMessage = `CHAMA360 received the custom package requirements for ${membership.organization.name}. Our team will review them and contact ${input.contactName} to discuss scope, pricing, and onboarding.`;
  const adminUsers = config.systemAdminEmails.length ? await prisma.user.findMany({ where: { email: { in: config.systemAdminEmails } }, select: { id: true, email: true } }) : [];
  await Promise.all([
    prisma.notification.create({ data: { dedupeKey: `custom-plan:${request.id}:submitted:requester`, recipientId: req.user!.id, organizationId: input.organizationId, type: 'GENERAL_UPDATE', priority: 'IMPORTANT', title: confirmationTitle, message: confirmationMessage, channels: { create: [{ type: 'IN_APP', address: req.user!.id }, { type: 'EMAIL', address: input.contactEmail }] } } }),
    ...adminUsers.map((admin) => prisma.notification.create({ data: { dedupeKey: `custom-plan:${request.id}:submitted:admin:${admin.id}`, recipientId: admin.id, organizationId: input.organizationId, type: 'GENERAL_UPDATE', priority: 'IMPORTANT', title: `Custom package request: ${membership.organization.name}`, message: `${input.contactName} submitted custom requirements for approximately ${input.estimatedMembers?.toLocaleString() ?? 'an unspecified number of'} members. Review the request in Platform Subscriptions.`, channels: { create: [{ type: 'IN_APP', address: admin.id }, { type: 'EMAIL', address: admin.email }] } } })),
  ]);
  res.status(201).json({ request, message: 'Your requirements were sent to CHAMA360. An administrator will contact your organization to discuss scope, pricing, and onboarding.' });
}));

router.post('/callback', asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as SubscriptionCallback;
  const callback = payload.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  if (!checkoutRequestId || typeof callback?.ResultCode !== 'number') {
    throw new BadRequestError('Invalid M-Pesa callback payload');
  }

  const request = await prisma.planChangeRequest.findUnique({ where: { checkoutRequestId } });
  if (!request) {
    logger.warn('Subscription callback does not match a checkout', { checkoutRequestId });
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
  if (request.status === 'COMPLETED' || request.status === 'FAILED') {
    return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  }

  const metadata = callback.CallbackMetadata?.Item ?? [];
  const value = (name: string) => metadata.find((item) => item.Name === name)?.Value;
  const receipt = String(value('MpesaReceiptNumber') ?? '');
  const paidAmount = Number(value('Amount'));
  const paidPhone = String(value('PhoneNumber') ?? '');
  const callbackPayload = JSON.parse(JSON.stringify(payload));

  if (callback.ResultCode === 0 && receipt) {
    const expectedPhone = request.phone ? subscriptionPaymentService.normalizePhone(request.phone) : '';
    if (paidAmount !== Number(request.amount) || (expectedPhone && paidPhone !== expectedPhone)) {
      logger.error('Rejected mismatched subscription payment callback', { checkoutRequestId, paidAmount, paidPhone, expectedAmount: Number(request.amount), expectedPhone });
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted for review' });
    }
    const now = new Date();
    const existingSubscription = request.organizationId
      ? await prisma.organizationSubscription.findUnique({ where: { organizationId: request.organizationId } })
      : await prisma.subscription.findUnique({ where: { userId: request.userId } });
    const periodStart = existingSubscription?.currentPeriodEnd && existingSubscription.currentPeriodEnd > now ? existingSubscription.currentPeriodEnd : now;
    const periodEnd = new Date(periodStart);
    if (request.billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const activateSubscription = request.organizationId ? prisma.organizationSubscription.upsert({
        where: { organizationId: request.organizationId },
        create: { organizationId: request.organizationId, plan: request.requestedPlan, billingCycle: request.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, provider: 'M_PESA', providerReference: receipt },
        update: { plan: request.requestedPlan, billingCycle: request.billingCycle, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, gracePeriodEnd: null, cancelAtPeriodEnd: false, provider: 'M_PESA', providerReference: receipt },
      }) : prisma.subscription.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId, plan: request.requestedPlan, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, provider: 'M_PESA', providerReference: receipt },
        update: { plan: request.requestedPlan, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd, gracePeriodEnd: null, cancelAtPeriodEnd: false, provider: 'M_PESA', providerReference: receipt },
      });
    await prisma.$transaction([
      prisma.planChangeRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', receiptNumber: receipt, paidAt: now, callbackPayload } }),
      activateSubscription,
    ]);
    await billingDocumentService.ensureForPayment(request.id);
  } else {
    await prisma.planChangeRequest.update({ where: { id: request.id }, data: { status: 'FAILED', failureReason: callback.ResultDesc || 'Payment was not completed', callbackPayload } });
  }
  return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}));

router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.query.organizationId ? organizationIdSchema.parse(req.query.organizationId) : null;
  if (organizationId) await requireOrganizationBillingAccess(organizationId, req.user!.id);
  const subscription = organizationId ? await subscriptionLifecycleService.reconcileOrganization(organizationId) : await subscriptionLifecycleService.reconcileUser(req.user!.id);
  const requests = await prisma.planChangeRequest.findMany({ where: { userId: req.user!.id, organizationId }, orderBy: { createdAt: 'desc' }, take: 5 });
  const daysRemaining = subscription.currentPeriodEnd ? Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / 86400000) : null;
  const memberCount = organizationId ? await prisma.organizationMember.count({ where: { organizationId, status: 'ACTIVE' } }) : null;
  res.json({ subscription, scope: organizationId ? 'ORGANIZATION' : 'USER', features: subscriptionPlans[subscription.plan].features, requests, usage: { members: memberCount, memberLimit: subscriptionPlans[subscription.plan].memberLimit }, renewal: { daysRemaining, renewable: subscription.plan !== 'FREE', inGracePeriod: subscription.status === 'PAST_DUE' } });
}));

router.post('/request-upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ plan: z.enum(['STARTER', 'GROWTH', 'PRO', 'INVESTMENT_AUTOMATION', 'ENTERPRISE']), billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'), organizationId: organizationIdSchema, phone: z.string().trim().optional() }).parse(req.body);
  await requireOrganizationBillingAccess(input.organizationId, req.user!.id, true);
  const memberCount = await prisma.organizationMember.count({ where: { organizationId: input.organizationId, status: 'ACTIVE' } });
  const memberLimit = subscriptionPlans[input.plan].memberLimit;
  if (memberLimit !== null && memberCount > memberLimit) {
    throw new BadRequestError(`${subscriptionPlans[input.plan].name} supports up to ${memberLimit} active members. Choose a plan that fits this chama.`);
  }
  const price = getPlanPrice(input.plan, input.billingCycle, memberCount);
  if (!price) throw new BadRequestError('Invalid paid plan');
  const processing = await prisma.planChangeRequest.findFirst({ where: { organizationId: input.organizationId, status: 'PROCESSING' } });
  if (processing) throw new BadRequestError('An M-Pesa payment is already awaiting confirmation. Complete or cancel it before starting another upgrade.');
  let phone: string | undefined;
  if (input.phone) {
    try { phone = subscriptionPaymentService.normalizePhone(input.phone); } catch (error) { throw new BadRequestError((error as Error).message); }
  }
  await prisma.planChangeRequest.updateMany({ where: { organizationId: input.organizationId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  const request = await prisma.planChangeRequest.create({ data: { userId: req.user!.id, organizationId: input.organizationId, requestedPlan: input.plan, billingCycle: input.billingCycle, amount: price, phone } });
  await billingDocumentService.ensureForPayment(request.id);
  res.status(202).json({
    request,
    checkoutReady: subscriptionPaymentService.isConfigured(),
    message: 'Upgrade selected. Enter the M-Pesa number and confirm before a payment request is sent.',
  });
}));

router.post('/checkout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ requestId: z.string().min(1), phone: z.string().trim().min(9) }).parse(req.body);
  const request = await prisma.planChangeRequest.findFirst({ where: { id: input.requestId, userId: req.user!.id } });
  if (!request || request.status !== 'PENDING') throw new BadRequestError('This upgrade request is no longer available for checkout.');
  if (!request.organizationId) throw new BadRequestError('Select a chama before starting checkout.');
  await requireOrganizationBillingAccess(request.organizationId, req.user!.id, true);
  if (!subscriptionPaymentService.isConfigured()) throw new BadRequestError('M-Pesa checkout is not configured. Please contact support.');
  let phone: string;
  try { phone = subscriptionPaymentService.normalizePhone(input.phone); } catch (error) { throw new BadRequestError((error as Error).message); }

  const result = await subscriptionPaymentService.initiate({ phone, amount: Number(request.amount), reference: `SUB-${request.id}` });
  if (result.ResponseCode !== '0') throw new BadRequestError(result.ResponseDescription || 'M-Pesa could not start checkout.');
  const updated = await prisma.planChangeRequest.update({ where: { id: request.id }, data: { phone, status: 'PROCESSING', checkoutRequestId: result.CheckoutRequestID, merchantRequestId: result.MerchantRequestID } });
  res.status(202).json({ request: updated, customerMessage: result.CustomerMessage || 'Check your phone and enter your M-Pesa PIN.' });
}));

router.get('/requests/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const request = await prisma.planChangeRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!request) throw new BadRequestError('Upgrade request not found.');
  res.json({ request });
}));

router.get('/billing/documents', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const organizationId = organizationIdSchema.parse(req.query.organizationId);
  await requireOrganizationBillingAccess(organizationId, req.user!.id);
  const documents = await prisma.billingDocument.findMany({ where: { organizationId }, orderBy: { issuedAt: 'desc' }, take: 100 });
  res.json({ documents });
}));

router.get('/billing/documents/:id/pdf', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const id = z.string().cuid().parse(req.params.id);
  const document = await prisma.billingDocument.findUnique({ where: { id }, select: { organizationId: true } });
  if (!document) throw new BadRequestError('Billing document not found.');
  await requireOrganizationBillingAccess(document.organizationId, req.user!.id);
  const rendered = await billingDocumentService.renderPdf(id);
  if (!rendered) throw new BadRequestError('Billing document not found.');
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${rendered.item.documentNumber}.pdf"`); res.send(rendered.buffer);
}));

router.post('/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = z.object({ organizationId: organizationIdSchema }).parse(req.body);
  await requireOrganizationBillingAccess(organizationId, req.user!.id, true);
  const current = await subscriptionLifecycleService.reconcileOrganization(organizationId);
  if (current.plan === 'FREE') throw new BadRequestError('The Free plan does not require cancellation.');
  const subscription = await prisma.organizationSubscription.update({ where: { organizationId }, data: { cancelAtPeriodEnd: true } });
  res.json({ subscription, message: 'Subscription will remain active until the end of the billing period.' });
}));

router.post('/resume', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = z.object({ organizationId: organizationIdSchema }).parse(req.body);
  await requireOrganizationBillingAccess(organizationId, req.user!.id, true);
  const current = await subscriptionLifecycleService.reconcileOrganization(organizationId);
  if (current.plan === 'FREE') throw new BadRequestError('Choose a paid plan to start a subscription.');
  const subscription = await prisma.organizationSubscription.update({ where: { organizationId }, data: { cancelAtPeriodEnd: false } });
  res.json({ subscription, message: 'Automatic expiry cancellation has been removed.' });
}));

export { router as subscriptionRouter };
