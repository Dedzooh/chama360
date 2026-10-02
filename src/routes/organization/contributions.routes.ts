import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ContributionStatus, NotificationPriority, NotificationType, PaymentMethod, Prisma, TransactionStatus } from '@prisma/client';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { allocatePaidContribution, removeContributionAllocation } from '../../services/contributionAllocationService';
import { LedgerService } from '../../services/ledgerService';
import { parseMpesaStatementText, parseStatementCsv } from '../../utils/statementParser';
import { matchStatementToProofs } from '../../utils/statementMatching';
import { NotificationService } from '../../services/notificationService';
import { prisma } from '../../config/database';
export function registerContributionsRoutes(router: Router, context: any): void {
  const { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, paymentProofSubmitSchema, paymentProofDecisionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction } = context;
router.post(
  '/:id/contributions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can record contributions');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept new contributions');
    }

    const payload = contributionCreateSchema.parse(req.body);
    const linkedChamaId = currentOrganization.chama?.id;
    if (!linkedChamaId) throw new BadRequestError('Organization is not linked to an active Chama');
    const member = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: id, userId: payload.memberId } } });
    if (!member || member.status !== 'ACTIVE') throw new BadRequestError('Contribution member must be active in this Chama');
    const requestKey = payload.idempotencyKey || req.get('Idempotency-Key') || randomUUID();
    const ledgerKey = `organization:${id}:contribution:${requestKey}`;
    const existingTransaction = await db.transaction.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (existingTransaction) {
      const existingContribution = await db.contribution.findFirst({ where: { organizationId: id, transactionRef: existingTransaction.reference } });
      if (existingContribution) {
        res.status(200).json({ contribution: existingContribution, idempotentReplay: true });
        return;
      }
    }
    const paidAt = payload.status === 'PAID' ? (payload.paidAt ? new Date(payload.paidAt) : new Date()) : null;
    const settingsRules = currentOrganization.settings?.contributionRules as any;
    const savedRules = settingsRules && Object.keys(settingsRules).length ? settingsRules : (currentOrganization.metadata as any)?.contributionRules;
    const rawDueDay = Number(savedRules?.deadlineDay ?? savedRules?.dueDate?.slice(8, 10) ?? 10);
    const [periodYear = Number.NaN, periodMonth = Number.NaN] = (payload.period ?? '').split('-').map(Number);
    const dueDay = Number.isInteger(rawDueDay) ? Math.min(Math.max(rawDueDay, 1), 31) : 10;
    const dueDate = Number.isInteger(periodYear) && Number.isInteger(periodMonth) && periodMonth >= 1 && periodMonth <= 12
      ? new Date(Date.UTC(periodYear, periodMonth - 1, Math.min(dueDay, new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate())))
      : new Date();
    const contribution = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.contribution.create({ data: {
        chamaId: linkedChamaId, organizationId: id, memberId: payload.memberId, amount: payload.amount,
        contributionType: payload.contributionType, period: payload.period, paymentMethod: payload.paymentMethod as PaymentMethod,
        reference: payload.reference, recordedById: req.user!.id as string, status: payload.status as ContributionStatus,
        paidAt, paidDate: paidAt, dueDate,
      } });
      if (payload.status === 'PAID') {
        const reference = payload.reference || `CONTRIBUTION-${created.id}`;
        await tx.transaction.create({ data: { chamaId: linkedChamaId, organizationId: id, type: 'CONTRIBUTION', amount: payload.amount, fromMemberId: payload.memberId, reference, idempotencyKey: ledgerKey, status: TransactionStatus.COMPLETED, metadata: { contributionId: created.id, paymentMethod: payload.paymentMethod } } });
        await tx.contribution.update({ where: { id: created.id }, data: { transactionRef: reference, reference } });
        await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: payload.amount } } });
        await allocatePaidContribution(tx, { ...created, organizationId: id, status: 'PAID', period: payload.period });
      }
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'CREATE', entityType: 'Contribution', entityId: created.id, newValues: created, metadata: { idempotencyKey: ledgerKey } } });
      return tx.contribution.findUnique({ where: { id: created.id } });
    });

    if (payload.status === 'PAID') {
      const priorPaid = await db.contribution.count({ where: { organizationId: id, status: 'PAID', id: { not: contribution?.id } } });
      if (priorPaid === 0) await db.commercialFunnelEvent.create({ data: { eventType: 'FIRST_CONTRIBUTION', userId: req.user!.id, organizationId: id } });
    }

    res.status(201).json({ contribution });
  })
);

