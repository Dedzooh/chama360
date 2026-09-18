// @ts-nocheck
import { Router, Request, Response } from 'express';
import { mpesaService } from '../services/mpesaService';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { auditLog, logger } from '../config/logger';
import {
  initiateMpesaPaymentSchema,
  mpesaCallbackSchema,
  mpesaC2BConfirmationSchema,
  manualReconciliationSchema,
  bulkReconciliationSchema,
  retryPaymentSchema,
  getPaymentHistorySchema,
} from '../schemas/mpesa';
import { prisma } from '../config/database';
import { TransactionStatus } from '@prisma/client';
import { requireSubscriptionFeature } from '../middleware/subscription';
import { config } from '../config/environment';
import { allocatePaidContribution } from '../services/contributionAllocationService';

const router = Router();

/**
 * POST /mpesa/initiate
 * Initiate M-Pesa STK Push payment
 * Requirements: 15.1, 15.2
 */
router.post('/initiate',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const paymentData = initiateMpesaPaymentSchema.parse(req.body);
    if (!config.mpesa.consumerKey || !config.mpesa.consumerSecret || !config.mpesa.shortcode || !config.mpesa.passkey || !config.mpesa.callbackUrl) {
      throw new BadRequestError('M-Pesa STK Push is not configured. Add Safaricom credentials or use the Chama PayBill instructions.');
    }

    // Get contribution details
    const contribution = await prisma.contribution.findUnique({
      where: { id: paymentData.contributionId },
      include: {
        chama: true,
        member: true,
      },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    if (!['PENDING', 'PARTIAL', 'OVERDUE'].includes(contribution.status)) {
      throw new BadRequestError('Only an outstanding contribution can be paid by STK Push');
    }

    // Verify user has permission (member themselves, or Treasurer/Chair/Founder)
    const userMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: contribution.chamaId,
          userId: req.user.id,
        },
      },
    });

    const organizationMembership = contribution.organizationId ? await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: contribution.organizationId, userId: req.user.id } },
      include: { role: { select: { name: true } } },
    }) : null;
    const allowedRoles = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'];
    const canInitiate = 
      req.user.id === contribution.memberId ||
      (userMembership && allowedRoles.includes(userMembership.role)) ||
      (organizationMembership?.status === 'ACTIVE' && organizationMembership.role && allowedRoles.includes(organizationMembership.role.name));

    if (!canInitiate) {
      throw new BadRequestError('Insufficient permissions to initiate payment');
    }

    // Initiate M-Pesa payment
    const result = await mpesaService.initiatePayment({
      contributionId: paymentData.contributionId,
      memberId: contribution.memberId,
      chamaId: contribution.chamaId,
      organizationId: contribution.organizationId,
      amount: Number(contribution.amount),
      phoneNumber: paymentData.phoneNumber,
      accountReference: paymentData.accountReference,
      transactionDesc: paymentData.transactionDesc,
    });

    // Audit log
    auditLog('CREATE', contribution.chamaId, req.user.id, {
      action: 'MPESA_PAYMENT_INITIATED',
      contributionId: paymentData.contributionId,
      amount: contribution.amount,
      phoneNumber: paymentData.phoneNumber,
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('M-Pesa payment initiated', {
      contributionId: paymentData.contributionId,
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      initiatedBy: req.user.id,
    });

    res.status(201).json({
      message: 'Payment initiated successfully',
      data: {
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        customerMessage: result.customerMessage,
      },
    });
  })
);

/**
 * POST /mpesa/callback
 * Handle M-Pesa payment callback (webhook)
 * Requirements: 15.2, 15.3, 15.5
 */
router.post('/callback',
  asyncHandler(async (req: Request, res: Response) => {
    // Validate callback data
    const callbackData = mpesaCallbackSchema.parse(req.body);

    // Persist before acknowledging; a worker owns processing and retries.
    await mpesaService.enqueueCallback(callbackData);

    // Respond immediately to M-Pesa
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });
  })
);

router.post('/c2b/confirmation',
  asyncHandler(async (req: Request, res: Response) => {
    const confirmation = mpesaC2BConfirmationSchema.parse(req.body);
    const result = await mpesaService.handleC2BConfirmation(confirmation);
    res.status(200).json({ ResultCode: 0, ResultDesc: result.message });
  })
);

/**
 * GET /mpesa/status/:checkoutRequestId
 * Query M-Pesa payment status
 * Requirements: 15.2
 */
