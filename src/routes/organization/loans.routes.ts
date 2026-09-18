import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerLoansRoutes(router: Router, context: any): void {
  const { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit } = context;
router.post(
  '/:id/loans/apply',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id as string);

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept new loans');
    }

    const payload = loanApplySchema.parse(req.body);
    const amountRequested = payload.amountRequested;
    const loanRules = (currentOrganization as any).settings?.loanRules ?? {};
    const requiredGuarantors = getRequiredGuarantorCount(loanRules);
    const maxLoanAmount = getRuleNumber(loanRules.maxLoanAmount, 0);
    if (maxLoanAmount > 0 && amountRequested > maxLoanAmount) {
      throw new BadRequestError(`Loan amount cannot exceed the Chama rule limit of ${maxLoanAmount}`);
    }

    const borrowerId = payload.memberId || (req.user.id as string);
    const guarantorIds = Array.from(new Set(payload.guarantors)).filter((guarantorId) => guarantorId !== borrowerId);
    if (payload.guarantors.includes(borrowerId)) {
      throw new BadRequestError('Borrowers cannot guarantee their own loans');
    }
    if (guarantorIds.length < requiredGuarantors) {
      throw new BadRequestError(`This Chama requires at least ${requiredGuarantors} guarantor${requiredGuarantors === 1 ? '' : 's'} for this loan amount`);
    }

    const linkedChamaId = (currentOrganization as any).chama?.id;
    if (!linkedChamaId) {
      throw new BadRequestError('Organization is not linked to an active Chama');
    }

    const activeMembers = await db.organizationMember.findMany({
      where: {
        organizationId: id,
        userId: { in: [borrowerId, ...guarantorIds] },
        status: 'ACTIVE',
      },
      select: { userId: true },
    });
    const activeMemberIds = new Set(activeMembers.map((member: any) => member.userId));
    if (!activeMemberIds.has(borrowerId)) {
      throw new ForbiddenError('Loan borrower must be an active member of this Chama');
    }
    const invalidGuarantors = guarantorIds.filter((guarantorId) => !activeMemberIds.has(guarantorId));
    if (invalidGuarantors.length > 0) {
      throw new ForbiddenError('Guarantors must be active members of this Chama');
    }
    if (requiredGuarantors > 0 && guarantorIds.length === 0) {
      throw new BadRequestError('Select at least one fellow member to guarantee this loan');
    }

    const loan = await db.loan.create({
      data: {
        chamaId: linkedChamaId,
        organizationId: id,
        borrowerId,
        memberId: borrowerId,
        amountRequested: amountRequested,
        amountApproved: null,
        amount: amountRequested,
        purpose: payload.purpose,
        interestRate: payload.interestRate,
        repaymentPeriodMonths: payload.repaymentPeriodMonths,
        guarantorsData: guarantorIds,
        dueDate: new Date(Date.now() + payload.repaymentPeriodMonths * 30 * 24 * 60 * 60 * 1000),
        balance: amountRequested,
        riskScore: 0,
        status: 'PENDING' as any,
        guarantors: {
          create: guarantorIds.map((memberId) => ({
            memberId,
            guaranteedAmount: amountRequested,
            status: 'PENDING' as any,
          })),
        },
      },
      include: {
        borrower: true,
        requestedBy: true,
        reviewedBy: true,
        guarantors: { include: { member: true } },
        repayments: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'Loan',
      entityId: loan.id,
      newValues: loan,
    });

    res.status(201).json({ loan });
  })
);

router.get(
  '/:id/loans',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id as string);

    const loans = await db.loan.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        borrower: true,
        requestedBy: true,
        reviewedBy: true,
        guarantors: { include: { member: true } },
        repayments: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({ loans });
  })
);

router.get(
  '/:id/loans/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id as string);

    const [total, pending, approved, active, paid, rejected, outstanding, requestedSum, approvedSum] = await Promise.all([
      db.loan.count({ where: { organizationId: id } }),
      db.loan.count({ where: { organizationId: id, status: 'PENDING' } }),
      db.loan.count({ where: { organizationId: id, status: 'APPROVED' } }),
      db.loan.count({ where: { organizationId: id, status: 'ACTIVE' } }),
      db.loan.count({ where: { organizationId: id, status: 'PAID' } }),
      db.loan.count({ where: { organizationId: id, status: 'REJECTED' } }),
      db.loan.count({ where: { organizationId: id, status: { in: ['APPROVED', 'ACTIVE', 'DEFAULTED'] as any } } }),
      db.loan.aggregate({ where: { organizationId: id }, _sum: { amountRequested: true } }),
      db.loan.aggregate({ where: { organizationId: id }, _sum: { amountApproved: true } }),
    ]);

    res.json({
      total,
      pending,
      approved,
      active,
      paid,
      rejected,
      outstanding,
      requested: Number(requestedSum._sum.amountRequested ?? 0),
      approvedAmount: Number(approvedSum._sum.amountApproved ?? 0),
    });
  })
);

