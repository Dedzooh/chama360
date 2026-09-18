import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
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

router.patch(
  '/:id/members/:memberId',
  authenticate,
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

router.delete(
  '/:id/members/:memberId',
  authenticate,
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