router.get(
  '/:id/contributions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    const contributionWhere = canViewAllFinancials(access)
      ? { organizationId: id }
      : { organizationId: id, memberId: req.user.id as string };

    const contributions = await db.contribution.findMany({
      where: contributionWhere,
      include: { member: true, recordedBy: true, reversedBy: true, allocations: { orderBy: { period: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ contributions });
  })
);

router.post(
  '/:id/contributions/:contributionId/reverse',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, contributionId } = req.params as { id: string; contributionId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can reverse contributions');
    }

    const payload = reverseContributionSchema.parse(req.body);
    const existing = await db.contribution.findUnique({
      where: { id: contributionId },
    });

    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Contribution not found');
    }

    if (existing.status === 'REVERSED') {
      throw new BadRequestError('Contribution has already been reversed');
    }

    const reversed = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.contribution.findUnique({ where: { id: contributionId } });
      if (!current || current.organizationId !== id) throw new NotFoundError('Contribution not found');
      if (current.status === 'REVERSED') throw new BadRequestError('Contribution has already been reversed');

      const claimed = await tx.contribution.updateMany({
        where: { id: contributionId, organizationId: id, status: { not: ContributionStatus.REVERSED } },
        data: { status: ContributionStatus.REVERSED, reverseReason: payload.reason, reversedAt: new Date(), reversedById: req.user!.id },
      });
      if (claimed.count !== 1) throw new BadRequestError('Contribution was already reversed by another request');
      const updated = await tx.contribution.findUniqueOrThrow({ where: { id: contributionId } });

      if (current.status === 'PAID') {
        await removeContributionAllocation(tx, current);
        const walletDebit = await tx.organizationWallet.updateMany({ where: { organizationId: id, balance: { gte: current.amount } }, data: { balance: { decrement: current.amount } } });
        if (walletDebit.count !== 1) throw new BadRequestError('Wallet balance is lower than this contribution; reconcile the ledger before reversing it');
        if (current.transactionRef) await tx.transaction.updateMany({ where: { organizationId: id, reference: current.transactionRef, type: 'CONTRIBUTION', status: TransactionStatus.COMPLETED }, data: { status: TransactionStatus.REVERSED } });
      }
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: current, newValues: updated, metadata: { reverseReason: payload.reason } } });
      return updated;
    });

    res.json({ contribution: reversed });
  })
);

router.get(
  '/:id/contributions/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    const contributionWhere = canViewAllFinancials(access)
      ? { organizationId: id }
      : { organizationId: id, memberId: req.user.id as string };

    const [total, paid, pending, reversed] = await Promise.all([
      db.contribution.count({ where: contributionWhere }),
      db.contribution.count({ where: { ...contributionWhere, status: 'PAID' } }),
      db.contribution.count({ where: { ...contributionWhere, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } }),
      db.contribution.count({ where: { ...contributionWhere, status: 'REVERSED' } }),
    ]);

    const credit = await db.contributionCredit.findUnique({ where: { organizationId_memberId: { organizationId: id, memberId: req.user.id as string } } });
    res.json({ total, paid, pending, reversed, creditBalance: Number(credit?.balance ?? 0) });
  })
);


