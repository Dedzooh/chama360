import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { auditLog } from '../config/logger';
import { requireSubscriptionFeature } from '../middleware/subscription';
import { subscriptionPlans } from '../config/subscriptions';
import { subscriptionLifecycleService } from '../services/subscriptionLifecycleService';
import { randomUUID } from 'crypto';
import { allocatePaidContribution, removeContributionAllocation } from '../services/contributionAllocationService';

const router = Router();
const db: any = prisma;
const inviteTokenSchema = z.string().uuid();
const runFinancialTransaction = <T>(operation: (tx: any) => Promise<T>): Promise<T> =>
  db.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 });

async function requireMemberCapacity(organizationId: string) {
  const subscription = await subscriptionLifecycleService.reconcileOrganization(organizationId);
  if (!['ACTIVE', 'PAST_DUE'].includes(subscription.status)) throw new ForbiddenError('This chama subscription is inactive. Ask an administrator to review its plan.');
  const limit = subscriptionPlans[subscription.plan].memberLimit;
  if (limit === null) return;
  const activeMembers = await prisma.organizationMember.count({ where: { organizationId, status: 'ACTIVE' } });
  if (activeMembers >= limit) throw new ForbiddenError(`This chama has reached its ${subscriptionPlans[subscription.plan].name} plan limit of ${limit} active members. Upgrade the chama plan to add more members.`);
}

const organizationTypeSchema = z.enum([
  'CHAMA',
  'WELFARE',
  'SACCO',
  'INVESTMENT_CLUB',
  'FAMILY_GROUP',
  'CHURCH_GROUP',
  'YOUTH_GROUP',
  'STAFF_WELFARE',
  'ESTATE_ASSOCIATION',
]);

const organizationCreateSchema = z.object({
  name: z.string().min(3).max(120),
  organizationType: organizationTypeSchema,
  chamaType: z.string().min(1).max(50).optional(),
  enabledModules: z.record(z.boolean()).optional(),
  slug: z.string().min(3).max(120).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

const organizationUpdateSchema = organizationCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED']).optional(),
});

const memberCreateSchema = z.object({
  userId: z.string().cuid().optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).default('MEMBER'),
  status: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']).default('PENDING_APPROVAL'),
});

const memberUpdateSchema = z.object({
  roleId: z.string().cuid().optional(),
  status: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']).optional(),
});

const contributionCreateSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive(),
  contributionType: z.string().min(1),
  period: z.string().min(1).optional(),
  paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']),
  reference: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'PAID']).default('PAID'),
  paidAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
const markContributionPaidSchema = z.object({ paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']), reference: z.string().trim().max(120).optional(), paidAt: z.string().datetime().optional() });

const loanApplySchema = z.object({
  memberId: z.string().cuid().optional(),
  amountRequested: z.number().positive(),
  purpose: z.string().max(500).optional(),
  interestRate: z.number().min(0).max(100).default(0),
  repaymentPeriodMonths: z.number().int().min(1).max(60).default(6),
  guarantors: z.array(z.string().cuid()).default([]),
});

const guaranteeDecisionSchema = z.object({
  guaranteedAmount: z.number().positive().optional(),
});

const loanRepaySchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']).default('CASH'),
  reference: z.string().min(1).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

const reverseContributionSchema = z.object({
  reason: z.string().min(1),
});
const investmentAssetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(['TREASURY_BOND', 'MONEY_MARKET', 'REAL_ESTATE', 'SHARES', 'BUSINESS', 'OTHER']),
  purchaseDate: z.string().date(),
  purchaseCost: z.number().positive(),
  currentValue: z.number().min(0),
  units: z.number().positive().default(1),
  status: z.enum(['ACTIVE', 'MATURED', 'SOLD']).default('ACTIVE'),
  notes: z.string().trim().max(500).optional(),
});

