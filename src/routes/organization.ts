import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { auditLog } from '../config/logger';
import { subscriptionPlans } from '../config/subscriptions';
import { subscriptionLifecycleService } from '../services/subscriptionLifecycleService';
import { evaluateWelfareEligibility } from '../services/welfareGuardrails';
import { registerReportsRoutes } from './organization/reports.routes';
import { registerInvestmentsRoutes } from './organization/investments.routes';

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

const isFounderRole = (roleName?: string | null) => ['OWNER', 'FOUNDER'].includes((roleName ?? '').toUpperCase());

const contributionCreateSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive(),
  contributionType: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be a valid YYYY-MM month').optional(),
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
const welfareTransitionSchema = z.object({ comment: z.string().trim().max(500).optional() }).default({});

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

const OrganizationPermission = {
  WELFARE_CLAIM_CREATE: 'WELFARE_CLAIM_CREATE',
  WELFARE_CLAIM_APPROVE: 'WELFARE_CLAIM_APPROVE',
  WELFARE_PAYOUT: 'WELFARE_PAYOUT',
  LOAN_APPROVE: 'LOAN_APPROVE',
  LOAN_DISBURSE: 'LOAN_DISBURSE',
  LOAN_APPLY_FOR_OTHERS: 'LOAN_APPLY_FOR_OTHERS',
  CONTRIBUTION_RECORD: 'CONTRIBUTION_RECORD',
  CONTRIBUTION_REVERSE: 'CONTRIBUTION_REVERSE',
  VIEW_FINANCIAL_REPORTS: 'VIEW_FINANCIAL_REPORTS',
  MANAGE_ROLES: 'MANAGE_ROLES',
} as const;

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
    select: { id: true, status: true, metadata: true, chama: { select: { id: true } }, settings: { select: { loanRules: true, contributionRules: true } } },
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization;
}

function resolveWelfareRulesFromMetadata(metadata: unknown): any {
  if (!metadata || typeof metadata !== 'object') return {};
  const source = metadata as Record<string, any>;
  return source.welfareRules ?? source.welfare ?? {};
}

function resolveWelfareApprovalPolicy(metadata: unknown, _claimType?: string, amountRequested = 0) {
  const ruleSet = resolveWelfareRulesFromMetadata(metadata);
  const approvalMode = String(ruleSet.approvalMode ?? 'COMMITTEE').toUpperCase();
  const thresholdPercent = Number(ruleSet.approvalThreshold ?? 60);
  const maxClaimAmount = Number(ruleSet.maxClaimAmount ?? Number.POSITIVE_INFINITY);
  const totalPossibleApprovers = Math.max(2, Number((metadata as any)?.committeeSize ?? 2));
  const requiredApprovals = Math.max(1, Math.ceil((thresholdPercent / 100) * totalPossibleApprovers));
  const autoApproveWithinLimits = approvalMode === 'AUTO' && Number(amountRequested) <= maxClaimAmount;

  return {
    approvalMode,
    thresholdPercent,
    totalPossibleApprovers,
    requiredApprovals,
    autoApproveWithinLimits,
  };
}

async function enforceWelfareEligibility(organizationId: string, memberId: string, claimType: string, amountRequested: number, documents: string[]) {
  const organization = await requireOrganizationStatus(organizationId);
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: memberId,
      },
    },
  });

  const ruleSet = resolveWelfareRulesFromMetadata(organization.metadata);
  const result = evaluateWelfareEligibility({
    organization,
    member: membership,
    rules: ruleSet,
    memberId,
    claimType,
    amountRequested,
    documents,
  });

  if (!result.valid) {
    const firstError = result.errors[0];
    if (firstError?.includes('disabled') || firstError?.includes('not linked') || firstError?.includes('not enabled')) {
      throw new ForbiddenError(firstError);
    }
    throw new BadRequestError(firstError || 'Welfare claim is not eligible');
  }

  return { organization, linkedChamaId: organization.chama?.id, ruleSet, selectedCategory: result.selectedCategory };
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


import { registerSettingsRoutes } from './organization/settings.routes';
import { registerMembersRoutes } from './organization/members.routes';
import { registerContributionsRoutes } from './organization/contributions.routes';
import { registerLoansRoutes } from './organization/loans.routes';
import { registerWelfareRoutes } from './organization/welfare.routes';
import { registerMeetingsRoutes } from './organization/meetings.routes';
import { registerVotingRoutes } from './organization/voting.routes';

registerSettingsRoutes(router, { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog });
registerMembersRoutes(router, { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit });
registerContributionsRoutes(router, { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit });
registerLoansRoutes(router, { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit });
registerWelfareRoutes(router, { db, welfareCreateSchema, welfareTransitionSchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit });
registerMeetingsRoutes(router, { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit });
registerVotingRoutes(router, { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit });
registerInvestmentsRoutes(router, { db, investmentAssetSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager });
registerReportsRoutes(router, { db, getOrganizationAccess, canViewAllFinancials, hasOrganizationPermission });

export { router as organizationRouter };