router.get('/status/:checkoutRequestId',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      throw new BadRequestError('Checkout request ID is required');
    }

    const status = await mpesaService.queryPaymentStatus(checkoutRequestId);

    res.json({
      checkoutRequestId,
      status: status.status,
      resultCode: status.resultCode,
      resultDescription: status.resultDescription,
      mpesaReceiptNumber: status.mpesaReceiptNumber,
    });
  })
);

/**
 * POST /mpesa/reconcile/manual
 * Manually reconcile M-Pesa payment
 * Requirements: 15.5
 */
router.post('/reconcile/manual',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const reconciliationData = manualReconciliationSchema.parse(req.body);

    // Get contribution details
    const contribution = await prisma.contribution.findUnique({
      where: { id: reconciliationData.contributionId },
      include: {
        chama: true,
      },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    const [organizationMembership, legacyMembership] = await Promise.all([
      contribution.organizationId ? prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: contribution.organizationId, userId: req.user.id } }, include: { role: { select: { name: true } } } }) : null,
      prisma.chamaMembership.findUnique({ where: { chamaId_userId: { chamaId: contribution.chamaId, userId: req.user.id } } }),
    ]);
    const financeRoles = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'];
    const organizationRole = organizationMembership?.role?.name ?? '';
    if (!financeRoles.includes(organizationRole) && !['FOUNDER', 'TREASURER'].includes(legacyMembership?.role ?? '')) throw new ForbiddenError('Only Treasurer or Admin can reconcile payments');
    if (contribution.status === 'PAID' || contribution.status === 'REVERSED') throw new BadRequestError('Select an outstanding contribution');

    const receipt = reconciliationData.mpesaReceiptNumber.toUpperCase();
    const receiptTransaction = await prisma.transaction.findFirst({ where: { OR: [{ reference: { in: [`MPESA-${receipt}`, `MPESA-C2B-${receipt}`] } }, { metadata: { path: ['mpesaReceiptNumber'], equals: receipt } }] }, orderBy: { createdAt: 'asc' } });
    if (receiptTransaction?.status === TransactionStatus.COMPLETED) throw new BadRequestError('Payment already reconciled');
    if (receiptTransaction?.organizationId && contribution.organizationId && receiptTransaction.organizationId !== contribution.organizationId) throw new BadRequestError('Receipt belongs to a different Chama');

    const priorPayments = await prisma.transaction.aggregate({ where: { type: 'CONTRIBUTION', fromMemberId: contribution.memberId, status: 'COMPLETED', metadata: { path: ['contributionId'], equals: contribution.id } }, _sum: { amount: true } });
    const totalReceived = Number(priorPayments._sum.amount ?? 0) + Number(reconciliationData.amount);
    const amountRequired = Number(contribution.amount) + Number(contribution.penalties ?? 0);
    const fullyPaid = totalReceived >= amountRequired;
    const contributionAmount = fullyPaid && totalReceived > Number(contribution.amount) ? totalReceived : Number(contribution.amount);
    const paidDate = new Date(reconciliationData.transactionDate);
    const transaction = await prisma.$transaction(async (tx) => {
      const transactionMetadata = { ...((receiptTransaction?.metadata ?? {}) as any), contributionId: contribution.id, mpesaReceiptNumber: receipt, phoneNumber: reconciliationData.phoneNumber, transactionDate: reconciliationData.transactionDate, paymentMethod: 'MPESA', manualReconciliation: true, reconciliationRequired: false, reconciledBy: req.user!.id, reconciledAt: new Date() };
      const reconciledTransaction = receiptTransaction
        ? await tx.transaction.update({ where: { id: receiptTransaction.id }, data: { organizationId: contribution.organizationId, fromMemberId: contribution.memberId, status: 'COMPLETED', metadata: transactionMetadata } })
        : await tx.transaction.create({ data: { chamaId: contribution.chamaId, organizationId: contribution.organizationId, type: 'CONTRIBUTION', amount: reconciliationData.amount, fromMemberId: contribution.memberId, reference: `MPESA-${receipt}`, idempotencyKey: `MPESA:MANUAL:${receipt}`, status: 'COMPLETED', metadata: transactionMetadata } });
      const updated = await tx.contribution.update({ where: { id: contribution.id }, data: { amount: contributionAmount, status: fullyPaid ? 'PAID' : 'PARTIAL', paidDate, paidAt: fullyPaid ? paidDate : null, paymentMethod: 'MPESA', reference: receipt, transactionRef: receipt, recordedById: req.user!.id } });
      if (contribution.organizationId) {
        await allocatePaidContribution(tx, updated);
        await tx.organizationWallet.upsert({ where: { organizationId: contribution.organizationId }, create: { organizationId: contribution.organizationId, balance: reconciliationData.amount, currency: contribution.chama.currency }, update: { balance: { increment: reconciliationData.amount } } });
        await tx.organizationAuditLog.create({ data: { organizationId: contribution.organizationId, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contribution.id, oldValues: contribution as any, newValues: updated as any, metadata: { operation: 'MPESA_MANUAL_RECONCILIATION', receipt, transactionId: reconciledTransaction.id } } });
      }
      await tx.notification.upsert({ where: { dedupeKey: `manual-reconciliation:${receipt}` }, update: {}, create: { dedupeKey: `manual-reconciliation:${receipt}`, recipientId: contribution.memberId, organizationId: contribution.organizationId, chamaId: contribution.chamaId, type: 'GENERAL_UPDATE', priority: 'INFO', title: fullyPaid ? 'M-Pesa payment reconciled' : 'Partial M-Pesa payment reconciled', message: `Your payment of KES ${Number(reconciliationData.amount).toLocaleString()} was matched to your contribution. Receipt: ${receipt}.`, status: 'DELIVERED', sentAt: new Date(), channels: { create: [{ type: 'IN_APP', address: contribution.memberId, status: 'DELIVERED', deliveredAt: new Date() }] } } });
      return reconciledTransaction;
    });

    // Audit log
    auditLog('CREATE', contribution.chamaId, req.user.id, {
      action: 'MPESA_MANUAL_RECONCILIATION',
      contributionId: reconciliationData.contributionId,
      mpesaReceiptNumber: reconciliationData.mpesaReceiptNumber,
      amount: reconciliationData.amount,
      transactionId: transaction.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('M-Pesa payment manually reconciled', {
      contributionId: reconciliationData.contributionId,
      mpesaReceiptNumber: reconciliationData.mpesaReceiptNumber,
      amount: reconciliationData.amount,
      reconciledBy: req.user.id,
    });

    res.json({
      message: 'Payment reconciled successfully',
      transaction: {
        id: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        status: transaction.status,
      },
    });
  })
);