router.post('/:id/contributions/:contributionId/mark-paid', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, contributionId } = req.params as { id: string; contributionId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!isFinanceManager(access)) throw new ForbiddenError('Only Treasurer or Admin can mark contributions as paid');
  const payload = markContributionPaidSchema.parse(req.body);
  const existing = await db.contribution.findUnique({ where: { id: contributionId } });
  if (!existing || existing.organizationId !== id) throw new NotFoundError('Contribution not found');
  if (existing.status === 'PAID') throw new BadRequestError('Contribution is already marked as paid');
  if (existing.status === 'REVERSED') throw new BadRequestError('A reversed contribution cannot be marked as paid');
  const currentOrganization = await requireOrganizationStatus(id);
  if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') throw new ForbiddenError('Closed organizations cannot accept contributions');
  const linkedChamaId = currentOrganization.chama?.id;
  if (!linkedChamaId) throw new BadRequestError('Organization is not linked to an active Chama');
  const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
  const contribution = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
    const reference = payload.reference || `CONTRIBUTION-${contributionId}`;
    const updated = await tx.contribution.update({ where: { id: contributionId }, data: { status: ContributionStatus.PAID, paymentMethod: payload.paymentMethod as PaymentMethod, reference, transactionRef: reference, paidAt, paidDate: paidAt, recordedById: req.user!.id } });
    await allocatePaidContribution(tx, updated);
    await LedgerService.recordContributionPayment(
      tx,
      {
        organizationId: id,
        chamaId: linkedChamaId,
        fromMemberId: existing.memberId,
        amount: Number(existing.amount),
        reference,
        idempotencyKey: `organization:${id}:contribution:${contributionId}:mark-paid`,
        status: 'COMPLETED',
        metadata: { contributionId, paymentMethod: payload.paymentMethod, manualMarkPaid: true },
      }
    );
    await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: existing.amount } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { operation: 'MANUAL_MARK_PAID', paymentMethod: payload.paymentMethod } } });
    return updated;
  });
  res.json({ contribution, message: 'Member contribution marked as paid.' });
}));

/**
 * Member payment-proof flow
 *
 * A member who has paid by M-Pesa (to the treasurer's personal number), bank
 * transfer, or cash submits proof here instead of messaging the treasurer on
 * WhatsApp. The proof lands in the finance queue as a PENDING transaction with
 * paymentApproval metadata; the treasurer approves or rejects it, and approval
 * settles the contribution exactly like a manual mark-paid.
 */

const notifyFinanceRoles = async (organizationId: string, title: string, message: string) => {
  const service = new NotificationService(prisma);
  const financeMembers = await prisma.organizationMember.findMany({
    where: { organizationId, status: 'ACTIVE', role: { in: ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'] as any } } as any,
    select: { userId: true },
  });
  for (const member of financeMembers) {
    try {
      await service.createNotification({
        recipientId: member.userId,
        type: NotificationType.GENERAL_UPDATE,
        priority: NotificationPriority.IMPORTANT,
        title,
        message,
        channels: [{ type: 'IN_APP', address: member.userId }],
      } as any);
    } catch (error) {
      // Notification failures must not break the payment flow
      console.error('[payment-proof] notification failed', error);
    }
  }
};

const notifyMemberContributionPaid = async (memberId: string) => {
  const member = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) return;
  try {
    await new NotificationService(prisma).createNotification({
        recipientId: member.id,
        type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.INFO,
      title: 'Payment confirmed',
      message: 'Your payment proof was approved and your contribution is now marked as paid.',
        channels: [{ type: 'IN_APP', address: member.id }],
    } as any);
  } catch (error) {
    console.error('[payment-proof] member notification failed', error);
  }
};

const canApprovePayments = (access: any): boolean => {
  const role = String(access?.role ?? access ?? '').toUpperCase();
  return ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'].includes(role);
};

// List pending payment proofs for the finance queue
router.get('/:id/contributions/payment-proofs', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!canApprovePayments(access)) throw new ForbiddenError('Only finance roles can view payment proofs');

  const proofs = await db.transaction.findMany({
    where: {
      organizationId: id,
      type: 'CONTRIBUTION',
      status: TransactionStatus.PENDING,
      metadata: { path: ['paymentProof', 'status'], equals: 'PENDING' },
    },
    include: { fromMember: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    proofs: proofs.map((proof: any) => {
      const metadata = (proof.metadata as any) ?? {};
      return {
        id: proof.id,
        contributionId: metadata.contributionId,
        amount: Number(proof.amount),
        paymentMethod: metadata.paymentMethod ?? 'UNKNOWN',
        reference: metadata.reference,
        paidAt: metadata.paidAt,
        note: metadata.note,
        submittedAt: proof.createdAt,
        member: proof.fromMember,
      };
    }),
  });
}));

