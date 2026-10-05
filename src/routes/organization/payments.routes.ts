import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ContributionStatus, PaymentAllocationKind, TransactionStatus } from '@prisma/client';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError } from '../../middleware/errorHandler';
import { recordPaymentWithAllocations, reversePayment } from '../../services/paymentAllocationService';
import { LedgerService } from '../../services/ledgerService';

// Contribution payments. This router handles the Chama's own money only —
// never the Chama360 platform subscription (that is /api/v1/subscriptions).
//
// Key concept enforced here: PAYER ≠ BENEFICIARY.
//   payerUserId    = who physically sent the money (required)
//   allocations[]  = whose obligation each portion settles (one or many)
// A member can pay for themselves, for another member, or for several members
// in one transaction. Leftover money is never silently assigned: it becomes an
// explicit CREDIT (if autoCredit) or UNALLOCATED allocation for review.

const paymentCreateSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  payerUserId: z.string().cuid().optional(), // defaults to the authenticated user
  paymentMethod: z.enum(['MPESA', 'BANK', 'CASH']).optional(),
  paymentMethodId: z.string().cuid().optional(),
  transactionReference: z.string().trim().max(40).optional(),
  paidAt: z.string().datetime().optional(),
  autoCredit: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
  allocations: z.array(z.object({
    memberId: z.string().cuid(),
    amount: z.number().positive(),
    contributionId: z.string().cuid().optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    contributionType: z.string().trim().max(40).optional(),
  })).min(1).max(50),
});

const outstandingSchema = z.object({
  memberId: z.string().cuid().optional(),
});

type RouteContext = {
  db: any;
  getOrganizationAccess: (organizationId: string, userId: string) => Promise<any>;
  canViewAllFinancials: (access: any) => boolean;
  isFinanceManager: (access: any) => boolean;
  requireOrganizationStatus: (organizationId: string) => Promise<any>;
  runFinancialTransaction: (fn: (tx: any) => Promise<any>) => Promise<any>;
  writeOrganizationAudit: (params: { organizationId: string; userId: string; action: 'CREATE' | 'UPDATE'; entityType: string; entityId: string; oldValues?: unknown; newValues?: unknown; metadata?: Record<string, unknown> }) => Promise<unknown>;
};

