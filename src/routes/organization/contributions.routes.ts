import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ContributionStatus, PaymentMethod, Prisma, TransactionStatus } from '@prisma/client';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { allocatePaidContribution, removeContributionAllocation } from '../../services/contributionAllocationService';
import { LedgerService } from '../../services/ledgerService';
export function registerContributionsRoutes(router: Router, context: any): void {
  const { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, submitContributionPaymentSchema, reviewContributionPaymentSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction } = context;
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
    const currentOrganization = await requireOrganizationStatus(id);
    const contributionWhere = canViewAllFinancials(access)
      ? { organizationId: id }
      : { organizationId: id, memberId: req.user.id as string };

    const contributions = await db.contribution.findMany({
      where: contributionWhere,
      include: { member: true, recordedBy: true, reversedBy: true, allocations: { orderBy: { period: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const contributionIds = contributions.map((contribution: any) => contribution.id);
    const transactions = contributionIds.length ? await db.transaction.findMany({
      where: {
        OR: [{ organizationId: id }, ...(currentOrganization.chama?.id ? [{ chamaId: currentOrganization.chama.id }] : [])],
        type: 'CONTRIBUTION',
        fromMemberId: { in: [...new Set(contributions.map((contribution: any) => contribution.memberId))] },
        NOT: { reference: { startsWith: 'CONTRIB-PENDING-' } },
        status: { in: ['PENDING', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED'] },
      },
      select: { id: true, amount: true, reference: true, status: true, createdAt: true, metadata: true },
      orderBy: { createdAt: 'desc' },
    }) : [];
    const contributionSet = new Set(contributionIds);
    const paymentsByContribution = new Map<string, any[]>();
    for (const transaction of transactions) {
      const metadata = transaction.metadata as any;
      const contributionId = metadata?.contributionId;
      if (!contributionSet.has(contributionId)) continue;
      const payments = paymentsByContribution.get(contributionId) ?? [];
      payments.push({
        id: transaction.id,
        amount: Number(transaction.amount),
        status: transaction.status,
        reference: transaction.reference,
        receiptNumber: metadata?.mpesaReceiptNumber ?? metadata?.transactionRef ?? null,
        paymentMethod: metadata?.paymentMethod ?? null,
        recordedAt: transaction.createdAt,
        matchStatus: metadata?.paymentApproval?.status === 'PENDING' ? 'AWAITING_CONFIRMATION'
          : metadata?.paymentApproval?.status === 'REJECTED' ? 'REJECTED'
          : transaction.status === 'COMPLETED'
          ? (metadata?.mpesaReceiptNumber ? 'MATCHED' : 'RECORDED')
          : transaction.status === 'RECONCILIATION_REQUIRED' ? 'NEEDS_REVIEW'
          : transaction.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
        submittedAt: metadata?.paymentApproval?.submittedAt ?? null,
        reviewedAt: metadata?.paymentApproval?.reviewedAt ?? null,
        reviewNote: metadata?.paymentApproval?.reviewNote ?? null,
      });
      paymentsByContribution.set(contributionId, payments);
    }
    const enrichedContributions = contributions.map((contribution: any) => ({
      ...contribution,
      payments: paymentsByContribution.get(contribution.id) ?? [],
    }));
    res.json({ contributions: enrichedContributions });
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
    const currentOrganization = await requireOrganizationStatus(id);
    const contributionWhere = canViewAllFinancials(access)
      ? { organizationId: id }
      : { organizationId: id, memberId: req.user.id as string };

    const [total, paid, pending, reversed, activeContributions] = await Promise.all([
      db.contribution.count({ where: contributionWhere }),
      db.contribution.count({ where: { ...contributionWhere, status: 'PAID' } }),
      db.contribution.count({ where: { ...contributionWhere, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } } }),
      db.contribution.count({ where: { ...contributionWhere, status: 'REVERSED' } }),
      db.contribution.findMany({ where: contributionWhere, select: { id: true, memberId: true, amount: true, penalties: true, status: true } }),
    ]);

    const credit = await db.contributionCredit.findUnique({ where: { organizationId_memberId: { organizationId: id, memberId: req.user.id as string } } });
    const memberPayments = activeContributions.length ? await db.transaction.findMany({ where: { OR: [{ organizationId: id }, ...(currentOrganization.chama?.id ? [{ chamaId: currentOrganization.chama.id }] : [])], fromMemberId: req.user.id as string, type: 'CONTRIBUTION', status: 'COMPLETED', NOT: { reference: { startsWith: 'CONTRIB-PENDING-' } } }, select: { amount: true, metadata: true } }) : [];
    const memberPaidByContribution = new Map<string, number>();
    for (const payment of memberPayments) {
      const metadata = payment.metadata as any;
      if (!metadata?.contributionId) continue;
      memberPaidByContribution.set(metadata.contributionId, (memberPaidByContribution.get(metadata.contributionId) ?? 0) + Number(payment.amount));
    }
    const outstandingAmount = activeContributions.reduce((sum: number, contribution: any) => {
      if (contribution.status === 'REVERSED') return sum;
      const paidAmount = memberPaidByContribution.get(contribution.id) ?? (contribution.status === 'PAID' ? Number(contribution.amount) : 0);
      return sum + Math.max(0, Number(contribution.amount) + Number(contribution.penalties ?? 0) - paidAmount);
    }, 0);
    res.json({ total, paid, pending, reversed, creditBalance: Number(credit?.balance ?? 0), outstandingAmount });
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
    const amountReceived = Number(existing.amount) + Number(existing.penalties ?? 0);
    const updated = await tx.contribution.update({ where: { id: contributionId }, data: { status: ContributionStatus.PAID, paymentMethod: payload.paymentMethod as PaymentMethod, reference, transactionRef: reference, paidAt, paidDate: paidAt, recordedById: req.user!.id } });
    await allocatePaidContribution(tx, updated);
    await LedgerService.recordContributionPayment(
      tx,
      {
        organizationId: id,
        chamaId: linkedChamaId,
        fromMemberId: existing.memberId,
        amount: amountReceived,
        reference,
        idempotencyKey: `organization:${id}:contribution:${contributionId}:mark-paid`,
        status: 'COMPLETED',
        metadata: { contributionId, paymentMethod: payload.paymentMethod, manualMarkPaid: true },
      }
    );
    await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: amountReceived } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { operation: 'MANUAL_MARK_PAID', paymentMethod: payload.paymentMethod } } });
    return updated;
  });
  res.json({ contribution, message: 'Member contribution marked as paid.' });
}));