const welfareCreateSchema = z.object({
  memberId: z.string().cuid(),
  claimType: z.string().min(1),
  reason: z.string().min(1),
  amountRequested: z.number().positive(),
  documents: z.array(z.string()).default([]),
});

const meetingCreateSchema = z.object({
  title: z.string().min(3),
  dateTime: z.string().datetime(),
  venue: z.string().min(1).optional(),
  agenda: z.array(z.string()).default([]),
});

const meetingUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  dateTime: z.string().datetime().optional(),
  venue: z.string().min(1).optional(),
  agenda: z.array(z.string()).optional(),
  status: z.enum(['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
});

const attendanceSchema = z.object({
  memberId: z.string().cuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'APOLOGY']).default('PRESENT'),
  notes: z.string().optional(),
});

const voteCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  options: z.array(z.string().min(1)).min(2),
  closesAt: z.string().datetime().optional(),
  quorumRequired: z.number().int().min(0).default(0),
  isAnonymous: z.boolean().default(false),
});

const voteResponseSchema = z.object({
  selectedOption: z.string().min(1),
});

async function getOrganizationAccess(organizationId: string, userId: string) {
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      role: true,
      organization: true,
      user: true,
    },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new ForbiddenError('Active membership required for this organization');
  }

  return membership;
}

function isOwnerLike(roleName: string) {
  return roleName === 'OWNER' || roleName === 'FOUNDER' || roleName === 'ADMIN';
}

function isFinanceManager(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  return isOwnerLike((membership.role as any)?.name || '') || (membership.role as any)?.name === 'TREASURER';
}

function canViewAllFinancials(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  const roleName = (membership.role as any)?.name || '';
  return isFinanceManager(membership) || roleName === 'AUDITOR' || hasOrganizationPermission(membership, 'VIEW_FINANCIALS');
}

function isWelfareApprover(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  const roleName = ((membership.role as any)?.name || '') as string;
  return isOwnerLike(roleName) || roleName === 'CHAIR';
}

async function requireAcceptedLoanGuarantees(loanId: string, requiredGuarantors = 1) {
  const guarantors = await db.loanGuarantor.findMany({ where: { loanId } });
  if (guarantors.length < requiredGuarantors) {
    throw new BadRequestError(`Loan requires at least ${requiredGuarantors} guarantor${requiredGuarantors === 1 ? '' : 's'} before it can proceed`);
  }

  const pendingOrDeclined = guarantors.filter((guarantor: any) => guarantor.status !== 'ACTIVE');
  if (pendingOrDeclined.length > 0) {
    throw new BadRequestError('All requested guarantors must accept before the loan can proceed');
  }
}

function getRequiredGuarantorCount(rawRules: any): number {
  const ruleValue = rawRules?.guarantorsRequired;
  if (typeof ruleValue === 'boolean') {
    return ruleValue ? 1 : 0;
  }

  const numericRule = Number(ruleValue);
  if (Number.isFinite(numericRule)) {
    return Math.max(0, Math.floor(numericRule));
  }

  return 1;
}

function getRuleNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function isMeetingManager(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  const roleName = ((membership.role as any)?.name || '') as string;
  return isOwnerLike(roleName) || roleName === 'SECRETARY';
}

function isVoteManager(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  const roleName = ((membership.role as any)?.name || '') as string;
  return isOwnerLike(roleName) || roleName === 'CHAIR';
}

function hasOrganizationPermission(membership: Awaited<ReturnType<typeof getOrganizationAccess>>, permissionKey: string) {
  if (isOwnerLike((membership.role as any)?.name || '')) {
    return true;
  }

  const permissions = ((membership.role as any)?.permissions as unknown) as string[] | null | undefined;
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }

  return permissions.includes(permissionKey);
}

function canManageOrganizationLifecycle(membership: Awaited<ReturnType<typeof getOrganizationAccess>>) {
  return isOwnerLike((membership.role as any)?.name || '') || hasOrganizationPermission(membership, 'EDIT_ORGANIZATION') || hasOrganizationPermission(membership, 'MANAGE_SETTINGS');
}