export function registerPaymentsRoutes(router: Router, context: RouteContext): void {
  const { db, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit } = context;

  // Outstanding obligations per member — the data behind "who are you paying
  // for?" and the Treasurer's uncertain-allocation review queue.
  router.get('/:id/payments/outstanding', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const query = outstandingSchema.parse(req.query ?? {});
    const restrictToMember = !canViewAllFinancials(access) || query.memberId;
    const memberId = restrictToMember ? (query.memberId ?? req.user.id) : undefined;
    if (restrictToMember && memberId !== req.user.id && !canViewAllFinancials(access)) {
      throw new ForbiddenError('You can only view your own outstanding contributions.');
    }
    const contributions = await db.contribution.findMany({
      where: {
        organizationId: id,
        status: { in: [ContributionStatus.PENDING, ContributionStatus.PARTIAL, ContributionStatus.OVERDUE] },
        ...(memberId ? { memberId } : {}),
      },
      include: { member: { select: { id: true, firstName: true, lastName: true } }, paymentAllocations: { where: { kind: PaymentAllocationKind.CONTRIBUTION }, include: { payment: { select: { status: true } } } } },
      orderBy: [{ period: 'asc' }, { dueDate: 'asc' }],
      take: 500,
    });
    const outstanding = contributions
      .filter((contribution: any) => contribution.paymentAllocations.every((allocation: any) => allocation.payment?.status === 'COMPLETED' || allocation.payment?.status === 'PENDING'))
      .map((contribution: any) => {
        const settled = contribution.paymentAllocations.reduce((sum: number, allocation: any) => sum + Number(allocation.amount), 0);
        const due = Math.max(0, Number(contribution.amount) + Number(contribution.penalties ?? 0) - settled);
        return {
          contributionId: contribution.id,
          memberId: contribution.memberId,
          memberName: `${contribution.member.firstName} ${contribution.member.lastName}`.trim(),
          period: contribution.period,
          contributionType: contribution.contributionType,
          amount: Number(contribution.amount),
          penalties: Number(contribution.penalties ?? 0),
          paid: settled,
          due: Number(due.toFixed(2)),
          status: contribution.status,
        };
      })
      .filter((item: any) => item.due > 0);
    res.json({ outstanding });
  }));

  // Record a payment with explicit payer + beneficiary allocations.
  router.post('/:id/payments', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept payments');
    }
    const payload = paymentCreateSchema.parse(req.body);
    // Payer default: the authenticated member paying for themselves. A member
    // may also declare they are paying for another member; finance officials
    // may record payments on behalf of any payer.
    const payerUserId = payload.payerUserId ?? req.user!.id;
    const payingForOthers = payload.allocations.some((allocation) => allocation.memberId !== req.user!.id);
    if (payingForOthers && payerUserId !== req.user!.id && !isFinanceManager(access)) {
      throw new ForbiddenError('Only a Treasurer or Admin can record a payment on behalf of another payer.');
    }

    const result = await runFinancialTransaction(async (tx: any) => {
      const paymentResult = await recordPaymentWithAllocations(tx, {
        organizationId: id,
        chamaId: currentOrganization.chama?.id ?? null,
        payerUserId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        paymentMethodId: payload.paymentMethodId,
        transactionReference: payload.transactionReference,
        paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
        recordedById: req.user!.id,
        allocations: payload.allocations,
        status: 'COMPLETED',
        note: payload.note,
      }, { autoCredit: payload.autoCredit ?? false });

      // Mirror the payment into the ledger and wallet (same invariants as the
      // existing contribution recording path).
      await LedgerService.recordContributionPayment(
        tx,
        {
          organizationId: id,
          chamaId: currentOrganization.chama?.id,
          fromMemberId: payerUserId,
          amount: payload.amount,
          reference: payload.transactionReference || `PAYMENT-${paymentResult.payment.id}`,
          idempotencyKey: `organization:${id}:payment:${paymentResult.payment.id}`,
          status: 'COMPLETED' as TransactionStatus,
          metadata: {
            paymentId: paymentResult.payment.id,
            paymentMethod: payload.paymentMethod,
            payerUserId,
            allocationCount: payload.allocations.length,
          },
        },
      );
      await tx.organizationWallet.upsert({
        where: { organizationId: id },
        create: { organizationId: id, balance: payload.amount, currency: 'KES' },
        update: { balance: { increment: payload.amount } },
      });
      await writeOrganizationAudit({
        organizationId: id,
        userId: req.user!.id,
        action: 'CREATE',
        entityType: 'ContributionPayment',
        entityId: paymentResult.payment.id,
        newValues: paymentResult,
        metadata: {
          operation: 'PAYMENT_RECORDED',
          payerUserId,
          beneficiaryMemberIds: [...new Set(payload.allocations.map((allocation) => allocation.memberId))],
          transactionReference: payload.transactionReference ?? null,
        },
      });
      return paymentResult;
    });

    res.status(201).json({ ...result, message: 'Payment recorded with its allocations.' });
  }));

  // Payments made by the authenticated user (or all payments for finance roles).
  router.get('/:id/payments', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const seeAll = canViewAllFinancials(access);
    const payments = await db.contributionPayment.findMany({
      where: { organizationId: id, ...(seeAll ? {} : { payerUserId: req.user.id }) },
      include: {
        payer: { select: { id: true, firstName: true, lastName: true } },
        paymentMethodRef: { select: { id: true, label: true, channelType: true } },
        allocations: {
          include: { member: { select: { id: true, firstName: true, lastName: true } }, contribution: { select: { id: true, period: true, contributionType: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ payments });
  }));

  // Payments made FOR a member (transparency: "Paid by John Kimani").
  router.get('/:id/payments/for-member/:memberId', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, memberId } = req.params as { id: string; memberId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (memberId !== req.user.id && !canViewAllFinancials(access)) {
      throw new ForbiddenError('You can only view payments made for you.');
    }
    const payments = await db.contributionPayment.findMany({
      where: { organizationId: id, allocations: { some: { memberId } } },
      include: {
        payer: { select: { id: true, firstName: true, lastName: true } },
        allocations: { where: { memberId }, include: { contribution: { select: { id: true, period: true, contributionType: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ payments });
  }));

  // Reverse a payment (finance officials only).
  router.post('/:id/payments/:paymentId/reverse', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, paymentId } = req.params as { id: string; paymentId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) throw new ForbiddenError('Only the Treasurer or Admin can reverse payments');
    const payload = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body ?? {});
    const result = await runFinancialTransaction(async (tx: any) => reversePayment(tx, paymentId, id, req.user!.id, payload.reason));
    res.json({ payment: { id: paymentId, status: result.status }, message: 'Payment reversed and allocations released.' });
  }));

  // Payments that arrived but could not be matched — the Treasurer's review
  // queue ("possible allocation needs confirmation").
  router.get('/:id/payments/unallocated', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) throw new ForbiddenError('Only the Treasurer or Admin can review unallocated payments');
    const payments = await db.contributionPayment.findMany({
      where: { organizationId: id, allocations: { some: { kind: { in: [PaymentAllocationKind.UNALLOCATED, PaymentAllocationKind.CREDIT] } } } },
      include: {
        payer: { select: { id: true, firstName: true, lastName: true } },
        allocations: { where: { kind: { in: [PaymentAllocationKind.UNALLOCATED, PaymentAllocationKind.CREDIT] } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ payments });
  }));
}