// Member submits payment proof
router.post('/:id/contributions/:contributionId/payment-proof', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, contributionId } = req.params as { id: string; contributionId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!access) throw new ForbiddenError('You are not a member of this Chama');

  const payload = paymentProofSubmitSchema.parse(req.body);
  const contribution = await db.contribution.findUnique({ where: { id: contributionId } });
  if (!contribution || contribution.organizationId !== id) throw new NotFoundError('Contribution not found');
  if (contribution.memberId !== req.user.id) throw new ForbiddenError('You can only submit payment proof for your own contributions');
  if (contribution.status === 'PAID') throw new BadRequestError('This contribution is already marked as paid');
  if (contribution.status === 'REVERSED') throw new BadRequestError('This contribution was reversed and cannot be paid');

  const existingProof = await db.transaction.findFirst({
    where: {
      organizationId: id,
      fromMemberId: req.user.id,
      type: 'CONTRIBUTION',
      status: TransactionStatus.PENDING,
      metadata: { path: ['paymentProof', 'status'], equals: 'PENDING' },
    },
  });
  if (existingProof) throw new BadRequestError('You already have a payment awaiting confirmation');

  const proof = await db.transaction.create({
    data: {
      organizationId: id,
      chamaId: contribution.chamaId,
      type: 'CONTRIBUTION',
      amount: payload.amount ?? contribution.amount,
      fromMemberId: req.user.id,
      reference: `PROOF-${contributionId}-${Date.now()}`,
      idempotencyKey: `proof:${id}:${contributionId}:${req.user.id}:${randomUUID()}`,
      status: TransactionStatus.PENDING,
      metadata: {
        contributionId,
        paymentMethod: payload.paymentMethod,
        reference: payload.reference,
        paidAt: payload.paidAt,
        note: payload.note,
        paymentProof: { status: 'PENDING', submittedAt: new Date().toISOString() },
      },
    },
  });

  await notifyFinanceRoles(
    id,
    'Payment proof submitted',
    `${(req.user as any).name ?? 'A member'} submitted payment proof for ${contribution.period ?? 'a contribution'}. Review it in Approvals → Payments.`
  );

  res.status(201).json({ proof: { id: proof.id, status: proof.status }, message: 'Payment proof submitted. The treasurer will confirm it shortly.' });
}));