async function requireOrganizationStatus(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true, chama: { select: { id: true } }, settings: { select: { loanRules: true } } },
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization;
}

async function updateOrganizationLifecycle(params: {
  organizationId: string;
  userId: string;
  targetStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';
}) {
  const organization = await requireOrganizationStatus(params.organizationId);
  const membership = await getOrganizationAccess(params.organizationId, params.userId);

  if (!canManageOrganizationLifecycle(membership)) {
    throw new ForbiddenError('Insufficient permissions to change organization lifecycle');
  }

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['SUSPENDED', 'CLOSED'],
    SUSPENDED: ['ACTIVE', 'CLOSED'],
    CLOSED: ['ARCHIVED'],
    ARCHIVED: [],
  };

  if (!allowedTransitions[organization.status]?.includes(params.targetStatus)) {
    throw new BadRequestError('Cannot transition organization from ' + organization.status + ' to ' + params.targetStatus);
  }

  const before = await db.organization.findUnique({ where: { id: params.organizationId } });
  const updated = await db.organization.update({
    where: { id: params.organizationId },
    data: { status: params.targetStatus as any },
  });

  await writeOrganizationAudit({
    organizationId: params.organizationId,
    userId: params.userId,
    action: 'UPDATE',
    entityType: 'Organization',
    entityId: params.organizationId,
    oldValues: before,
    newValues: updated,
    metadata: { targetStatus: params.targetStatus },
  });

  return updated;
}
async function writeOrganizationAudit(params: {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
}) {
  await db.organizationAuditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action as any,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues as any,
      newValues: params.newValues as any,
      metadata: params.metadata as any,
    },
  });
}

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
          contributionRules: {},
          welfareRules: {},
          loanRules: {},
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
    if (payload.status === 'ACTIVE') {
      const existingMember = await db.organizationMember.findUnique({ where: { id: memberId } });
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

    await db.organizationMember.delete({ where: { id: memberId } });

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
    const contribution = await runFinancialTransaction(async (tx: any) => {
      const created = await tx.contribution.create({ data: {
        chamaId: linkedChamaId, organizationId: id, memberId: payload.memberId, amount: payload.amount,
        contributionType: payload.contributionType, period: payload.period, paymentMethod: payload.paymentMethod as any,
        reference: payload.reference, recordedById: req.user!.id as string, status: payload.status as any,
        paidAt, paidDate: paidAt, dueDate: payload.period ? new Date(`${payload.period}-01T00:00:00.000Z`) : new Date(),
      } });
      if (payload.status === 'PAID') {
        const reference = payload.reference || `CONTRIBUTION-${created.id}`;
        await tx.transaction.create({ data: { chamaId: linkedChamaId, organizationId: id, type: 'CONTRIBUTION', amount: payload.amount, fromMemberId: payload.memberId, reference, idempotencyKey: ledgerKey, status: 'COMPLETED', metadata: { contributionId: created.id, paymentMethod: payload.paymentMethod } } });
        await tx.contribution.update({ where: { id: created.id }, data: { transactionRef: reference, reference } });
        await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: payload.amount } } });
        await allocatePaidContribution(tx, { ...created, organizationId: id, status: 'PAID', period: payload.period });
      }
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'CREATE', entityType: 'Contribution', entityId: created.id, newValues: created, metadata: { idempotencyKey: ledgerKey } } });
      return tx.contribution.findUnique({ where: { id: created.id } });
    });

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

    const reversed = await runFinancialTransaction(async (tx: any) => {
      const updated = await tx.contribution.update({ where: { id: contributionId }, data: { status: 'REVERSED', reverseReason: payload.reason, reversedAt: new Date(), reversedById: req.user!.id } });
      if (existing.status === 'PAID') {
        await removeContributionAllocation(tx, existing);
        const wallet = await tx.organizationWallet.findUnique({ where: { organizationId: id } });
        if (!wallet || Number(wallet.balance) < Number(existing.amount)) throw new BadRequestError('Wallet balance is lower than this contribution; reconcile the ledger before reversing it');
        await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { decrement: existing.amount } } });
        if (existing.transactionRef) await tx.transaction.updateMany({ where: { organizationId: id, reference: existing.transactionRef, type: 'CONTRIBUTION', status: 'COMPLETED' }, data: { status: 'REVERSED' } });
      }
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { reverseReason: payload.reason } } });
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

    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
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
      newValues: claim,
      metadata: { reviewedAction: 'APPROVED' },
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

    const { id, claimId } = req.params as { id: string; claimId: string };
    const access = await getOrganizationAccess(id, (req.user.id as string));
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only Treasurer or Admin can mark welfare claims as paid');
    }

    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
    }

    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {
      throw new BadRequestError('Only approved welfare claims can be marked as paid');
    }

    const claim = await db.welfareClaim.update({
      where: { id: claimId },
      data: {
        status: 'PAID' as any,
        paidAt: new Date(),
        reviewedById: existing.reviewedById ?? (req.user.id as string),
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
      metadata: { paid: true },
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

    const existing = await db.welfareClaim.findUnique({ where: { id: claimId } });
    if (!existing || existing.organizationId !== id) {
      throw new NotFoundError('Welfare claim not found');
    }

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
      newValues: claim,
      metadata: { reviewedAction: 'REJECTED' },
    });

    res.json({ claim });
  })
);

