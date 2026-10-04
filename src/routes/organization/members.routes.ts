import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';
export function registerMembersRoutes(router: Router, context: any): void {
  const { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit } = context;
router.post(
  '/:id/members',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!hasOrganizationPermission(access, 'INVITE_MEMBERS') && !isOwnerLike((access.role as any)?.name || '')) {
      throw new ForbiddenError('Insufficient permissions to add members');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Archived organizations are read-only');
    }

    const payload = memberCreateSchema.parse(req.body);
    if (payload.status === 'ACTIVE') await requireMemberCapacity(id);
    const targetUser = payload.userId
      ? await db.user.findUnique({ where: { id: payload.userId } })
      : payload.email
        ? await db.user.findUnique({ where: { email: payload.email } })
        : null;

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    const role = await db.organizationRole.findFirst({
      where: {
        organizationId: id,
        name: payload.role as any,
      },
    });

    if (!role) {
      throw new NotFoundError('Organization role not found');
    }

    const member = await db.organizationMember.create({
      data: {
        organizationId: id,
        userId: targetUser.id,
        roleId: role.id,
        status: payload.status,
      },
    });
    const memberRecordCount = await db.organizationMember.count({ where: { organizationId: id } });
    if (memberRecordCount === 2) await db.commercialFunnelEvent.create({ data: { eventType: 'FIRST_MEMBER_INVITED', userId: req.user!.id, organizationId: id } });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'CREATE',
      entityType: 'OrganizationMember',
      entityId: member.id,
      newValues: member,
    });

    res.status(201).json({ member });
  })
);

router.get(
  '/:id/members',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    const roleName = (access.role as any)?.name || '';
    const canViewContacts = isOwnerLike(roleName) || ['TREASURER', 'SECRETARY'].includes(roleName) || hasOrganizationPermission(access, 'VIEW_MEMBER_CONTACTS');

    const members = await db.organizationMember.findMany({
      where: { organizationId: id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, kycStatus: true, createdAt: true } }, role: true },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({ members: members.map((member: any) => ({ ...member, user: canViewContacts || member.userId === req.user!.id ? member.user : { ...member.user, email: null, phone: null } })) });
  })
);

router.get(
  '/:id/roles',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, (req.user.id as string));

    const roles = await db.organizationRole.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ roles });
  })
);