router.post('/:id/contributions/:contributionId/payment-submissions', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, contributionId } = req.params as { id: string; contributionId: string };
  await getOrganizationAccess(id, req.user.id);
  const payload = submitContributionPaymentSchema.parse(req.body);
  const contribution = await db.contribution.findFirst({ where: { id: contributionId, organizationId: id } });
  if (!contribution || contribution.memberId !== req.user.id) throw new NotFoundError('Your contribution was not found');
  if (['PAID', 'REVERSED'].includes(contribution.status)) throw new BadRequestError('This contribution has no payment due');
  const currentOrganization = await requireOrganizationStatus(id);
  if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') throw new ForbiddenError('Closed organizations cannot accept contributions');
  const pendingSubmission = await db.transaction.findFirst({ where: { organizationId: id, type: 'CONTRIBUTION', fromMemberId: req.user.id, status: 'PENDING', metadata: { path: ['contributionId'], equals: contributionId } }, select: { id: true, metadata: true } });
  if (pendingSubmission) throw new BadRequestError((pendingSubmission.metadata as any)?.paymentApproval?.status === 'PENDING' ? 'You already have a payment waiting for the Treasurer to check.' : 'An M-Pesa payment is still being confirmed. Wait for the result before sending another payment report.');
  const [completed, linkedChama] = await Promise.all([
    db.transaction.aggregate({ where: { organizationId: id, type: 'CONTRIBUTION', fromMemberId: req.user.id, status: 'COMPLETED', metadata: { path: ['contributionId'], equals: contributionId } }, _sum: { amount: true } }),
    db.chama.findUnique({ where: { id: contribution.chamaId }, select: { id: true } }),
  ]);
  if (!linkedChama) throw new BadRequestError('This Chama is not ready to record payments');
  const remaining = Math.max(0, Number(contribution.amount) + Number(contribution.penalties ?? 0) - Number(completed._sum.amount ?? 0));
  if (payload.amount > remaining + 0.001) throw new BadRequestError(`This payment is more than the amount still due (${remaining.toFixed(2)} KES).`);

  const submittedAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
  const receipt = payload.reference.trim().toUpperCase();
  const reportedMpesaTransaction = payload.paymentMethod === 'MPESA'
    ? await db.transaction.findUnique({ where: { idempotencyKey: `C2B:${receipt}` } })
    : null;
  const reportedMpesaMetadata = reportedMpesaTransaction?.metadata as any;
  const reportingPhone = payload.paymentMethod === 'MPESA'
    ? (await db.user.findUnique({ where: { id: req.user.id }, select: { phone: true } }))?.phone
    : null;
  const normalizePhone = (phone: string | null | undefined) => {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return digits.startsWith('0') ? `254${digits.slice(1)}` : digits.startsWith('254') ? digits : digits.length === 9 ? `254${digits}` : digits;
  };
  const statementReceiptMatches = Boolean(
    reportedMpesaTransaction
    && reportedMpesaTransaction.organizationId === id
    && reportedMpesaTransaction.status === TransactionStatus.RECONCILIATION_REQUIRED
    && reportedMpesaMetadata?.source === 'C2B_PAYBILL'
    && reportedMpesaMetadata?.reconciliationRequired === true
    && String(reportedMpesaMetadata?.mpesaReceiptNumber ?? '').toUpperCase() === receipt
    && Math.round(Number(reportedMpesaTransaction.amount) * 100) === Math.round(payload.amount * 100)
    && (reportedMpesaTransaction.fromMemberId === req.user.id
      || Boolean(reportingPhone && normalizePhone(reportingPhone) === normalizePhone(reportedMpesaMetadata?.phoneNumber)))
  );
  if (reportedMpesaTransaction?.organizationId === id && reportedMpesaMetadata?.source === 'C2B_PAYBILL' && reportedMpesaTransaction.status === TransactionStatus.RECONCILIATION_REQUIRED && !statementReceiptMatches) {
    throw new BadRequestError('This receipt is already in the M-Pesa review queue, but its amount or payer details do not match. The Treasurer needs to review it.');
  }
  if (statementReceiptMatches && reportedMpesaTransaction) {
    const reportedAt = new Date();
    await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.transaction.updateMany({ where: { id: reportedMpesaTransaction.id, organizationId: id, status: TransactionStatus.RECONCILIATION_REQUIRED, metadata: { path: ['reconciliationRequired'], equals: true } }, data: { status: TransactionStatus.PENDING } });
      if (claimed.count !== 1) throw new BadRequestError('This M-Pesa receipt is being matched already. Refresh your contribution.');
      const transactionMetadata = {
        ...reportedMpesaMetadata,
        contributionId,
        paymentMethod: 'MPESA',
        transactionRef: receipt,
        source: 'C2B_PAYBILL',
        reconciliationRequired: false,
        reconciliationOutcome: 'AUTO_MATCHED_TO_MEMBER_REPORT',
        reconciledAt: reportedAt.toISOString(),
        paymentApproval: { status: 'APPROVED', submittedAt: reportedAt.toISOString(), reviewedAt: reportedAt.toISOString(), automatic: true, reviewNote: 'Matched to the member report by M-Pesa receipt, amount, and payer phone.' },
      };
      const completedPayment = await tx.transaction.update({ where: { id: reportedMpesaTransaction.id }, data: { fromMemberId: req.user!.id, status: TransactionStatus.COMPLETED, metadata: transactionMetadata } });
      const totalPaid = await tx.transaction.aggregate({ where: { organizationId: id, type: 'CONTRIBUTION', fromMemberId: req.user!.id, status: TransactionStatus.COMPLETED, metadata: { path: ['contributionId'], equals: contributionId } }, _sum: { amount: true } });
      const required = Number(contribution.amount) + Number(contribution.penalties ?? 0);
      const totalReceived = Number(totalPaid._sum.amount ?? 0);
      if (totalReceived > required + 0.001) throw new BadRequestError('The statement payment is greater than this contribution balance; the Treasurer must review it.');
      const fullyPaid = totalReceived + 0.001 >= required;
      const updatedContribution = await tx.contribution.update({ where: { id: contributionId }, data: {
        status: fullyPaid ? ContributionStatus.PAID : ContributionStatus.PARTIAL,
        paymentMethod: PaymentMethod.MPESA,
        reference: receipt,
        transactionRef: receipt,
        paidDate: reportedAt,
        paidAt: fullyPaid ? reportedAt : null,
        recordedById: req.user!.id,
      } });
      if (fullyPaid) await allocatePaidContribution(tx, updatedContribution);
      await tx.organizationWallet.upsert({ where: { organizationId: id }, create: { organizationId: id, balance: reportedMpesaTransaction.amount, currency: 'KES' }, update: { balance: { increment: reportedMpesaTransaction.amount } } });
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'ContributionPaymentSubmission', entityId: reportedMpesaTransaction.id, oldValues: reportedMpesaTransaction as any, newValues: { payment: completedPayment, contribution: updatedContribution }, metadata: { operation: 'AUTO_MATCHED_MEMBER_REPORT_TO_MPESA_STATEMENT', receipt, contributionId } } });
      await tx.notification.create({ data: {
        dedupeKey: `paybill-member-report-confirmed:${receipt}`,
        recipientId: req.user!.id,
        organizationId: id,
        chamaId: contribution.chamaId,
        type: 'GENERAL_UPDATE',
        priority: 'INFO',
        title: fullyPaid ? 'M-Pesa payment confirmed' : 'M-Pesa part-payment confirmed',
        message: `Your payment of KES ${payload.amount.toLocaleString()} matched the M-Pesa record. Receipt: ${receipt}. ${fullyPaid ? 'Your contribution is paid.' : 'A balance is still due.'}`,
        channels: { create: [{ type: 'IN_APP', address: req.user!.id }] },
      } });
    });
    res.status(200).json({ payment: { id: reportedMpesaTransaction.id, amount: payload.amount, status: 'COMPLETED', reference: receipt, paymentMethod: 'MPESA' }, message: 'Your receipt matched the M-Pesa record. The contribution has been updated automatically.' });
    return;
  }
  const payment = await db.transaction.create({ data: {
    chamaId: contribution.chamaId,
    organizationId: id,
    type: 'CONTRIBUTION',
    amount: payload.amount,
    fromMemberId: req.user.id,
    reference: `MEMBER-PAYMENT-${randomUUID()}`,
    idempotencyKey: `organization:${id}:member-payment:${randomUUID()}`,
    status: TransactionStatus.PENDING,
    metadata: { contributionId, paymentMethod: payload.paymentMethod, transactionRef: receipt, memberPaidAt: submittedAt.toISOString(), paymentApproval: { status: 'PENDING', submittedAt: new Date().toISOString() } },
  } });
  await db.organizationAuditLog.create({ data: { organizationId: id, userId: req.user.id, action: 'CREATE', entityType: 'ContributionPaymentSubmission', entityId: payment.id, newValues: { contributionId, amount: payload.amount, paymentMethod: payload.paymentMethod, reference: receipt, paidAt: submittedAt }, metadata: { operation: 'MEMBER_PAYMENT_SUBMITTED' } } });

  const treasurers = await db.organizationMember.findMany({ where: { organizationId: id, status: 'ACTIVE', role: { name: { in: ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'] } }, userId: { not: req.user.id } }, select: { userId: true } });
  await Promise.all(treasurers.map((official: { userId: string }) => db.notification.create({ data: {
    dedupeKey: `member-payment:${payment.id}:${official.userId}`,
    recipientId: official.userId,
    organizationId: id,
    chamaId: contribution.chamaId,
    type: 'GENERAL_UPDATE',
    priority: 'IMPORTANT',
    title: 'Member says they paid',
    message: `A member submitted a ${payload.paymentMethod} payment of KES ${payload.amount.toLocaleString()} for a contribution. Check receipt ${receipt} and confirm it in Contributions.`,
    channels: { create: [{ type: 'IN_APP', address: official.userId }] },
  } })));
  await db.notification.create({ data: {
    dedupeKey: `member-payment-submitted:${payment.id}`,
    recipientId: req.user.id,
    organizationId: id,
    chamaId: contribution.chamaId,
    type: 'GENERAL_UPDATE',
    priority: 'INFO',
    title: 'Payment sent for checking',
    message: 'Your payment report is waiting for the Treasurer to confirm it. The contribution will stay due until it is confirmed.',
    channels: { create: [{ type: 'IN_APP', address: req.user.id }] },
  } });
  res.status(201).json({ payment: { id: payment.id, amount: Number(payment.amount), status: payment.status, reference: receipt, paymentMethod: payload.paymentMethod }, message: 'Your payment report was sent to the Treasurer.' });
}));

router.patch('/:id/contributions/:contributionId/payment-submissions/:paymentId/approve', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, contributionId, paymentId } = req.params as { id: string; contributionId: string; paymentId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!isFinanceManager(access)) throw new ForbiddenError('Only the Treasurer or an authorized finance official can confirm a payment');
  const payload = reviewContributionPaymentSchema.parse(req.body ?? {});
  const existing = await db.transaction.findFirst({ where: { id: paymentId, organizationId: id, type: 'CONTRIBUTION', status: 'PENDING', metadata: { path: ['contributionId'], equals: contributionId } } });
  if (!existing || (existing.metadata as any)?.paymentApproval?.status !== 'PENDING') throw new NotFoundError('Payment waiting for confirmation');
  const contribution = await db.contribution.findFirst({ where: { id: contributionId, organizationId: id } });
  if (!contribution || contribution.memberId !== existing.fromMemberId) throw new NotFoundError('Contribution for this payment');

  const result = await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.transaction.updateMany({ where: { id: paymentId, organizationId: id, status: 'PENDING', metadata: { path: ['paymentApproval', 'status'], equals: 'PENDING' } }, data: { status: 'COMPLETED', metadata: { ...(existing.metadata as any), paymentApproval: { status: 'APPROVED', submittedAt: (existing.metadata as any).paymentApproval.submittedAt, reviewedBy: req.user!.id, reviewedAt: new Date().toISOString(), reviewNote: payload.reason ?? null } } } });
    if (claimed.count !== 1) throw new BadRequestError('Another official has already reviewed this payment. Refresh the page.');
    const paid = await tx.transaction.aggregate({ where: { organizationId: id, type: 'CONTRIBUTION', fromMemberId: contribution.memberId, status: 'COMPLETED', metadata: { path: ['contributionId'], equals: contributionId } }, _sum: { amount: true } });
    const totalPaid = Number(paid._sum.amount ?? 0);
    const amountRequired = Number(contribution.amount) + Number(contribution.penalties ?? 0);
    if (totalPaid > amountRequired + 0.001) throw new BadRequestError('This payment would exceed the remaining contribution balance. Review the ledger before confirming.');
    const fullyPaid = totalPaid + 0.001 >= amountRequired;
    const reviewedAt = new Date();
    const updatedContribution = await tx.contribution.update({ where: { id: contributionId }, data: {
      status: fullyPaid ? ContributionStatus.PAID : ContributionStatus.PARTIAL,
      paymentMethod: ((existing.metadata as any)?.paymentMethod ?? 'MPESA') as PaymentMethod,
      reference: (existing.metadata as any)?.transactionRef ?? existing.reference,
      transactionRef: (existing.metadata as any)?.transactionRef ?? existing.reference,
      paidDate: reviewedAt,
      paidAt: fullyPaid ? reviewedAt : null,
      recordedById: req.user!.id,
    } });
    if (fullyPaid) await allocatePaidContribution(tx, updatedContribution);
    await tx.organizationWallet.upsert({ where: { organizationId: id }, create: { organizationId: id, balance: existing.amount, currency: 'KES' }, update: { balance: { increment: existing.amount } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'ContributionPaymentSubmission', entityId: paymentId, oldValues: existing as any, newValues: { paymentId, contribution: updatedContribution, status: 'APPROVED', reason: payload.reason }, metadata: { operation: 'MEMBER_PAYMENT_CONFIRMED', contributionId } } });
    return updatedContribution;
  });

  await db.notification.create({ data: { dedupeKey: `member-payment-approved:${paymentId}`, recipientId: contribution.memberId, organizationId: id, chamaId: contribution.chamaId, type: 'GENERAL_UPDATE', priority: 'INFO', title: 'Payment confirmed', message: `The Treasurer confirmed your ${((existing.metadata as any)?.paymentMethod ?? 'reported')} payment of KES ${Number(existing.amount).toLocaleString()}. Receipt: ${String((existing.metadata as any)?.transactionRef ?? existing.reference)}.`, channels: { create: [{ type: 'IN_APP', address: contribution.memberId }] } } });
  res.json({ contribution: result, message: 'Payment confirmed and added to the Chama records.' });
}));