router.post(
  '/:id/meetings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'CREATE_MEETINGS')) {
      throw new ForbiddenError('Insufficient permissions to create meetings');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot create meetings');
    }

    const payload = meetingCreateSchema.parse(req.body);
    const meeting = await db.meeting.create({
      data: {
        organizationId: id,
        createdById: req.user.id as string,
        title: payload.title,
        dateTime: new Date(payload.dateTime),
        venue: payload.venue,
        agenda: payload.agenda,
        scheduledFor: new Date(payload.dateTime),
        location: payload.venue,
        status: 'SCHEDULED' as any,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'Meeting',
      entityId: meeting.id,
      newValues: meeting,
    });

    res.status(201).json({ meeting });
  })
);

router.get(
  '/:id/meetings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id as string);

    const meetings = await db.meeting.findMany({
      where: { organizationId: id },
      orderBy: { dateTime: 'desc' },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    res.json({ meetings });
  })
);

router.get(
  '/:id/meetings/:meetingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const meeting = await db.meeting.findFirst({
      where: { id: meetingId, organizationId: id },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    res.json({ meeting });
  })
);

router.patch(
  '/:id/meetings/:meetingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'CREATE_MEETINGS')) {
      throw new ForbiddenError('Insufficient permissions to update meetings');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot be updated');
    }

    const payload = meetingUpdateSchema.parse(req.body);
    const existing = await db.meeting.findFirst({
      where: { id: meetingId, organizationId: id },
    });
    if (!existing) {
      throw new NotFoundError('Meeting not found');
    }

    const meeting = await db.meeting.update({
      where: { id: meetingId },
      data: {
        title: payload.title,
        dateTime: payload.dateTime ? new Date(payload.dateTime) : undefined,
        venue: payload.venue,
        agenda: payload.agenda,
        status: payload.status as any,
        scheduledFor: payload.dateTime ? new Date(payload.dateTime) : undefined,
        location: payload.venue,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Meeting',
      entityId: meetingId,
      oldValues: existing,
      newValues: meeting,
    });

    res.json({ meeting });
  })
);

router.get(
  '/:id/meetings/:meetingId/attendance',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const attendance = await db.meetingAttendance.findMany({
      where: { organizationId: id, meetingId },
      include: { member: true, recordedBy: true },
      orderBy: { recordedAt: 'desc' },
    });

    res.json({ attendance });
  })
);

