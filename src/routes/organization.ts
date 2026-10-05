import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { runFinancialTransaction } from '../services/financialTransactionService';
import { updateOrganizationLifecycle as transitionOrganizationLifecycle } from '../services/organizationLifecycleService';
import { enforceWelfareEligibility as validateWelfareEligibility } from '../services/welfareEligibilityService';
import { writeOrganizationAudit as persistOrganizationAudit } from '../services/organizationAuditService';
import { OrganizationPermission, isOwnerLike, isOwnerLikeAccess, hasOrganizationPermission, isFinanceManager, canViewAllFinancials, isWelfareApprover, isMeetingManager, isVoteManager, canManageOrganizationLifecycle, getRequiredGuarantorCount, getRuleNumber, resolveWelfareApprovalPolicy } from '../services/organizationPolicyService';
import { organizationCreateSchema, organizationUpdateSchema, memberCreateSchema, memberUpdateSchema } from '../schemas/organization';
import { contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, submitContributionPaymentSchema, reviewContributionPaymentSchema, loanApplySchema, loanDecisionSchema, disputeCreateSchema, disputeStatusSchema, guaranteeDecisionSchema, loanRepaySchema, investmentAssetSchema, welfareCreateSchema, welfareTransitionSchema, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, voteCreateSchema, voteResponseSchema } from '../schemas/organizationWorkflows';
import { BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { auditLog } from '../config/logger';
import { subscriptionPlans } from '../config/subscriptions';
import { subscriptionLifecycleService } from '../services/subscriptionLifecycleService';
import { registerReportsRoutes } from './organization/reports.routes';
import { registerOrganizationDocumentsRoutes } from './organization/documents.routes';
import { registerInvestmentsRoutes } from './organization/investments.routes';

const router = Router();
const db = prisma;
const inviteTokenSchema = z.string().uuid();
async function requireMemberCapacity(organizationId: string) {
  const subscription = await subscriptionLifecycleService.reconcileOrganization(organizationId);
  if (!['ACTIVE', 'PAST_DUE'].includes(subscription.status)) throw new ForbiddenError('This chama subscription is inactive. Ask an administrator to review its plan.');
  const limit = subscriptionPlans[subscription.plan].memberLimit;
  if (limit === null) return;
  const activeMembers = await prisma.organizationMember.count({ where: { organizationId, status: 'ACTIVE' } });
  if (activeMembers >= limit) throw new ForbiddenError(`This chama has reached its ${subscriptionPlans[subscription.plan].name} plan limit of ${limit} active members. Upgrade the chama plan to add more members.`);
}

const isFounderRole = (roleName?: string | null) => ['OWNER', 'FOUNDER'].includes((roleName ?? '').toUpperCase());

async function getOrganizationAccess(organizationId: string, userId: string) {
  const membership = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { role: true, organization: true, user: true },
  });
  if (!membership || membership.status !== 'ACTIVE') {
    throw new ForbiddenError('Active membership required for this organization');
  }
  // Ownership is independent of role: the chama creator keeps every owner
  // privilege even when holding an officer role (Chairperson, Treasurer,
  // Secretary, etc.). All permission helpers receive this flag.
  return Object.assign(membership, { isCreator: membership.organization?.createdById === userId });
}

async function requireAcceptedLoanGuarantees(loanId: string, requiredGuarantors = 1) {
  const guarantors = await db.loanGuarantor.findMany({ where: { loanId } });
  if (guarantors.length < requiredGuarantors) {
    throw new BadRequestError(`Loan requires at least ${requiredGuarantors} guarantor${requiredGuarantors === 1 ? '' : 's'} before it can proceed`);
  }
  if (guarantors.some((guarantor: any) => guarantor.status !== 'ACTIVE')) {
    throw new BadRequestError('All requested guarantors must accept before the loan can proceed');
  }
}

async function requireOrganizationStatus(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, status: true, metadata: true, enabledModules: true, chama: { select: { id: true } }, settings: { select: { loanRules: true, contributionRules: true, welfareRules: true } } },
  });
  if (!organization) throw new NotFoundError('Organization not found');
  return { ...organization, metadata: (organization.metadata && typeof organization.metadata === 'object' ? organization.metadata : {}) as Record<string, unknown> };
}