router.get(
  '/:id/loans/:loanId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const loan = await db.loan.findFirst({
      where: { id: loanId, organizationId: id },
      include: {
        borrower: true,
        requestedBy: true,
        reviewedBy: true,
        guarantors: { include: { member: true } },
        repayments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!loan) {
      throw new NotFoundError('Loan not found');
    }

    res.json({ loan });
  })
);

router.patch(
  '/:id/loans/:loanId/approve',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isWelfareApprover(access)) {
      throw new ForbiddenError('Only Chairperson or Admin can approve loans');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot approve loans');
    }

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }

    const requiredGuarantors = getRequiredGuarantorCount((currentOrganization as any).settings?.loanRules);
    await requireAcceptedLoanGuarantees(loanId, requiredGuarantors);

    const amountApproved = Number(existing.amountRequested ?? existing.amount ?? 0);
    const loan = await db.loan.update({
      where: { id: loanId },
      data: {
        status: 'APPROVED' as any,
        amountApproved: amountApproved,
        amount: amountApproved,
        reviewedById: req.user.id as string,
        reviewedAt: new Date(),
      },
      include: {
        borrower: true,
        requestedBy: true,
        reviewedBy: true,
        guarantors: { include: { member: true } },
        repayments: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: loanId,
      oldValues: existing,
      newValues: loan,
      metadata: { reviewedAction: 'APPROVED' },
    });

    res.json({ loan });
  })
);

router.patch(
  '/:id/loans/:loanId/guarantee/accept',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept loan guarantees');
    }

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id }, include: { guarantors: true } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }
    if (!['PENDING', 'APPROVED'].includes(existing.status)) {
      throw new BadRequestError('Only pending or approved loans can receive guarantee decisions');
    }
    if (existing.borrowerId === req.user.id) {
      throw new ForbiddenError('Borrowers cannot guarantee their own loans');
    }

    const guarantee = existing.guarantors.find((item: any) => item.memberId === req.user!.id);
    if (!guarantee) {
      throw new ForbiddenError('You were not requested to guarantee this loan');
    }

    const payload = guaranteeDecisionSchema.parse(req.body);
    const guaranteedAmount = payload.guaranteedAmount ?? Number(existing.amountRequested ?? existing.amount ?? 0);
    if (guaranteedAmount > Number(existing.amountRequested ?? existing.amount ?? 0)) {
      throw new BadRequestError('Guaranteed amount cannot exceed the loan amount');
    }

    const loan = await db.$transaction(async (tx: any) => {
      await tx.loanGuarantor.update({
        where: { id: guarantee.id },
        data: {
          status: 'ACTIVE',
          guaranteedAmount,
        },
      });
      await tx.organizationAuditLog.create({
        data: {
          organizationId: id,
          userId: req.user!.id,
          action: 'UPDATE',
          entityType: 'LoanGuarantor',
          entityId: guarantee.id,
          oldValues: guarantee,
          newValues: { ...guarantee, status: 'ACTIVE', guaranteedAmount },
          metadata: { loanId, guaranteeDecision: 'ACCEPTED' },
        },
      });
      return tx.loan.findUnique({
        where: { id: loanId },
        include: {
          borrower: true,
          requestedBy: true,
          reviewedBy: true,
          guarantors: { include: { member: true } },
          repayments: true,
        },
      });
    });

    res.json({ loan });
  })
);

router.patch(
  '/:id/loans/:loanId/guarantee/decline',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id }, include: { guarantors: true } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }
    if (!['PENDING', 'APPROVED'].includes(existing.status)) {
      throw new BadRequestError('Only pending or approved loans can receive guarantee decisions');
    }

    const guarantee = existing.guarantors.find((item: any) => item.memberId === req.user!.id);
    if (!guarantee) {
      throw new ForbiddenError('You were not requested to guarantee this loan');
    }

    const loan = await db.$transaction(async (tx: any) => {
      await tx.loanGuarantor.update({
        where: { id: guarantee.id },
        data: { status: 'DECLINED' },
      });
      await tx.organizationAuditLog.create({
        data: {
          organizationId: id,
          userId: req.user!.id,
          action: 'UPDATE',
          entityType: 'LoanGuarantor',
          entityId: guarantee.id,
          oldValues: guarantee,
          newValues: { ...guarantee, status: 'DECLINED' },
          metadata: { loanId, guaranteeDecision: 'DECLINED' },
        },
      });
      return tx.loan.findUnique({
        where: { id: loanId },
        include: {
          borrower: true,
          requestedBy: true,
          reviewedBy: true,
          guarantors: { include: { member: true } },
          repayments: true,
        },
      });
    });

    res.json({ loan });
  })
);