router.post(
  '/:id/meetings/:meetingId/attendance',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'MANAGE_ATTENDANCE')) {
      throw new ForbiddenError('Insufficient permissions to record attendance');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot record attendance');
    }

    const payload = attendanceSchema.parse(req.body);
    const attendance = await db.meetingAttendance.upsert({
      where: { meetingId_memberId: { meetingId, memberId: payload.memberId } },
      create: {
        organizationId: id,
        meetingId,
        memberId: payload.memberId,
        status: payload.status as any,
        notes: payload.notes,
        recordedById: req.user.id as string,
      },
      update: {
        status: payload.status as any,
        notes: payload.notes,
        recordedById: req.user.id as string,
      },
      include: { member: true, recordedBy: true },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'MeetingAttendance',
      entityId: attendance.id,
      newValues: attendance,
    });

    res.status(201).json({ attendance });
  })
);

router.post(
  '/:id/meetings/:meetingId/minutes',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'RECORD_MINUTES')) {
      throw new ForbiddenError('Insufficient permissions to record minutes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot record minutes');
    }

    const minutes = z.object({
      minutes: z.array(z.string()).default([]),
      resolutions: z.array(z.string()).default([]),
      actionItems: z.array(z.string()).default([]),
    }).parse(req.body);

    const existing = await db.meeting.findFirst({ where: { id: meetingId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Meeting not found');
    }

    const meeting = await db.meeting.update({
      where: { id: meetingId },
      data: {
        minutes,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Meeting',
      entityId: meetingId,
      oldValues: existing,
      newValues: meeting,
      metadata: { minutesRecorded: true },
    });

    res.json({ meeting });
  })
);

router.post(
  '/:id/meetings/:meetingId/votes',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isVoteManager(access) && !hasOrganizationPermission(access, 'MANAGE_VOTING')) {
      throw new ForbiddenError('Insufficient permissions to create votes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot create votes');
    }

    const payload = voteCreateSchema.parse(req.body);
    const meeting = await db.meeting.findFirst({ where: { id: meetingId, organizationId: id } });
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    const linkedChamaId = (currentOrganization as any).chama?.id;
    if (!linkedChamaId) {
      throw new BadRequestError('Organization is not linked to a Chama');
    }

    const vote = await db.vote.create({
      data: {
        chamaId: linkedChamaId,
        organizationId: id,
        meetingId,
        createdById: req.user.id as string,
        title: payload.title,
        description: payload.description,
        type: 'SIMPLE' as any,
        quorumRequired: payload.quorumRequired,
        startDate: new Date(),
        endDate: payload.closesAt ? new Date(payload.closesAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        closesAt: payload.closesAt ? new Date(payload.closesAt) : null,
        status: 'ACTIVE' as any,
        isAnonymous: payload.isAnonymous,
        options: {
          create: payload.options.map((option) => ({ text: option })),
        },
      },
      include: {
        options: true,
        responses: true,
        createdBy: true,
        closedBy: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'Vote',
      entityId: vote.id,
      newValues: vote,
    });

    res.status(201).json({ vote });
  })
);

router.get(
  '/:id/meetings/:meetingId/votes',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const votes = await db.vote.findMany({
      where: { organizationId: id, meetingId },
      include: {
        options: true,
        responses: { include: { member: true } },
        createdBy: true,
        closedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ votes });
  })
);

router.patch(
  '/:id/votes/:voteId/close',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isVoteManager(access) && !hasOrganizationPermission(access, 'MANAGE_VOTING')) {
      throw new ForbiddenError('Insufficient permissions to close votes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot close votes');
    }

    const existing = await db.vote.findFirst({ where: { id: voteId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Vote not found');
    }

    const vote = await db.vote.update({
      where: { id: voteId },
      data: {
        status: 'CLOSED' as any,
        closedById: req.user.id as string,
        closesAt: new Date(),
      },
      include: {
        options: true,
        responses: { include: { member: true } },
        createdBy: true,
        closedBy: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Vote',
      entityId: voteId,
      oldValues: existing,
      newValues: vote,
      metadata: { closed: true },
    });

    res.json({ vote });
  })
);