// Treasurer approves a payment proof: settles the contribution like mark-paid
router.post('/:id/contributions/payment-proofs/:proofId/approve', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, proofId } = req.params as { id: string; proofId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!canApprovePayments(access)) throw new ForbiddenError('Only finance roles can approve payment proofs');

  const proof = await db.transaction.findUnique({ where: { id: proofId } });
  if (!proof || proof.organizationId !== id) throw new NotFoundError('Payment proof not found');
  const metadata = (proof.metadata as any) ?? {};
  if (metadata.paymentProof?.status !== 'PENDING') throw new BadRequestError('This payment proof is not pending review');
  const contributionId = metadata.contributionId as string | undefined;
  if (!contributionId) throw new BadRequestError('Payment proof is missing a contribution reference');

  const contribution = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.contribution.findUnique({ where: { id: contributionId } });
    if (!existing || existing.organizationId !== id) throw new NotFoundError('Contribution not found');
    if (existing.status === 'PAID') throw new BadRequestError('This contribution is already paid');
    if (existing.status === 'REVERSED') throw new BadRequestError('This contribution was reversed');

    const reference = metadata.reference || proof.reference;
    const paidAt = metadata.paidAt ? new Date(metadata.paidAt) : new Date();
    const updated = await tx.contribution.update({
      where: { id: contributionId },
      data: { status: ContributionStatus.PAID, paymentMethod: metadata.paymentMethod as PaymentMethod, reference, transactionRef: reference, paidAt, paidDate: paidAt, recordedById: req.user!.id },
    });
    await allocatePaidContribution(tx, updated);
    await LedgerService.recordContributionPayment(tx, {
      organizationId: id,
      chamaId: existing.chamaId,
      fromMemberId: existing.memberId,
      amount: Number(existing.amount),
      reference,
      idempotencyKey: `organization:${id}:contribution:${contributionId}:proof:${proofId}`,
      status: 'COMPLETED',
      metadata: { contributionId, paymentMethod: metadata.paymentMethod, approvedProofId: proofId, approvedBy: req.user!.id },
    });
    await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: existing.amount } } });
    await tx.transaction.update({ where: { id: proofId }, data: { status: TransactionStatus.COMPLETED, metadata: { ...metadata, paymentProof: { ...metadata.paymentProof, status: 'APPROVED', approvedBy: req.user!.id, approvedAt: new Date().toISOString() } } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { operation: 'PAYMENT_PROOF_APPROVED', proofId } } });
    return updated;
  });

  await notifyMemberContributionPaid(contribution.memberId);
  res.json({ contribution, message: 'Payment proof approved and contribution marked as paid.' });
}));

// Treasurer rejects a payment proof
router.post('/:id/contributions/payment-proofs/:proofId/reject', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, proofId } = req.params as { id: string; proofId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!canApprovePayments(access)) throw new ForbiddenError('Only finance roles can reject payment proofs');

  const payload = paymentProofDecisionSchema.parse(req.body);
  const proof = await db.transaction.findUnique({ where: { id: proofId } });
  if (!proof || proof.organizationId !== id) throw new NotFoundError('Payment proof not found');
  const metadata = (proof.metadata as any) ?? {};
  if (metadata.paymentProof?.status !== 'PENDING') throw new BadRequestError('This payment proof is not pending review');

  await db.transaction.update({
    where: { id: proofId },
    data: {
      status: TransactionStatus.REVERSED,
      metadata: { ...metadata, paymentProof: { ...metadata.paymentProof, status: 'REJECTED', rejectedBy: req.user!.id, rejectedAt: new Date().toISOString(), reason: payload.reason } },
    },
  });
  await db.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Transaction', entityId: proofId, metadata: { operation: 'PAYMENT_PROOF_REJECTED', reason: payload.reason } } });

  res.json({ message: 'Payment proof rejected.' });
}));

// ---- Statement reconciliation -------------------------------------------
// Treasurer pastes/uploads their M-Pesa or bank statement; the system parses
// rows, auto-matches pending payment proofs, and (in apply mode) approves the
// matched proofs through the same settlement path as manual approval.