router.patch(
  '/:id/loans/:loanId/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isWelfareApprover(access)) {
      throw new ForbiddenError('Only Chairperson or Admin can reject loans');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot reject loans');
    }

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }

    const loan = await db.loan.update({
      where: { id: loanId },
      data: {
        status: 'REJECTED' as any,
        reviewedById: req.user.id as string,
        reviewedAt: new Date(),
      },
      include: {
        borrower: true,
        requestedBy: true,
        reviewedBy: true,
        guarantors: { include: { member: true } },
        repayments: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: loanId,
      oldValues: existing,
      newValues: loan,
      metadata: { reviewedAction: 'REJECTED' },
    });

    res.json({ loan });
  })
);

router.patch(
  '/:id/loans/:loanId/disburse',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can mark loans as disbursed');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot disburse loans');
    }

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }

    if (existing.status !== 'APPROVED') {
      throw new BadRequestError('Only approved loans can be disbursed');
    }

    const requiredGuarantors = getRequiredGuarantorCount((currentOrganization as any).settings?.loanRules);
    await requireAcceptedLoanGuarantees(loanId, requiredGuarantors);

    const linkedChamaId = currentOrganization.chama?.id;
    if (!linkedChamaId) throw new BadRequestError('Organization is not linked to an active Chama');
    const disbursementAmount = Number(existing.amountApproved ?? existing.amount);
    const loan = await runFinancialTransaction(async (tx: any) => {
      const wallet = await tx.organizationWallet.findUnique({ where: { organizationId: id } });
      if (!wallet || Number(wallet.balance) < disbursementAmount) throw new BadRequestError('The Chama wallet does not have enough funds to disburse this loan');
      const updated = await tx.loan.update({ where: { id: loanId }, data: { status: 'ACTIVE', disbursedAt: new Date() }, include: { borrower: true, requestedBy: true, reviewedBy: true, guarantors: { include: { member: true } }, repayments: true } });
      await tx.transaction.create({ data: { chamaId: linkedChamaId, organizationId: id, type: 'LOAN_DISBURSEMENT', amount: disbursementAmount, toMemberId: existing.borrowerId, reference: `LOAN-DISBURSEMENT-${loanId}`, idempotencyKey: `organization:${id}:loan-disbursement:${loanId}`, status: 'COMPLETED', metadata: { loanId } } });
      await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { decrement: disbursementAmount } } });
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Loan', entityId: loanId, oldValues: existing, newValues: updated, metadata: { disbursed: true } } });
      return updated;
    });

    res.json({ loan });
  })
);

router.post(
  '/:id/loans/:loanId/repay',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, loanId } = req.params as { id: string; loanId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can record repayments');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot record repayments');
    }

    const existing = await db.loan.findFirst({ where: { id: loanId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Loan not found');
    }

    const payload = loanRepaySchema.parse(req.body);
    if (!['ACTIVE', 'DEFAULTED'].includes(existing.status)) throw new BadRequestError('Only active or defaulted loans can receive repayments');
    const outstanding = Number(existing.balance ?? 0);
    if (payload.amount > outstanding) throw new BadRequestError(`Repayment cannot exceed the outstanding balance of KES ${outstanding.toFixed(2)}`);
    const linkedChamaId = currentOrganization.chama?.id;
    if (!linkedChamaId) throw new BadRequestError('Organization is not linked to an active Chama');
    const requestKey = payload.idempotencyKey || req.get('Idempotency-Key') || randomUUID();
    const ledgerKey = `organization:${id}:loan-repayment:${loanId}:${requestKey}`;
    const replay = await db.transaction.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (replay) {
      const repayment = await db.loanRepayment.findFirst({ where: { organizationId: id, loanId, reference: replay.reference } });
      const loan = await db.loan.findUnique({ where: { id: loanId } });
      if (repayment) {
        res.status(200).json({ repayment, loan, idempotentReplay: true });
        return;
      }
    }
    const result = await runFinancialTransaction(async (tx: any) => {
      const reference = payload.reference || `LOAN-REPAYMENT-${randomUUID()}`;
      const repayment = await tx.loanRepayment.create({ data: { organizationId: id, loanId, memberId: existing.borrowerId, recordedById: req.user!.id, amount: payload.amount, paymentMethod: payload.paymentMethod as any, reference, status: 'PAID', repaidAt: new Date(), paidAt: new Date() } });
      const nextBalance = outstanding - payload.amount;
      const loan = await tx.loan.update({ where: { id: loanId }, data: { balance: nextBalance, status: nextBalance <= 0 ? 'PAID' : existing.status } });
      await tx.transaction.create({ data: { chamaId: linkedChamaId, organizationId: id, type: 'LOAN_PAYMENT', amount: payload.amount, fromMemberId: existing.borrowerId, reference, idempotencyKey: ledgerKey, status: 'COMPLETED', metadata: { loanId, repaymentId: repayment.id, paymentMethod: payload.paymentMethod } } });
      await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: payload.amount } } });
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'LoanRepayment', entityId: repayment.id, oldValues: existing, newValues: { repayment, loan }, metadata: { repaymentRecorded: true, idempotencyKey: ledgerKey } } });
      return { repayment, loan };
    });

    res.status(201).json(result);
  })
);


}
