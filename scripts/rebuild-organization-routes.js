const fs = require('fs');
const { execFileSync } = require('child_process');

const current = fs.readFileSync('src/routes/organization.ts', 'utf8');
const source = execFileSync('git', ['show', 'HEAD:src/routes/organization.ts'], { encoding: 'utf8' });
const routeStart = source.indexOf("router.get('/invites/:token'");
const routeEnd = source.indexOf("registerInvestmentsRoutes(router");
const routes = source.slice(routeStart, routeEnd);
const at = (marker) => routes.indexOf(marker);
const part = (start, end) => routes.slice(at(start), end ? at(end) : routes.length);
const markPaid = "router.post('/:id/contributions/:contributionId/mark-paid'";

const headers = {
  settings: `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerSettingsRoutes(router: Router, context: any): void {
  const { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog } = context;
`,
  members: `import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerMembersRoutes(router: Router, context: any): void {
  const { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit } = context;
`,
  contributions: `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { allocatePaidContribution, removeContributionAllocation } from '../../services/contributionAllocationService';
import { LedgerService } from '../../services/ledgerService';
export function registerContributionsRoutes(router: Router, context: any): void {
  const { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit } = context;
`,
  loans: `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerLoansRoutes(router: Router, context: any): void {
  const { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit } = context;
`,
  welfare: `import { Router, Request, Response } from 'express';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { LedgerService } from '../../services/ledgerService';
import { computeApprovalOutcome, validateWelfarePayout } from '../../services/welfareGuardrails';
export function registerWelfareRoutes(router: Router, context: any): void {
  const { db, welfareCreateSchema, welfareTransitionSchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit } = context;
`,
  meetings: `import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerMeetingsRoutes(router: Router, context: any): void {
  const { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit } = context;
`,
  voting: `import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';
export function registerVotingRoutes(router: Router, context: any): void {
  const { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit } = context;
`,
};

const groups = {
  settings: part("router.get('/invites/:token'", "router.post(\n  '/:id/members'"),
  members: part("router.post(\n  '/:id/members'", "router.post(\n  '/:id/contributions'"),
  contributions: `${part("router.post(\n  '/:id/contributions'", "router.post(\n  '/:id/loans/apply'")}\n${routes.slice(at(markPaid), at("router.get('/:id/investments'"))}`,
  loans: part("router.post(\n  '/:id/loans/apply'", "router.post(\n  '/:id/welfare/claims'"),
  welfare: part("router.post(\n  '/:id/welfare/claims'", "router.post(\n  '/:id/meetings'"),
  meetings: part("router.post(\n  '/:id/meetings'", "router.post(\n  '/:id/meetings/:meetingId/votes'"),
  voting: routes.slice(at("router.post(\n  '/:id/meetings/:meetingId/votes'"), at(markPaid)),
};

for (const [name, content] of Object.entries(groups)) {
  fs.writeFileSync(`src/routes/organization/${name}.routes.ts`, `${headers[name]}${content}\n}\n`);
}

const imports = `import { registerSettingsRoutes } from './organization/settings.routes';
import { registerMembersRoutes } from './organization/members.routes';
import { registerContributionsRoutes } from './organization/contributions.routes';
import { registerLoansRoutes } from './organization/loans.routes';
import { registerWelfareRoutes } from './organization/welfare.routes';
import { registerMeetingsRoutes } from './organization/meetings.routes';
import { registerVotingRoutes } from './organization/voting.routes';`;
const prefix = `${source.slice(0, routeStart)}\n${imports}`;
const registration = `registerSettingsRoutes(router, { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog });
registerMembersRoutes(router, { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit });
registerContributionsRoutes(router, { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit });
registerLoansRoutes(router, { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit });
registerWelfareRoutes(router, { db, welfareCreateSchema, welfareTransitionSchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit });
registerMeetingsRoutes(router, { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit });
registerVotingRoutes(router, { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit });
registerInvestmentsRoutes(router, { db, investmentAssetSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager });
registerReportsRoutes(router, { db, getOrganizationAccess, canViewAllFinancials, hasOrganizationPermission });

export { router as organizationRouter };`;
fs.writeFileSync('src/routes/organization.ts', `${prefix}\n\n${registration}\n`);