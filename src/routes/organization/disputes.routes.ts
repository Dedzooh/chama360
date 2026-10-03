import { createHash } from 'crypto';
import { Router, Request, Response } from 'express';
import { authenticate, requireMfaIfEnabled, rateLimitSensitive } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { NotificationService } from '../../services/notificationService';
import { NotificationPriority, NotificationType, NotificationChannelType } from '../../types/notification';

const safeDispute = (dispute: any) => ({
  id: dispute.id,
  organizationId: dispute.organizationId,
  category: dispute.category,
  relatedEntityType: dispute.relatedEntityType,
  relatedEntityId: dispute.relatedEntityId,
  description: dispute.description,
  status: dispute.status,
  resolution: dispute.resolution,
  activity: Array.isArray(dispute.activity) ? dispute.activity : [],
  createdAt: dispute.createdAt,
  updatedAt: dispute.updatedAt,
  raisedBy: dispute.raiser ? { id: dispute.raiser.id, firstName: dispute.raiser.firstName, lastName: dispute.raiser.lastName } : null,
  target: dispute.targetMember ? { id: dispute.targetMember.id, firstName: dispute.targetMember.firstName, lastName: dispute.targetMember.lastName } : null,
});

export function registerDisputesRoutes(router: Router, context: any): void {
  const { db, disputeCreateSchema, disputeStatusSchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, writeOrganizationAudit } = context;
  const notificationService = new NotificationService(db);

  router.get('/:id/disputes', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const canViewAll = isFinanceManager(access) || isWelfareApprover(access) || ['AUDITOR', 'SECRETARY'].includes(access.role?.name ?? '');
    const disputes = await db.dispute.findMany({
      where: canViewAll ? { organizationId: id } : { organizationId: id, raisedBy: req.user.id },
      include: { raiser: { select: { id: true, firstName: true, lastName: true } }, targetMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ disputes: disputes.map(safeDispute) });
  }));

  router.post('/:id/disputes', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id);
    const payload = disputeCreateSchema.parse(req.body);
    const organization = await db.organization.findUnique({ where: { id }, select: { name: true, chama: { select: { id: true } } } });
    if (!organization?.chama?.id) throw new BadRequestError('This group is not linked to a Chama and cannot open a dispute');
    if (payload.relatedEntityType === 'LOAN') {
      const loan = await db.loan.findFirst({ where: { id: payload.relatedEntityId, organizationId: id }, select: { id: true, borrowerId: true } });
      if (!loan || loan.borrowerId !== req.user.id) throw new ForbiddenError('You can only dispute your own loan');
    } else if (payload.relatedEntityType === 'WELFARE_CLAIM') {
      const claim = await db.welfareClaim.findFirst({ where: { id: payload.relatedEntityId, organizationId: id }, select: { id: true, requestedById: true } });
      if (!claim || claim.requestedById !== req.user.id) throw new ForbiddenError('You can only dispute your own welfare claim');
    }
    const current = new Date();
    const immutableHash = createHash('sha256').update(`${id}:${req.user.id}:${payload.category}:${payload.relatedEntityId ?? ''}:${current.toISOString()}:${payload.description}`).digest('hex');
    const duplicate = payload.relatedEntityId ? await db.dispute.findFirst({ where: { organizationId: id, raisedBy: req.user.id, relatedEntityId: payload.relatedEntityId, status: { in: ['OPEN', 'UNDER_REVIEW', 'VOTING'] } }, select: { id: true } }) : null;
    if (duplicate) throw new BadRequestError('You already have an open dispute for this item. Follow it from My disputes.');
    const dispute = await db.dispute.create({
      data: {
        chamaId: organization.chama.id,
        organizationId: id,
        raisedBy: req.user.id,
        category: payload.category,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
        description: payload.description,
        immutableHash,
        activity: [{ status: 'OPEN', note: 'Dispute submitted', at: current.toISOString(), by: req.user.id }],
      },
      include: { raiser: { select: { id: true, firstName: true, lastName: true } }, targetMember: { select: { id: true, firstName: true, lastName: true } } },
    });
    await writeOrganizationAudit({ organizationId: id, userId: req.user.id, action: 'DISPUTE_RAISED', entityType: 'Dispute', entityId: dispute.id, newValues: { category: dispute.category, status: dispute.status, relatedEntityType: dispute.relatedEntityType, relatedEntityId: dispute.relatedEntityId }, metadata: { event: 'DISPUTE_RAISED' } });
    const reviewers = await db.organizationMember.findMany({ where: { organizationId: id, status: 'ACTIVE', role: { name: { in: ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'] } }, userId: { not: req.user.id } }, select: { userId: true } });
    await Promise.all(reviewers.map(({ userId }: { userId: string }) => notificationService.createNotification({ recipientId: userId, chamaId: organization.chama.id, type: NotificationType.DISPUTE_RAISED, priority: NotificationPriority.IMPORTANT, title: 'A member raised a dispute', message: `A member submitted a dispute in ${organization.name}. Review it in the Disputes page.`, channels: [{ type: NotificationChannelType.IN_APP, address: userId }] })));
    res.status(201).json({ dispute: safeDispute(dispute) });
  }));

  router.patch('/:id/disputes/:disputeId/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, disputeId } = req.params as { id: string; disputeId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access) && !isWelfareApprover(access)) throw new ForbiddenError('Only the Chairperson or Treasurer can update disputes');
    const payload = disputeStatusSchema.parse(req.body);
    if (payload.status === 'VOTING' && !['CHAIR', 'OWNER', 'FOUNDER', 'ADMIN'].includes(access.role?.name ?? '')) throw new ForbiddenError('Only the Chairperson or Admin can move a dispute to a group vote');
    const existing = await db.dispute.findFirst({ where: { id: disputeId, organizationId: id } });
    if (!existing) throw new NotFoundError('Dispute not found');
    if (existing.status === 'RESOLVED' || existing.status === 'CLOSED') throw new BadRequestError('This dispute is already closed');
    const previousActivity = Array.isArray(existing.activity) ? existing.activity as any[] : [];
    const at = new Date();
    const dispute = await db.$transaction(async (tx: any) => {
      const claim = await tx.dispute.updateMany({ where: { id: disputeId, organizationId: id, status: existing.status }, data: {
        status: payload.status,
        resolution: { note: payload.resolution, updatedBy: req.user!.id, updatedAt: at.toISOString() },
        activity: [...previousActivity, { status: payload.status, note: payload.resolution, at: at.toISOString(), by: req.user!.id }],
      } });
      if (claim.count !== 1) throw new BadRequestError('This dispute was updated by another reviewer. Refresh and try again.');
      return tx.dispute.findUniqueOrThrow({ where: { id: disputeId }, include: { raiser: { select: { id: true, firstName: true, lastName: true } }, targetMember: { select: { id: true, firstName: true, lastName: true } } } });
    });
    await writeOrganizationAudit({ organizationId: id, userId: req.user.id, action: 'UPDATE', entityType: 'Dispute', entityId: dispute.id, oldValues: { status: existing.status }, newValues: { status: dispute.status }, metadata: { resolution: payload.resolution } });
    await notificationService.createNotification({ recipientId: dispute.raisedBy, chamaId: dispute.chamaId, type: NotificationType.DISPUTE_RAISED, priority: NotificationPriority.IMPORTANT, title: `Dispute update: ${dispute.status.toLowerCase().replace('_', ' ')}`, message: payload.resolution, channels: [{ type: NotificationChannelType.IN_APP, address: dispute.raisedBy }] });
    res.json({ dispute: safeDispute(dispute) });
  }));
}