router.post(
  '/:id/votes/:voteId/response',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept votes');
    }

    const payload = voteResponseSchema.parse(req.body);
    const vote = await db.vote.findFirst({
      where: { id: voteId, organizationId: id },
      include: { options: true },
    });
    if (!vote) {
      throw new NotFoundError('Vote not found');
    }

    if (vote.status !== 'ACTIVE') {
      throw new BadRequestError('Vote is not open');
    }

    const optionExists = vote.options.some((option: { text: string }) => option.text === payload.selectedOption);
    if (!optionExists) {
      throw new BadRequestError('Invalid vote option');
    }

    const response = await db.voteCast.upsert({
      where: { voteId_memberId: { voteId, memberId: req.user.id as string } },
      create: {
        organizationId: id,
        voteId,
        memberId: req.user.id as string,
        selectedOption: payload.selectedOption,
        votedAt: new Date(),
      },
      update: {
        selectedOption: payload.selectedOption,
        votedAt: new Date(),
      },
      include: { member: true, vote: { include: { options: true } } },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'VoteCast',
      entityId: response.id,
      newValues: response,
    });

    res.status(201).json({ response });
  })
);

router.get(
  '/:id/votes/:voteId/results',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const vote = await db.vote.findFirst({
      where: { id: voteId, organizationId: id },
      include: {
        options: true,
        responses: true,
        createdBy: true,
        closedBy: true,
      },
    });
    if (!vote) {
      throw new NotFoundError('Vote not found');
    }

    const counts = vote.options.map((option: { text: string }) => ({
      option: option.text,
      votes: vote.responses.filter((response: { selectedOption: string }) => response.selectedOption === option.text).length,
    }));

    res.json({
      vote,
      results: counts,
      totalResponses: vote.responses.length,
    });
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
  const contribution = await runFinancialTransaction(async (tx: any) => {
    const reference = payload.reference || `CONTRIBUTION-${contributionId}`;
    const updated = await tx.contribution.update({ where: { id: contributionId }, data: { status: 'PAID', paymentMethod: payload.paymentMethod, reference, transactionRef: reference, paidAt, paidDate: paidAt, recordedById: req.user!.id } });
    await allocatePaidContribution(tx, updated);
    await tx.transaction.create({ data: { chamaId: linkedChamaId, organizationId: id, type: 'CONTRIBUTION', amount: existing.amount, fromMemberId: existing.memberId, reference, idempotencyKey: `organization:${id}:contribution:${contributionId}:mark-paid`, status: 'COMPLETED', metadata: { contributionId, paymentMethod: payload.paymentMethod } } });
    await tx.organizationWallet.update({ where: { organizationId: id }, data: { balance: { increment: existing.amount } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'Contribution', entityId: contributionId, oldValues: existing, newValues: updated, metadata: { operation: 'MANUAL_MARK_PAID', paymentMethod: payload.paymentMethod } } });
    return updated;
  });
  res.json({ contribution, message: 'Member contribution marked as paid.' });
}));