// Module scoping: optional modules (welfare, loans, investments, voting) are
// only available to chamas that enabled them at creation/in settings. This is
// the backend guarantee behind the hidden nav items — a savings-only chama
// cannot hit the welfare API directly.
async function requireModuleEnabled(organizationId: string, module: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { enabledModules: true, organizationType: true },
  });
  if (!organization) throw new NotFoundError('Organization not found');
  const modules = (organization.enabledModules && typeof organization.enabledModules === 'object' ? organization.enabledModules : {}) as Record<string, unknown>;
  // Default behaviour: modules not present in the record are considered
  // DISABLED only if they were never part of this org's type defaults — but a
  // missing key on an existing record is treated as disabled for optional
  // modules, matching the frontend `!== false`... we choose the stricter
  // explicit-off contract here: an unknown/absent key blocks the module.
  if (modules[module] === true) return;
  throw new ForbiddenError(`${module.charAt(0).toUpperCase()}${module.slice(1)} is not enabled for this group. Enable it in Settings before using this feature.`);
}

import { registerSettingsRoutes } from './organization/settings.routes';
import { registerPaymentMethodRoutes } from './organization/paymentMethods.routes';
import { registerPaymentsRoutes } from './organization/payments.routes';
import { registerMembersRoutes } from './organization/members.routes';
import { registerContributionsRoutes } from './organization/contributions.routes';
import { registerLoansRoutes } from './organization/loans.routes';
import { registerWelfareRoutes } from './organization/welfare.routes';
import { registerMeetingsRoutes } from './organization/meetings.routes';
import { registerVotingRoutes } from './organization/voting.routes';
import { registerDisputesRoutes } from './organization/disputes.routes';

const writeOrganizationAudit = (params: Parameters<typeof persistOrganizationAudit>[1]) => persistOrganizationAudit(db, params);
const enforceWelfareEligibility = (organizationId: string, memberId: string, claimType: string, amountRequested: number, documents: string[]) => validateWelfareEligibility(organizationId, memberId, claimType, amountRequested, documents, { requireOrganizationStatus, findMember: (organizationId, userId) => db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } }) });

registerSettingsRoutes(router, { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, isOwnerLikeAccess, hasOrganizationPermission, updateOrganizationLifecycle: (params: Parameters<typeof transitionOrganizationLifecycle>[0]) => transitionOrganizationLifecycle(params, { requireOrganizationStatus, getOrganizationAccess, canManageOrganizationLifecycle, updateOrganization: async (organizationId, status) => db.organization.update({ where: { id: organizationId }, data: { status: status as any } }), writeAudit: writeOrganizationAudit }), writeOrganizationAudit, auditLog });
registerPaymentMethodRoutes(router, { db, getOrganizationAccess, isFinanceManager, writeOrganizationAudit });
registerPaymentsRoutes(router, { db, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit });
registerMembersRoutes(router, { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit });
registerContributionsRoutes(router, { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, submitContributionPaymentSchema, reviewContributionPaymentSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit });
registerLoansRoutes(router, { db, loanApplySchema, loanDecisionSchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, requireModuleEnabled, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit });
registerWelfareRoutes(router, { db, welfareCreateSchema, welfareTransitionSchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, requireOrganizationStatus, requireModuleEnabled, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit });
registerMeetingsRoutes(router, { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit });
registerVotingRoutes(router, { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit });
registerDisputesRoutes(router, { db, disputeCreateSchema, disputeStatusSchema, getOrganizationAccess, isFinanceManager, isWelfareApprover, writeOrganizationAudit });
registerInvestmentsRoutes(router, { db, investmentAssetSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager });
registerReportsRoutes(router, { db, getOrganizationAccess, canViewAllFinancials, hasOrganizationPermission });
registerOrganizationDocumentsRoutes(router, { db, getOrganizationAccess, isOwnerLike, writeOrganizationAudit });

export { router as organizationRouter };
