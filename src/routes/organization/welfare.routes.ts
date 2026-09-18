import { Router, Request, Response } from 'express';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { LedgerService } from '../../services/ledgerService';
import { computeApprovalOutcome, validateWelfarePayout } from '../../services/welfareGuardrails';
export function registerWelfareRoutes(router: Router, context: any): void {
  const { db, welfareCreateSchema, welfareTransitionSchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit } = context;
router.post(
  '/:id/welfare/claims',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, (req.user.id as string));

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept new welfare claims');
    }

    const payload = welfareCreateSchema.parse(req.body);
    await enforceWelfareEligibility(id, payload.memberId, payload.claimType, payload.amountRequested, payload.documents);

    const claim = await db.welfareClaim.create({
      data: {
        organizationId: id,
        requestedById: (req.user.id as string),
        memberId: payload.memberId,
        type: payload.claimType as any,
        claimType: payload.claimType,
        amountRequested: payload.amountRequested,
        reason: payload.reason,
        description: payload.reason,
        documents: payload.documents,
        supportingDocuments: payload.documents.length ? payload.documents : undefined,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'CREATE',
      entityType: 'WelfareClaim',
      entityId: claim.id,
      newValues: claim,
      metadata: { transition: { from: null, to: claim.status }, comment: undefined },
    });

    res.status(201).json({ claim });
  })
);

router.get(
  '/:id/welfare/claims',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, (req.user.id as string));

    const claims = await db.welfareClaim.findMany({
      where: { organizationId: id },
      include: { requestedBy: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ claims });
  })
);

router.patch(
  '/:id/welfare/claims/:claimId/approve',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, claimId } = req.params as { id: string; claimId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!isWelfareApprover(access)) {
      throw new ForbiddenError('Only Chairperson or Admin can approve welfare claims');
    }

    const { comment } = welfareTransitionSchema.parse(req.body);
    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
    }
    if (existing.status !== 'PENDING') throw new BadRequestError('Only pending welfare claims can be approved');

    const organization = await requireOrganizationStatus(id);
    const approvalPolicy = resolveWelfareApprovalPolicy(organization.metadata, existing.type, Number(existing.amountRequested ?? 0));
    const approvalsForClaim = [existing.reviewedById].filter(Boolean) as string[];
    const approvalOutcome = computeApprovalOutcome({
      approvals: approvalsForClaim.concat(req.user.id as string),
      requiredApprovals: approvalPolicy.requiredApprovals,
      thresholdPercent: approvalPolicy.thresholdPercent,
      totalPossibleApprovers: approvalPolicy.totalPossibleApprovers,
    });

    if (approvalPolicy.approvalMode !== 'AUTO' && !approvalPolicy.autoApproveWithinLimits && !approvalOutcome.approved) {
      throw new BadRequestError(`This welfare claim requires ${approvalPolicy.requiredApprovals} qualified approvals before it can be marked approved.`);
    }

    const claim = await db.welfareClaim.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED' as any,
        amountApproved: existing.amountRequested,
        reviewedById: (req.user.id as string),
        reviewedAt: new Date(),
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'UPDATE',
      entityType: 'WelfareClaim',
      entityId: claimId,
      oldValues: existing,
      newValues: claim,
      metadata: {
        transition: { from: existing.status, to: claim.status },
        reviewedAction: 'APPROVED',
        approvalMode: approvalPolicy.approvalMode,
        requiredApprovals: approvalPolicy.requiredApprovals,
        comment,
      },
    });

    res.json({ claim });
  })
);

