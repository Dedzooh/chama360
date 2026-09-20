import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ContributionStatus, PaymentMethod, Prisma, TransactionStatus } from '@prisma/client';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { allocatePaidContribution, removeContributionAllocation } from '../../services/contributionAllocationService';
import { LedgerService } from '../../services/ledgerService';
export function registerContributionsRoutes(router: Router, context: any): void {
  const { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction } = context;
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


}
