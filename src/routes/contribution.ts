import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ContributionService } from '../services/contributionService';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled, requireRole } from '../middleware/auth';
import { auditLog, logger } from '../config/logger';
import {
  createContributionCycleSchema,
  recordPaymentSchema,
  updateContributionSchema,
  getContributionsSchema,
  calculatePenaltiesSchema,
  currencyConversionSchema,
  contributionSummarySchema,
  bulkRecordPaymentSchema,
} from '../schemas/contribution';
import { prisma } from '../config/database';
import { ContributionStatus } from '@prisma/client';
import { isOperationalChama } from '../utils/chamaLifecycle';
import { mpesaService } from '../services/mpesaService';

const router = Router();

const recordPaymentByChamaSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['MPESA', 'BANK', 'CASH']),
  mpesaOption: z.enum(['STK_PUSH', 'PAYBILL', 'TILL']).optional(),
  paidDate: z.string().datetime().optional(),
  transactionRef: z.string().optional(),
  phoneNumber: z.string().optional(),
  paybillNumber: z.string().optional(),
  accountNumber: z.string().optional(),
  tillNumber: z.string().optional(),
  accountReference: z.string().min(1).max(12).optional(),
  transactionDesc: z.string().min(1).max(13).optional(),
});

const approvePaymentRequestSchema = z.object({
  paymentRequestId: z.string().cuid('Invalid payment request ID'),
});

/**
 * POST /contribution/cycle
 * Create a new contribution cycle
 * Requirements: 8.1
 */
router.post('/cycle',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const cycleData = createContributionCycleSchema.parse(req.body);

    const contributions = await ContributionService.createContributionCycle(
      cycleData,
      req.user.id
    );

    // Audit log
    auditLog('CREATE', cycleData.chamaId, req.user.id, {
      action: 'CONTRIBUTION_CYCLE_CREATED',
      contributionCount: contributions.length,
      dueDate: cycleData.dueDate,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Contribution cycle created', {
      chamaId: cycleData.chamaId,
      contributionCount: contributions.length,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: 'Contribution cycle created successfully',
      contributions: contributions.map(c => ({
        id: c.id,
        memberId: c.memberId,
        amount: c.amount,
        dueDate: c.dueDate,
        status: c.status,
      })),
      count: contributions.length,
    });
  })
);

/**
 * POST /contribution/:contributionId/payment
 * Record a payment for a contribution
 * Requirements: 8.2, 8.4
 */
router.post('/:contributionId/payment',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { contributionId } = req.params;

    if (!contributionId) {
      throw new BadRequestError('Contribution ID is required');
    }

    const paymentData = recordPaymentSchema.parse({
      contributionId,
      ...req.body,
    });

    const contribution = await ContributionService.recordPayment(
      paymentData,
      req.user.id
    );

    // Audit log
    auditLog('UPDATE', contributionId, req.user.id, {
      action: 'PAYMENT_RECORDED',
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      status: contribution.status,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Payment recorded', {
      contributionId,
      amount: paymentData.amount,
      status: contribution.status,
      recordedBy: req.user.id,
    });

    res.json({
      message: contribution.status === ContributionStatus.PENDING
        ? 'Payment submitted and awaiting Treasurer approval'
        : 'Payment recorded successfully',
      contribution: {
        id: contribution.id,
        status: contribution.status,
        amount: contribution.amount,
        paidDate: contribution.paidDate,
        penalties: contribution.penalties,
      },
    });
  })
);

/**
 * POST /contribution/chama/:chamaId/payment
 * Record a payment for the current user's next pending contribution in a chama
 */