const approveProofInternal = async (organizationId: string, proofId: string, approverId: string, statementReference?: string) => {
  const proof = await db.transaction.findUnique({ where: { id: proofId } });
  if (!proof || proof.organizationId !== organizationId) throw new NotFoundError('Payment proof not found');
  const metadata = (proof.metadata as any) ?? {};
  if (metadata.paymentProof?.status !== 'PENDING') throw new BadRequestError('This payment proof is not pending review');
  const contributionId = metadata.contributionId as string | undefined;
  if (!contributionId) throw new BadRequestError('Payment proof is missing a contribution reference');

  const contribution = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.contribution.findUnique({ where: { id: contributionId } });
    if (!existing || existing.organizationId !== organizationId) throw new NotFoundError('Contribution not found');
    if (['PAID', 'REVERSED'].includes(existing.status)) throw new BadRequestError('This contribution is already settled');

    const reference = statementReference || metadata.reference || proof.reference;
    const paidAt = metadata.paidAt ? new Date(metadata.paidAt) : new Date();
    const updated = await tx.contribution.update({
      where: { id: contributionId },
      data: { status: ContributionStatus.PAID, paymentMethod: metadata.paymentMethod as PaymentMethod, reference, transactionRef: reference, paidAt, paidDate: paidAt, recordedById: approverId },
    });
    await allocatePaidContribution(tx, updated);
    await LedgerService.recordContributionPayment(tx, {
      organizationId,
      chamaId: existing.chamaId,
      fromMemberId: existing.memberId,
      amount: Number(existing.amount),
      reference,
      idempotencyKey: `organization:${organizationId}:contribution:${contributionId}:proof:${proofId}`,
      status: 'COMPLETED',
      metadata: { contributionId, paymentMethod: metadata.paymentMethod, approvedProofId: proofId, approvedBy: approverId, reconciledFromStatement: true },
    });
    await tx.organizationWallet.update({ where: { organizationId }, data: { balance: { increment: existing.amount } } });
    await tx.transaction.update({ where: { id: proofId }, data: { status: TransactionStatus.COMPLETED, metadata: { ...metadata, paymentProof: { ...metadata.paymentProof, status: 'APPROVED', approvedBy: approverId, approvedAt: new Date().toISOString(), statementMatch: statementReference ?? null } } } });
    await tx.organizationAuditLog.create({ data: { organizationId, userId: approverId, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { operation: 'PAYMENT_PROOF_APPROVED', proofId, reconciledFromStatement: true } } });
    return updated;
  });

  await notifyMemberContributionPaid(contribution.memberId);
};

router.post('/:id/contributions/payment-proofs/reconcile', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!canApprovePayments(access)) throw new ForbiddenError('Only finance roles can reconcile statements');

  const { statement, format = 'auto', mode = 'preview' } = (req.body ?? {}) as { statement?: string; format?: 'auto' | 'mpesa' | 'csv'; mode?: 'preview' | 'apply' };
  if (!statement || typeof statement !== 'string' || statement.trim().length < 10) {
    throw new BadRequestError('Provide the statement text or CSV content to reconcile');
  }

  const rows = format === 'csv' ? parseStatementCsv(statement)
    : format === 'mpesa' ? parseMpesaStatementText(statement)
    : [...parseMpesaStatementText(statement), ...parseStatementCsv(statement)];
  if (!rows.length) throw new BadRequestError('Could not find any payment rows in the statement. Check the format and try again.');

  const pendingProofs = await db.transaction.findMany({
    where: {
      organizationId: id,
      type: 'CONTRIBUTION',
      status: TransactionStatus.PENDING,
      metadata: { path: ['paymentProof', 'status'], equals: 'PENDING' },
    },
    include: { fromMember: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const proofInputs = pendingProofs.map((proof: any) => {
    const metadata = (proof.metadata as any) ?? {};
    return {
      id: proof.id,
      amount: Number(proof.amount),
      reference: metadata.reference ?? null,
      paidAt: metadata.paidAt ?? null,
      label: `${proof.fromMember?.firstName ?? 'Member'} ${proof.fromMember?.lastName ?? ''}`.trim(),
    };
  });
  const { matches } = matchStatementToProofs(rows, proofInputs);
  const matchedRowIndexes = new Set(matches.map((match) => match.rowIndex));

  if (mode === 'apply') {
    let approved = 0;
    for (const match of matches) {
      try {
        await approveProofInternal(id, match.proofId, req.user.id, match.row.reference ?? undefined);
        approved += 1;
      } catch (error) {
        console.error('[reconcile] failed to apply match', match.proofId, error);
      }
    }
    return res.json({ rows: rows.length, matched: matches.length, approved, mode });
  }

  return res.json({
    rows: rows.length,
    matched: matches.length,
    matches: matches.map((match) => ({ proofId: match.proofId, confidence: match.confidence, row: match.row, rowIndex: match.rowIndex })),
    unmatchedRows: rows.filter((_, index) => !matchedRowIndexes.has(index)),
  });
}));


}
