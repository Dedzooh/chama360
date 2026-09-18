import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerSettingsRoutes(router: Router, context: any): void {
  const { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog } = context;
router.get('/invites/:token', asyncHandler(async (req: Request, res: Response) => {
  const token = inviteTokenSchema.parse(req.params.token);
  const organization = await db.organization.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, description: true, organizationType: true, status: true },
  });
  if (!organization || ['SUSPENDED', 'CLOSED', 'ARCHIVED'].includes(organization.status)) {
    throw new NotFoundError('Invitation link is unavailable');
  }
  res.json({ organization });
}));

router.post('/invites/:token/join', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  const token = inviteTokenSchema.parse(req.params.token);
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('User not authenticated');
  const organization = await db.organization.findUnique({ where: { inviteToken: token }, select: { id: true, status: true } });
  if (!organization || ['SUSPENDED', 'CLOSED', 'ARCHIVED'].includes(organization.status)) {
    throw new NotFoundError('Invitation link is unavailable');
  }
  const existing = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId } },
  });
  if (existing) {
    if (existing.status === 'SUSPENDED') throw new ForbiddenError('This membership is suspended');
    if (existing.status === 'EXITED' || existing.status === 'ARCHIVED') {
      const membership = await db.organizationMember.update({ where: { id: existing.id }, data: { status: 'PENDING_APPROVAL' } });
      return res.json({ membership });
    }
    return res.json({ membership: existing });
  }
  const role = await db.organizationRole.findFirst({ where: { organizationId: organization.id, name: 'MEMBER' } });
  if (!role) throw new NotFoundError('Member role is unavailable');
  const membership = await db.organizationMember.create({
    data: { organizationId: organization.id, userId, roleId: role.id, status: 'PENDING_APPROVAL' },
  });
  await writeOrganizationAudit({ organizationId: organization.id, userId, action: 'CREATE', entityType: 'OrganizationMember', entityId: membership.id, metadata: { source: 'invite_link' } });
  return res.status(201).json({ membership });
}));

router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const payload = organizationCreateSchema.parse(req.body);
    const slugBase = payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const organization = await db.$transaction(async (tx: any) => {
      const created = await tx.organization.create({
        data: {
          name: payload.name,
          organizationType: payload.organizationType,
          chamaType: payload.chamaType,
          enabledModules: payload.enabledModules,
          slug,
          description: payload.description,
          metadata: payload.metadata,
          createdById: req.user!.id as string,
          inviteToken: randomUUID(),
        },
      });

      const ownerRole = await tx.organizationRole.create({
        data: {
          organizationId: created.id,
          name: 'FOUNDER' as any,
          label: 'Owner / Founder',
          permissions: ['*'],
          isSystemDefault: true,
        },
      });

      const defaultRoles = [
        { name: 'CHAIR', label: 'Chairperson' },
        { name: 'SECRETARY', label: 'Secretary' },
        { name: 'TREASURER', label: 'Treasurer' },
        { name: 'AUDITOR', label: 'Auditor' },
        { name: 'MEMBER', label: 'Member' },
      ] as const;

      for (const role of defaultRoles) {
        await tx.organizationRole.create({
          data: {
            organizationId: created.id,
            name: role.name as any,
            label: role.label,
            permissions: [],
            isSystemDefault: true,
          },
        });
      }

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: req.user!.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
        },
      });

      await tx.organizationWallet.create({
        data: {
          organizationId: created.id,
          balance: 0,
          currency: 'KES',
        },
      });

      await tx.organizationSettings.create({
        data: {
          organizationId: created.id,
          contributionRules: (payload.metadata as any)?.contributionRules ?? {},
          welfareRules: (payload.metadata as any)?.welfareRules ?? {},
          loanRules: (payload.metadata as any)?.loanRules ?? {},
          notificationRules: {},
          securityRules: {},
        },
      });

      return tx.organization.findUnique({
        where: { id: created.id },
        include: {
          wallet: true,
          settings: true,
          members: {
            include: {
              user: true,
              role: true,
            },
          },
        },
      });
    });

    if (!organization) {
      throw new NotFoundError('Organization not found after creation');
    }

    auditLog('CREATE', (req.user.id as string), organization.id, {
      action: 'ORGANIZATION_CREATED',
      organizationType: organization.organizationType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    await writeOrganizationAudit({
      organizationId: organization.id,
      userId: (req.user.id as string),
      action: 'CREATE',
      entityType: 'Organization',
      entityId: organization.id,
      newValues: {
        name: organization.name,
        organizationType: organization.organizationType,
        chamaType: (organization as any).chamaType,
        enabledModules: (organization as any).enabledModules,
      },
    });

    res.status(201).json({ organization });
  })
);