/**
 * POST /mpesa/reconcile/bulk
 * Bulk reconcile M-Pesa payments
 * Requirements: 15.5
 */
router.post('/reconcile/bulk',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const bulkData = bulkReconciliationSchema.parse(req.body);
    const chamaId = req.currentChama?.id;
    if (!chamaId) {
      throw new ForbiddenError('Chama context required');
    }

    const successful: string[] = [];
    const failed: { mpesaReceiptNumber: string; error: string }[] = [];

    for (const payment of bulkData.payments) {
      try {
        // Get contribution details
        const contribution = await prisma.contribution.findUnique({
          where: { id: payment.contributionId },
        });

        if (!contribution) {
          throw new Error('Contribution not found');
        }
        if (contribution.chamaId !== chamaId) {
          throw new ForbiddenError('Contribution does not belong to the selected Chama');
        }

        // Check if payment already exists
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            reference: `MPESA-${payment.mpesaReceiptNumber}`,
          },
        });

        if (existingTransaction) {
          throw new Error('Payment already reconciled');
        }

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              chamaId: contribution.chamaId,
              type: 'CONTRIBUTION',
              amount: payment.amount,
              fromMemberId: contribution.memberId,
              reference: `MPESA-${payment.mpesaReceiptNumber}`,
              idempotencyKey: `MPESA:BULK:${payment.mpesaReceiptNumber}`,
              status: TransactionStatus.COMPLETED,
              metadata: {
                contributionId: contribution.id,
                mpesaReceiptNumber: payment.mpesaReceiptNumber,
                phoneNumber: payment.phoneNumber,
                transactionDate: payment.transactionDate,
                paymentMethod: 'MPESA',
                bulkReconciliation: true,
                reconciledBy: req.user.id,
              },
            },
          });

          await tx.contribution.update({
            where: { id: payment.contributionId },
            data: {
              status: 'PAID',
              paidDate: new Date(payment.transactionDate),
              paymentMethod: 'MPESA',
              transactionRef: payment.mpesaReceiptNumber,
            },
          });
        });

        successful.push(payment.mpesaReceiptNumber);
      } catch (error) {
        failed.push({
          mpesaReceiptNumber: payment.mpesaReceiptNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Audit log
    auditLog('CREATE', 'bulk-reconciliation', req.user.id, {
      action: 'MPESA_BULK_RECONCILIATION',
      total: bulkData.payments.length,
      successful: successful.length,
      failed: failed.length,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('M-Pesa bulk reconciliation completed', {
      total: bulkData.payments.length,
      successful: successful.length,
      failed: failed.length,
      reconciledBy: req.user.id,
    });

    res.json({
      message: 'Bulk reconciliation completed',
      successful,
      failed,
      summary: {
        total: bulkData.payments.length,
        successful: successful.length,
        failed: failed.length,
      },
    });
  })
);

/**
 * POST /mpesa/retry/:contributionId
 * Retry failed M-Pesa payment
 * Requirements: 15.3
 */
router.post('/retry/:contributionId',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { contributionId } = req.params;

    if (!contributionId) {
      throw new BadRequestError('Contribution ID is required');
    }

    const retryData = retryPaymentSchema.parse({
      contributionId,
      ...req.body,
    });

    // Get contribution details
    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
      include: {
        chama: true,
        member: true,
      },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    // Verify user has permission
    const userMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: contribution.chamaId,
          userId: req.user.id,
        },
      },
    });

    const allowedRoles = ['FOUNDER', 'TREASURER'];
    const canRetry = 
      req.user.id === contribution.memberId ||
      (userMembership && allowedRoles.includes(userMembership.role));

    if (!canRetry) {
      throw new BadRequestError('Insufficient permissions to retry payment');
    }

    // Use provided phone number or member's phone
    const phoneNumber = retryData.phoneNumber || contribution.member.phone;

    // Initiate M-Pesa payment
    const result = await mpesaService.initiatePayment({
      contributionId: contribution.id,
      memberId: contribution.memberId,
      chamaId: contribution.chamaId,
      organizationId: contribution.organizationId,
      amount: Number(contribution.amount),
      phoneNumber: phoneNumber,
      accountReference: `RETRY-${contribution.id.substring(0, 8)}`,
      transactionDesc: 'Retry Payment',
    });

    // Audit log
    auditLog('CREATE', contribution.chamaId, req.user.id, {
      action: 'MPESA_PAYMENT_RETRY',
      contributionId: contribution.id,
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('M-Pesa payment retry initiated', {
      contributionId: contribution.id,
      merchantRequestId: result.merchantRequestId,
      checkoutRequestId: result.checkoutRequestId,
      retriedBy: req.user.id,
    });

    res.json({
      message: 'Payment retry initiated successfully',
      data: {
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        customerMessage: result.customerMessage,
      },
    });
  })
);