router.patch('/:id/contributions/:contributionId/payment-submissions/:paymentId/reject', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, contributionId, paymentId } = req.params as { id: string; contributionId: string; paymentId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!isFinanceManager(access)) throw new ForbiddenError('Only the Treasurer or an authorized finance official can review a payment');
  const payload = reviewContributionPaymentSchema.parse(req.body ?? {});
  if (!payload.reason) throw new BadRequestError('Add a short reason so the member knows what needs attention.');
  const existing = await db.transaction.findFirst({ where: { id: paymentId, organizationId: id, type: 'CONTRIBUTION', status: 'PENDING', metadata: { path: ['contributionId'], equals: contributionId } } });
  if (!existing || (existing.metadata as any)?.paymentApproval?.status !== 'PENDING') throw new NotFoundError('Payment waiting for confirmation');
  const metadata = existing.metadata as any;
  const reviewedAt = new Date().toISOString();
  await runFinancialTransaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.transaction.updateMany({ where: { id: paymentId, organizationId: id, status: 'PENDING', metadata: { path: ['paymentApproval', 'status'], equals: 'PENDING' } }, data: { status: 'FAILED', metadata: { ...metadata, paymentApproval: { ...metadata.paymentApproval, status: 'REJECTED', reviewedBy: req.user!.id, reviewedAt, reviewNote: payload.reason } } } });
    if (claimed.count !== 1) throw new BadRequestError('Another official has already reviewed this payment. Refresh the page.');
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'ContributionPaymentSubmission', entityId: paymentId, oldValues: existing as any, newValues: { status: 'REJECTED', reason: payload.reason }, metadata: { operation: 'MEMBER_PAYMENT_REJECTED', contributionId } } });
  });
  await db.notification.create({ data: { dedupeKey: `member-payment-rejected:${paymentId}`, recipientId: existing.fromMemberId!, organizationId: id, chamaId: existing.chamaId, type: 'GENERAL_UPDATE', priority: 'IMPORTANT', title: 'Payment needs another look', message: `The Treasurer could not confirm your reported payment. ${payload.reason} Your contribution is still due; update the receipt details or contact the Treasurer.`, channels: { create: [{ type: 'IN_APP', address: existing.fromMemberId! }] } } });
  res.json({ message: 'Payment report returned to the member with your reason.' });
}));


}