router.get(
  '/my',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const memberships = await db.organizationMember.findMany({
      where: {
        userId: (req.user.id as string),
      },
      include: {
        organization: {
          include: {
            wallet: true,
            settings: true,
          },
        },
        role: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    res.json({
      organizations: memberships.map((membership: any) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        organizationType: membership.organization.organizationType,
        slug: membership.organization.slug,
        description: membership.organization.description,
        status: membership.organization.status,
        role: membership.role?.label ?? 'Member',
        myRole: membership.role?.name ?? 'MEMBER',
        myRoleLabel: membership.role?.label ?? 'Member',
        chamaType: membership.organization.chamaType ?? membership.organization.organizationType,
        enabledModules: membership.organization.enabledModules ?? null,
        balance: membership.organization.wallet?.balance ?? 0,
      })),
    });
  })
);

router.get('/:id/invite-link', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user!.id as string);
  if (!isOwnerLike(access.role?.name ?? '') && !hasOrganizationPermission(access, 'INVITE_MEMBERS')) {
    throw new ForbiddenError('Insufficient permissions to invite members');
  }
  await db.organization.updateMany({ where: { id, inviteToken: null }, data: { inviteToken: randomUUID() } });
  const organization = await db.organization.findUnique({ where: { id }, select: { inviteToken: true, status: true } });
  if (!organization || ['SUSPENDED', 'CLOSED', 'ARCHIVED'].includes(organization.status)) {
    throw new ForbiddenError('This organization is not accepting invitations');
  }
  res.json({ token: organization.inviteToken });
}));

router.post('/:id/invite-link/rotate', authenticate, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user!.id as string);
  if (!isOwnerLike(access.role?.name ?? '') && !hasOrganizationPermission(access, 'INVITE_MEMBERS')) {
    throw new ForbiddenError('Insufficient permissions to invite members');
  }
  if (['SUSPENDED', 'CLOSED', 'ARCHIVED'].includes(access.organization.status)) {
    throw new ForbiddenError('This organization is not accepting invitations');
  }
  const token = randomUUID();
  await db.organization.update({ where: { id }, data: { inviteToken: token } });
  await writeOrganizationAudit({ organizationId: id, userId: req.user!.id as string, action: 'UPDATE', entityType: 'OrganizationInviteLink', entityId: id, metadata: { rotated: true } });
  res.json({ token });
}));

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));

    const organizationRecord = await db.organization.findUnique({
      where: { id },
      include: {
        wallet: true,
        settings: true,
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, kycStatus: true, createdAt: true } },
            role: true,
          },
        },
      },
    });

    const roleName = access.role?.name ?? 'MEMBER';
    const canViewContacts = isOwnerLike(roleName) || ['TREASURER', 'SECRETARY'].includes(roleName) || hasOrganizationPermission(access, 'VIEW_MEMBER_CONTACTS');
    const safeOrganization = organizationRecord ? { ...organizationRecord, inviteToken: undefined, members: organizationRecord.members.map((member: any) => ({ ...member, user: canViewContacts || member.userId === req.user!.id ? member.user : { ...member.user, email: null, phone: null } })) } : organizationRecord;
    res.json({ organization: safeOrganization, myRole: roleName, myRoleLabel: access.role?.label ?? 'Member' });
  })
);

router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));

    if (!hasOrganizationPermission(access, 'EDIT_ORGANIZATION') && !isOwnerLike((access.role as any)?.name || '')) {
      throw new ForbiddenError('Insufficient permissions to update organization');
    }

    const payload = organizationUpdateSchema.parse(req.body);
    const before = await db.organization.findUnique({ where: { id } });
    const updated = await db.organization.update({
      where: { id },
      data: {
        name: payload.name,
        organizationType: payload.organizationType,
        chamaType: payload.chamaType,
        enabledModules: payload.enabledModules,
        slug: payload.slug,
        description: payload.description,
        metadata: payload.metadata,
        status: payload.status as any,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    res.json({ organization: updated });
  })
);

router.post(
  '/:id/activate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const organization = await updateOrganizationLifecycle({
      organizationId: id,
      userId: req.user.id as string,
      targetStatus: 'ACTIVE',
    });

    res.json({ organization });
  })
);

router.post(
  '/:id/suspend',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const organization = await updateOrganizationLifecycle({
      organizationId: id,
      userId: req.user.id as string,
      targetStatus: 'SUSPENDED',
    });

    res.json({ organization });
  })
);

router.post(
  '/:id/close',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const organization = await updateOrganizationLifecycle({
      organizationId: id,
      userId: req.user.id as string,
      targetStatus: 'CLOSED',
    });

    res.json({ organization });
  })
);

router.post(
  '/:id/archive',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const organization = await updateOrganizationLifecycle({
      organizationId: id,
      userId: req.user.id as string,
      targetStatus: 'ARCHIVED',
    });

    res.json({ organization });
  })
);
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));

    if (!isOwnerLike((access.role as any)?.name || '')) {
      throw new ForbiddenError('Only the owner can delete an organization');
    }

    await db.organization.delete({ where: { id } });

    await writeOrganizationAudit({
      organizationId: id,
      userId: (req.user.id as string),
      action: 'DELETE',
      entityType: 'Organization',
      entityId: id,
    });

    res.status(204).send();
  })
);


}