router.get('/:id/investments', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user.id);
  const organization = await db.organization.findUnique({ where: { id }, select: { metadata: true } });
  if (!organization) throw new NotFoundError('Organization not found');
  const metadata = (organization.metadata ?? {}) as Record<string, any>;
  const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
  const purchaseCost = assets.filter((asset: any) => asset.status !== 'SOLD').reduce((sum: number, asset: any) => sum + Number(asset.purchaseCost ?? 0), 0);
  const currentValue = assets.filter((asset: any) => asset.status !== 'SOLD').reduce((sum: number, asset: any) => sum + Number(asset.currentValue ?? 0), 0);
  const [paidByMember, members] = await Promise.all([
    db.contribution.groupBy({ by: ['memberId'], where: { organizationId: id, status: 'PAID' }, _sum: { amount: true } }),
    db.organizationMember.findMany({ where: { organizationId: id, status: 'ACTIVE' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
  ]);
  const contributionsByMember = new Map(paidByMember.map((row: any) => [row.memberId, Number(row._sum.amount ?? 0)]));
  const totalMemberCapital = [...contributionsByMember.values()].reduce((sum: number, amount: any) => sum + Number(amount), 0);
  const allPositions = members.map((member: any) => {
    const contributed = Number(contributionsByMember.get(member.userId) ?? 0);
    const ownershipPercent = totalMemberCapital ? (contributed / totalMemberCapital) * 100 : 0;
    const estimatedValue = currentValue * ownershipPercent / 100;
    return { memberId: member.userId, member: member.user, contributed, ownershipPercent, estimatedValue, estimatedGain: (currentValue - purchaseCost) * ownershipPercent / 100 };
  });
  const positions = canViewAllFinancials(access) ? allPositions : allPositions.filter((position: any) => position.memberId === req.user!.id);
  res.json({ assets, positions, summary: { assetCount: assets.length, activeAssets: assets.filter((asset: any) => asset.status === 'ACTIVE').length, purchaseCost, currentValue, gainLoss: currentValue - purchaseCost, returnPercent: purchaseCost ? ((currentValue - purchaseCost) / purchaseCost) * 100 : 0, totalMemberCapital } });
}));

router.post('/:id/investments', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id } = req.params as { id: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!isFinanceManager(access)) throw new ForbiddenError('Only Treasurer or Admin can manage investments');
  const payload = investmentAssetSchema.parse(req.body);
  const asset = { id: randomUUID(), ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: req.user.id };
  await db.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`investment-portfolio:${id}`}))`;
    const organization = await tx.organization.findUnique({ where: { id }, select: { metadata: true } });
    if (!organization) throw new NotFoundError('Organization not found');
    const metadata = (organization.metadata ?? {}) as Record<string, any>;
    const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
    await tx.organization.update({ where: { id }, data: { metadata: { ...metadata, investmentPortfolio: [...assets, asset] } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'CREATE', entityType: 'InvestmentAsset', entityId: asset.id, newValues: asset } });
  });
  res.status(201).json({ asset });
}));

router.patch('/:id/investments/:assetId', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new BadRequestError('User not authenticated');
  const { id, assetId } = req.params as { id: string; assetId: string };
  const access = await getOrganizationAccess(id, req.user.id);
  if (!isFinanceManager(access)) throw new ForbiddenError('Only Treasurer or Admin can manage investments');
  const payload = investmentAssetSchema.partial().parse(req.body);
  let updatedAsset: any;
  await db.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`investment-portfolio:${id}`}))`;
    const organization = await tx.organization.findUnique({ where: { id }, select: { metadata: true } });
    if (!organization) throw new NotFoundError('Organization not found');
    const metadata = (organization.metadata ?? {}) as Record<string, any>;
    const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
    const index = assets.findIndex((asset: any) => asset.id === assetId);
    if (index < 0) throw new NotFoundError('Investment asset not found');
    const oldAsset = assets[index]; updatedAsset = { ...oldAsset, ...payload, updatedAt: new Date().toISOString() };
    assets[index] = updatedAsset;
    await tx.organization.update({ where: { id }, data: { metadata: { ...metadata, investmentPortfolio: assets } } });
    await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'InvestmentAsset', entityId: assetId, oldValues: oldAsset, newValues: updatedAsset } });
  });
  res.json({ asset: updatedAsset });
}));

router.get(
  '/:id/audit-logs',
  authenticate,
  requireSubscriptionFeature('AUDIT_LOGS'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!canViewAllFinancials(access) && !hasOrganizationPermission(access, 'VIEW_AUDIT_LOGS')) throw new ForbiddenError('Only authorized finance and audit roles can view audit logs');

    const logs = await db.organizationAuditLog.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ logs });
  })
);

export { router as organizationRouter };