router.patch(
  '/:id/welfare/claims/:claimId/pay',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const actingUserId = req.user.id as string;
    const { id, claimId } = req.params as { id: string; claimId: string };
    const access = await getOrganizationAccess(id, actingUserId);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can mark welfare claims as paid');
    }

    const { comment } = welfareTransitionSchema.parse(req.body);
    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
    }

    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {
      throw new BadRequestError('Only approved welfare claims can be marked as paid');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    const linkedChamaId = currentOrganization.chama?.id;
    if (!linkedChamaId) {
      throw new BadRequestError('Organization is not linked to an active Chama');
    }

    const ledgerKey = `organization:${id}:welfare:${claimId}:pay`;
    const duplicateLedger = await db.transaction.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (duplicateLedger) {
      res.status(200).json({ claim: existing, duplicatePayout: true, idempotentReplay: true, message: 'Duplicate welfare payout already recorded' });
      return;
    }

    const payoutValidation = validateWelfarePayout({
      organization: currentOrganization,
      walletBalance: 0,
      amountRequested: Number(existing.amountRequested ?? 0),
      amountApproved: Number(existing.amountApproved ?? existing.amountRequested ?? 0),
    });

    if (!payoutValidation.valid) {
      throw new BadRequestError(payoutValidation.errors[0] || 'Invalid welfare payout amount');
    }

    if (payoutValidation.payoutAmount <= 0) {
      throw new BadRequestError('Approved welfare amount must be greater than zero');
    }

    const claim = await runFinancialTransaction(async (tx: any) => {
      const wallet = await tx.organizationWallet.findUnique({ where: { organizationId: id } });
      if (!wallet) {
        throw new BadRequestError('This organization does not have a welfare wallet configured');
      }
      const payoutCheck = validateWelfarePayout({
        organization: currentOrganization,
        walletBalance: Number(wallet.balance ?? 0),
        amountRequested: Number(existing.amountRequested ?? 0),
        amountApproved: Number(existing.amountApproved ?? existing.amountRequested ?? 0),
      });

      if (!payoutCheck.valid) {
        throw new BadRequestError(payoutCheck.errors[0] || 'Invalid welfare payout amount');
      }

      const effectivePayoutAmount = payoutCheck.payoutAmount;

      if (Number(wallet.balance) < effectivePayoutAmount) {
        throw new BadRequestError(`Insufficient welfare fund balance. Available: KES ${Number(wallet.balance).toLocaleString()}, required: KES ${effectivePayoutAmount.toLocaleString()}`);
      }

      const updated = await tx.welfareClaim.update({
        where: { id: claimId },
        data: {
          status: 'PAID' as any,
          paidAt: new Date(),
          reviewedById: existing.reviewedById ?? actingUserId,
          amountApproved: existing.amountApproved ?? existing.amountRequested,
        },
      });

      const reference = `WELFARE-${claimId}-${Date.now()}`;
      await LedgerService.recordWelfarePayout(
        { transaction: tx },
        {
          organizationId: id,
          chamaId: linkedChamaId,
          fromMemberId: null,
          toMemberId: existing.requestedById,
          amount: effectivePayoutAmount,
          reference,
          idempotencyKey: ledgerKey,
          status: 'COMPLETED',
          metadata: {
            claimId,
            paymentType: 'WELFARE',
            paidBy: actingUserId,
            comment,
            approvedAmount: effectivePayoutAmount,
          },
        }
      );

      await tx.organizationWallet.update({
        where: { organizationId: id },
        data: { balance: { decrement: effectivePayoutAmount } },
      });

      return updated;
    });

    const approvalOutcome = computeApprovalOutcome({
      approvals: [existing.reviewedById].filter(Boolean),
      requiredApprovals: 1,
      thresholdPercent: 100,
    });
    if (!approvalOutcome.approved && existing.status === 'APPROVED') {
      throw new BadRequestError('Welfare claim approval has not reached the required threshold');
    }

    await writeOrganizationAudit({
      organizationId: id,
      userId: actingUserId,
      action: 'UPDATE',
      entityType: 'WelfareClaim',
      entityId: claimId,
      oldValues: existing,
      newValues: claim,
      metadata: { transition: { from: existing.status, to: claim.status }, paid: true, comment },
    });

    res.json({ claim });
  })
);

router.patch(
  '/:id/welfare/claims/:claimId/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, claimId } = req.params as { id: string; claimId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!isWelfareApprover(access)) {
      throw new ForbiddenError('Only Chairperson or Admin can reject welfare claims');
    }

    const { comment } = welfareTransitionSchema.parse(req.body);
    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
    }
    if (existing.status !== 'PENDING') throw new BadRequestError('Only pending welfare claims can be rejected');

    const claim = await db.welfareClaim.update({
      where: { id: claimId },
      data: {
        status: 'REJECTED' as any,
        reviewedById: (req.user.id as string),
        reviewedAt: new Date(),
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'UPDATE',
      entityType: 'WelfareClaim',
      entityId: claimId,
      oldValues: existing,
      newValues: claim,
      metadata: { transition: { from: existing.status, to: claim.status }, reviewedAction: 'REJECTED', comment },
    });

    res.json({ claim });
  })
);


}