/**
 * GET /mpesa/history
 * Get M-Pesa payment history
 * Requirements: 15.2
 */
router.get('/history',
  authenticate,
  requireSubscriptionFeature('MPESA_AUTOMATION'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const filters = getPaymentHistorySchema.parse({
      chamaId: req.query.chamaId as string,
      memberId: req.query.memberId as string,
      status: req.query.status as any,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    // Build where clause
    const where: any = {
      type: 'CONTRIBUTION',
      metadata: {
        path: ['paymentMethod'],
        equals: 'MPESA',
      },
    };

    const organizationId = res.locals.organizationId as string;
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { chama: { select: { id: true } } } });
    if (!organization) throw new NotFoundError('Organization not found');
    where.OR = [
      { organizationId },
      ...(organization.chama?.id ? [{ chamaId: organization.chama.id }] : []),
    ];

    if (filters.memberId) {
      // Verify user can view this member's payments
      if (filters.memberId !== req.user.id) {
        const membership = await prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: req.user.id } },
          include: { role: true },
        });
        if (!membership || !['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'AUDITOR', 'ADMIN'].includes(membership.role?.name ?? '')) {
          throw new BadRequestError('Insufficient permissions to view other members\' payments');
        }
      }

      where.fromMemberId = filters.memberId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.createdAt.lte = new Date(filters.toDate);
      }
    }

    // Get payments with pagination
    const [payments, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          fromMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          chama: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      payments: payments.map(p => ({
        id: p.id,
        reference: p.reference,
        amount: p.amount,
        status: p.status,
        mpesaReceiptNumber: (p.metadata as any)?.mpesaReceiptNumber,
        phoneNumber: (p.metadata as any)?.phoneNumber,
        contributionId: (p.metadata as any)?.contributionId,
        accountReference: (p.metadata as any)?.billRefNumber,
        reconciliationRequired: (p.metadata as any)?.reconciliationRequired === true,
        reconciliationReason: (p.metadata as any)?.reason,
        member: p.fromMember,
        chama: p.chama,
        createdAt: p.createdAt,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    });
  })
);

export { router as mpesaRouter };