router.post(
  '/:id/members/:memberId/report-death',
  authenticate,
  requireSubscriptionFeature('ADMIN_CONTROLS'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }
    const actorId = req.user.id;

    const { id, memberId } = req.params as { id: string; memberId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!hasOrganizationPermission(access, 'MANAGE_ROLES')) {
      throw new ForbiddenError('Only officials with member-management rights can report a death');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Archived organizations are read-only');
    }

    const payload = (req.body ?? {}) as { dateOfDeath?: string; notes?: string };
    const member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: id, status: 'ACTIVE' },
      include: { user: { select: { firstName: true, lastName: true } }, role: true },
    });
    if (!member) throw new NotFoundError('Active member not found');

    const outcome = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Mark the member deceased (distinct from EXITED - keeps all records).
      const updatedMember = await tx.organizationMember.update({
        where: { id: member.id },
        data: { status: 'DECEASED' },
      });

      // 2. Auto-open a bereavement welfare claim for the deceased member.
      const deceasedName = `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim();
      let claim = null;
      try {
        claim = await tx.welfareClaim.create({
          data: {
            organizationId: id,
            requestedById: actorId,
            memberId: member.id,
            type: 'FUNERAL',
            amountRequested: 0,
            description: `Bereavement claim auto-opened following the death of ${deceasedName}. Reported by an official.`,
            status: 'PENDING',
          },
        });
      } catch {
        // Welfare module may be disabled or the DEATH category may not exist;
        // the member status change still succeeds and officials handle the
        // claim manually.
      }

      return { member: updatedMember, claim };
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'MEMBER_DECEASED',
      entityType: 'OrganizationMember',
      entityId: member.id,
      oldValues: { status: 'ACTIVE' },
      newValues: { status: 'DECEASED', dateOfDeath: payload.dateOfDeath ?? null, notes: payload.notes ?? null, bereavementClaimId: outcome.claim?.id ?? null },
    });

    res.json({
      member: outcome.member,
      claim: outcome.claim,
      message: `${member.user?.firstName ?? 'Member'} marked as deceased. The account is retained for historical records, and a bereavement welfare claim has been opened for officials to review.`,
    });
  })
);

router.patch(
  '/:id/members/:memberId',
  authenticate,
  requireSubscriptionFeature('ADMIN_CONTROLS'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, memberId } = req.params as { id: string; memberId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {
      throw new ForbiddenError('Insufficient permissions to update members');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Archived organizations are read-only');
    }

    const payload = memberUpdateSchema.parse(req.body);
    const existingMember = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: id },
      include: { role: true },
    });
    if (!existingMember) throw new NotFoundError('Organization member not found');

    if (isFounderRole(existingMember.role.name) && ['SUSPENDED', 'EXITED', 'ARCHIVED'].includes(payload.status ?? '')) {
      const founderCount = await db.organizationMember.count({ where: { organizationId: id, status: 'ACTIVE', role: { name: { in: ['OWNER', 'FOUNDER'] } } } });
      if (founderCount <= 1) throw new BadRequestError('Transfer ownership to another founder or owner before suspending this account');
    }

    if (payload.roleId) {
      const role = await db.organizationRole.findFirst({
        where: { id: payload.roleId, organizationId: id },
      });
      if (!role) throw new BadRequestError('Role does not belong to this organization');
    }

    if (payload.status === 'ACTIVE') {
      if (existingMember?.status !== 'ACTIVE') await requireMemberCapacity(id);
    }
    const member = await db.organizationMember.update({
      where: { id: memberId },
      data: {
        roleId: payload.roleId,
        status: payload.status,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'UPDATE',
      entityType: 'OrganizationMember',
      entityId: memberId,
      newValues: member,
    });

    res.json({ member });
  })
);

router.post(
  '/:id/members/:memberId/handover',
  authenticate,
  requireSubscriptionFeature('ADMIN_CONTROLS'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, memberId } = req.params as { id: string; memberId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    // Only owner-like users (incl. creator via isCreator flag) or MANAGE_ROLES
    // holders may officiate a handover.
    if (!hasOrganizationPermission(access, 'MANAGE_ROLES')) {
      throw new ForbiddenError('Insufficient permissions to conduct an officer handover');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Archived organizations are read-only');
    }

    const { newMemberId, confirm } = (req.body ?? {}) as { newMemberId?: string; confirm?: boolean };
    if (!newMemberId || !confirm) {
      throw new BadRequestError('Select the incoming officer and confirm the handover');
    }

    const outgoing = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: id, status: 'ACTIVE' },
      include: { role: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!outgoing) throw new NotFoundError('Outgoing member not found');
    if (outgoing.id === newMemberId) throw new BadRequestError('The incoming officer must be a different member');

    const incoming = await db.organizationMember.findFirst({
      where: { id: newMemberId, organizationId: id, status: 'ACTIVE' },
      include: { role: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!incoming) throw new NotFoundError('Incoming member not found or not active');

    // Founder/owner positions cannot be vacated this way — ownership transfer
    // has its own flow (the PATCH route guards against losing the last founder).
    if (['OWNER', 'FOUNDER'].includes((outgoing.role?.name ?? '').toUpperCase())) {
      throw new BadRequestError('Ownership transfer uses the role change flow, not handover');
    }

    const outgoingRoleName = outgoing.role?.name ?? 'MEMBER';
    // Atomic swap in one transaction: outgoing becomes a plain member, incoming
    // inherits the outgoing officer role.
    const [updatedOutgoing, updatedIncoming] = await db.$transaction([
      db.organizationMember.update({ where: { id: outgoing.id }, data: { roleId: (await db.organizationRole.findFirst({ where: { organizationId: id, name: 'MEMBER' } }))?.id ?? outgoing.roleId } }),
      db.organizationMember.update({ where: { id: incoming.id }, data: { roleId: outgoing.roleId } }),
    ]);

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'OFFICER_HANDOVER',
      entityType: 'OrganizationMember',
      entityId: outgoing.id,
      oldValues: { memberId: outgoing.id, name: `${outgoing.user?.firstName ?? ''} ${outgoing.user?.lastName ?? ''}`.trim(), role: outgoingRoleName },
      newValues: { from: outgoing.id, to: incoming.id, incomingName: `${incoming.user?.firstName ?? ''} ${incoming.user?.lastName ?? ''}`.trim(), role: outgoingRoleName, approvedBy: req.user.id },
    });

    res.json({
      outgoing: updatedOutgoing,
      incoming: updatedIncoming,
      message: `${outgoingRoleName} handover completed. ${incoming.user?.firstName ?? 'Incoming officer'} now holds ${outgoingRoleName} permissions.`,
    });
  })
);

router.delete(
  '/:id/members/:memberId',
  authenticate,
  requireSubscriptionFeature('ADMIN_CONTROLS'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, memberId } = req.params as { id: string; memberId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!hasOrganizationPermission(access, 'MANAGE_ROLES') && !isOwnerLike((access.role as any)?.name || '')) {
      throw new ForbiddenError('Insufficient permissions to remove members');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Archived organizations are read-only');
    }

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: id },
      select: { id: true, status: true, role: { select: { name: true } } },
    });
    if (!member) throw new NotFoundError('Organization member not found');

    if (isFounderRole(member.role.name)) {
      const founderCount = await db.organizationMember.count({ where: { organizationId: id, status: 'ACTIVE', role: { name: { in: ['OWNER', 'FOUNDER'] } } } });
      if (founderCount <= 1) throw new BadRequestError('Transfer ownership to another founder or owner before removing this account');
    }

    await db.organizationMember.delete({ where: { id: member.id } });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'DELETE',
      entityType: 'OrganizationMember',
      entityId: memberId,
    });

    res.status(204).send();
  })
);


}