router.post('/chama/:chamaId/payment',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const paymentData = recordPaymentByChamaSchema.parse(req.body);

    const nextContribution = await prisma.contribution.findFirst({
      where: {
        chamaId,
        memberId: req.user.id,
        status: { in: [ContributionStatus.PENDING, ContributionStatus.OVERDUE, ContributionStatus.PARTIAL] },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Allow manual ad-hoc contributions: if none is pending, create one and record payment against it.
    let contributionTargetId = nextContribution?.id;
    if (!contributionTargetId) {
      const membership = await prisma.chamaMembership.findUnique({
        where: {
          chamaId_userId: {
            chamaId,
            userId: req.user.id,
          },
        },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new BadRequestError('You must be an active member of this chama to make a payment');
      }

      const chama = await prisma.chama.findUnique({
        where: { id: chamaId },
        select: { status: true },
      });

      if (!isOperationalChama(chama?.status)) {
        throw new BadRequestError('This chama is not accepting new contributions');
      }

      const created = await prisma.contribution.create({
        data: {
          chamaId,
          memberId: req.user.id,
          amount: paymentData.amount,
          dueDate: paymentData.paidDate ? new Date(paymentData.paidDate) : new Date(),
          status: ContributionStatus.PENDING,
        },
      });

      contributionTargetId = created.id;
    }

    if (paymentData.paymentMethod === 'MPESA') {
      const mpesaOption = paymentData.mpesaOption || 'STK_PUSH';

      if (mpesaOption === 'PAYBILL' || mpesaOption === 'TILL') {
        if (!paymentData.transactionRef) {
          throw new BadRequestError('M-Pesa transaction code is required for Paybill/Till payments');
        }

        const contribution = await ContributionService.recordPayment(
          {
            contributionId: contributionTargetId,
            amount: paymentData.amount,
            paymentMethod: 'MPESA' as any,
            paidDate: paymentData.paidDate,
            transactionRef: paymentData.transactionRef,
          },
          req.user.id
        );

        res.json({
          message: contribution.status === ContributionStatus.PENDING
            ? 'Payment submitted and awaiting Treasurer approval'
            : 'Payment recorded successfully',
          contribution: {
            id: contribution.id,
            status: contribution.status,
            amount: contribution.amount,
            paidDate: contribution.paidDate,
            penalties: contribution.penalties,
          },
        });
        return;
      }

      if (!paymentData.phoneNumber) {
        throw new BadRequestError('Phone number is required for M-Pesa payments');
      }

      const chama = await prisma.chama.findUnique({
        where: { id: chamaId },
        select: {
          id: true,
          name: true,
          settings: true,
        },
      });

      if (!chama) {
        throw new BadRequestError('Chama not found');
      }

      const settings = (chama.settings as Record<string, any>) || {};
      const paymentSettings = settings.paymentSettings || {};

      if (paymentSettings.isEnabled === false) {
        throw new BadRequestError('This chama has disabled payment collection');
      }

      const accountReference =
        paymentData.accountReference ||
        paymentSettings.accountReference ||
        (paymentSettings.mode === 'PAYBILL' ? paymentSettings.accountNumber : undefined) ||
        chama.name.substring(0, 12);

      const transactionDesc =
        paymentData.transactionDesc ||
        paymentSettings.transactionDesc ||
        'Chama payment';

      const mpesaResult = await mpesaService.initiatePayment({
        contributionId: contributionTargetId,
        memberId: req.user.id,
        chamaId,
        amount: paymentData.amount,
        phoneNumber: paymentData.phoneNumber,
        accountReference,
        transactionDesc,
      });

      res.status(202).json({
        message: 'M-Pesa prompt sent. Complete payment on your phone.',
        contribution: {
          id: contributionTargetId,
          status: ContributionStatus.PENDING,
          amount: paymentData.amount,
        },
        mpesa: mpesaResult,
      });
      return;
    }

    const contribution = await ContributionService.recordPayment(
      {
        contributionId: contributionTargetId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod as any,
        paidDate: paymentData.paidDate,
        transactionRef: paymentData.transactionRef,
      },
      req.user.id
    );

    res.json({
      message: contribution.status === ContributionStatus.PENDING
        ? 'Payment submitted and awaiting Treasurer approval'
        : 'Payment recorded successfully',
      contribution: {
        id: contribution.id,
        status: contribution.status,
        amount: contribution.amount,
        paidDate: contribution.paidDate,
        penalties: contribution.penalties,
      },
    });
  })
);

/**
 * GET /contribution/chama/:chamaId/payment-requests
 * List pending payment approvals for chama leadership
 */
router.get('/chama/:chamaId/payment-requests',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const requests = await ContributionService.getPendingPaymentApprovals(chamaId, req.user.id);
    res.json({
      requests,
      count: requests.length,
    });
  })
);

/**
 * POST /contribution/payment-requests/:paymentRequestId/approve
 * Approve a pending member payment request
 */
router.post('/payment-requests/:paymentRequestId/approve',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { paymentRequestId } = approvePaymentRequestSchema.parse(req.params);
    const contribution = await ContributionService.approvePaymentRequest(paymentRequestId, req.user.id);

    res.json({
      message: 'Payment approved successfully',
      contribution: {
        id: contribution.id,
        status: contribution.status,
        amount: contribution.amount,
        paidDate: contribution.paidDate,
        penalties: contribution.penalties,
      },
    });
  })
);

/**
 * POST /contribution/payment/bulk
 * Bulk record payments (for M-Pesa reconciliation)
 * Requirements: 8.2, 8.5
 */
router.post('/payment/bulk',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const bulkData = bulkRecordPaymentSchema.parse(req.body);

    const result = await ContributionService.bulkRecordPayments(
      bulkData,
      req.user.id
    );

    // Audit log
    auditLog('CREATE', 'bulk-payment', req.user.id, {
      action: 'BULK_PAYMENTS_RECORDED',
      total: bulkData.payments.length,
      successful: result.successful.length,
      failed: result.failed.length,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Bulk payments recorded', {
      total: bulkData.payments.length,
      successful: result.successful.length,
      failed: result.failed.length,
      recordedBy: req.user.id,
    });

    res.json({
      message: 'Bulk payment processing completed',
      successful: result.successful,
      failed: result.failed,
      summary: {
        total: bulkData.payments.length,
        successful: result.successful.length,
        failed: result.failed.length,
      },
    });
  })
);

/**
 * POST /contribution/penalties/calculate
 * Calculate penalties for overdue contributions
 * Requirements: 8.3
 */
router.post('/penalties/calculate',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const penaltyData = calculatePenaltiesSchema.parse(req.body);

    const results = await ContributionService.calculatePenalties(
      penaltyData,
      req.user.id
    );

    // Audit log
    auditLog('UPDATE', penaltyData.chamaId || penaltyData.contributionId || 'unknown', req.user.id, {
      action: 'PENALTIES_CALCULATED',
      contributionCount: results.length,
      dryRun: penaltyData.dryRun,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Penalties calculated', {
      contributionCount: results.length,
      dryRun: penaltyData.dryRun,
      calculatedBy: req.user.id,
    });

    res.json({
      message: penaltyData.dryRun 
        ? 'Penalty calculation completed (dry run)' 
        : 'Penalties calculated and applied successfully',
      results,
      summary: {
        totalContributions: results.length,
        totalPenalties: results.reduce((sum, r) => sum + r.newPenalty, 0),
      },
    });
  })
);

/**
 * GET /contribution
 * Get contributions with filtering
 * Requirements: 8.1, 8.2
 */
router.get('/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const filters = getContributionsSchema.parse({
      chamaId: req.query.chamaId as string,
      memberId: req.query.memberId as string,
      status: req.query.status as any,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    const result = await ContributionService.getContributions(
      filters,
      req.user.id
    );

    res.json({
      contributions: result.contributions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  })
);

/**
 * GET /contribution/summary
 * Get contribution summary for a member or Chama
 * Requirements: 8.1, 8.2
 */
router.get('/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const summaryData = contributionSummarySchema.parse({
      chamaId: req.query.chamaId as string,
      memberId: req.query.memberId as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
    });

    const summary = await ContributionService.getContributionSummary(
      summaryData,
      req.user.id
    );

    res.json({
      summary,
      chamaId: summaryData.chamaId,
      memberId: summaryData.memberId,
    });
  })
);

/**
 * PUT /contribution/:contributionId
 * Update a contribution
 * Requirements: 8.1, 8.2
 */
router.put('/:contributionId',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'TREASURER'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { contributionId } = req.params;

    if (!contributionId) {
      throw new BadRequestError('Contribution ID is required');
    }

    const updateData = updateContributionSchema.parse(req.body);

    const contribution = await ContributionService.updateContribution(
      contributionId,
      updateData,
      req.user.id
    );

    // Audit log
    auditLog('UPDATE', contributionId, req.user.id, {
      action: 'CONTRIBUTION_UPDATED',
      changes: updateData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Contribution updated', {
      contributionId,
      updatedBy: req.user.id,
    });

    res.json({
      message: 'Contribution updated successfully',
      contribution,
    });
  })
);

/**
 * POST /contribution/currency/convert
 * Convert currency amount
 * Requirements: 8.4
 */
router.post('/currency/convert',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const conversionData = currencyConversionSchema.parse(req.body);

    const result = await ContributionService.convertCurrency(conversionData);

    logger.info('Currency conversion performed', {
      from: conversionData.fromCurrency,
      to: conversionData.toCurrency,
      amount: conversionData.amount,
      userId: req.user?.id,
    });

    res.json({
      conversion: result,
    });
  })
);

export { router as contributionRouter };



