const fs = require('fs');
const file = 'src/routes/organization.ts';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const body = (from, to) => lines.slice(from - 1, to).join('\n');
const modules = {
  'settings.routes.ts': [418, 840, `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerSettingsRoutes(router: Router, context: any): void {
  const { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog } = context;
`],
  'members.routes.ts': [841, 1053, `import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerMembersRoutes(router: Router, context: any): void {
  const { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit } = context;
`],
  'contributions.routes.ts': [1054, 1231, `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { allocatePaidContribution, removeContributionAllocation } from '../../services/contributionAllocationService';
import { LedgerService } from '../../services/ledgerService';
export function registerContributionsRoutes(router: Router, context: any): void {
  const { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit } = context;
`],
  'loans.routes.ts': [1232, 1799, `import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerLoansRoutes(router: Router, context: any): void {
  const { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit } = context;
`],
  'welfare.routes.ts': [1800, 2162, `import { Router, Request, Response } from 'express';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { LedgerService } from '../../services/ledgerService';
import { computeApprovalOutcome, validateWelfarePayout } from '../../services/welfareGuardrails';
export function registerWelfareRoutes(router: Router, context: any): void {
  const { db, welfareCreateSchema, welfareTransitionSchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit } = context;
`],
  'meetings.routes.ts': [2163, 2404, `import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerMeetingsRoutes(router: Router, context: any): void {
  const { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit } = context;
`],
  'voting.routes.ts': [2405, 2716, `import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';
export function registerVotingRoutes(router: Router, context: any): void {
  const { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit } = context;
`],
};
for (const [name, [from, to, header]] of Object.entries(modules)) {
  const extra = name === 'contributions.routes.ts' ? `\n${body(2717, 2754)}` : '';
  fs.writeFileSync(`src/routes/organization/${name}`, `${header}\n${body(from, to)}${extra}\n}\n`);
}
const imports = `import { registerSettingsRoutes } from './organization/settings.routes';
import { registerMembersRoutes } from './organization/members.routes';
import { registerContributionsRoutes } from './organization/contributions.routes';
import { registerLoansRoutes } from './organization/loans.routes';
import { registerWelfareRoutes } from './organization/welfare.routes';
import { registerMeetingsRoutes } from './organization/meetings.routes';
import { registerVotingRoutes } from './organization/voting.routes';`;
const registrations = `registerSettingsRoutes(router, { db, inviteTokenSchema, organizationCreateSchema, organizationUpdateSchema, getOrganizationAccess, isOwnerLike, hasOrganizationPermission, updateOrganizationLifecycle, writeOrganizationAudit, auditLog });
registerMembersRoutes(router, { db, memberCreateSchema, memberUpdateSchema, getOrganizationAccess, hasOrganizationPermission, isOwnerLike, isFounderRole, requireOrganizationStatus, requireMemberCapacity, writeOrganizationAudit });
registerContributionsRoutes(router, { db, contributionCreateSchema, markContributionPaidSchema, reverseContributionSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager, requireOrganizationStatus, runFinancialTransaction, writeOrganizationAudit });
registerLoansRoutes(router, { db, loanApplySchema, guaranteeDecisionSchema, loanRepaySchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, getRequiredGuarantorCount, requireAcceptedLoanGuarantees, getRuleNumber, runFinancialTransaction, writeOrganizationAudit });
registerWelfareRoutes(router, { db, welfareCreateSchema, welfareTransitionSchema, OrganizationPermission, getOrganizationAccess, hasOrganizationPermission, isFinanceManager, isWelfareApprover, requireOrganizationStatus, enforceWelfareEligibility, resolveWelfareApprovalPolicy, runFinancialTransaction, writeOrganizationAudit });
registerMeetingsRoutes(router, { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit });
registerVotingRoutes(router, { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, isVoteManager, requireOrganizationStatus, writeOrganizationAudit });
registerInvestmentsRoutes(router, { db, investmentAssetSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager });
registerReportsRoutes(router, { db, getOrganizationAccess, canViewAllFinancials, hasOrganizationPermission });

export { router as organizationRouter };`;
let prefix = lines.slice(0, 417).join('\n');
prefix += `\n${imports}`;
fs.writeFileSync(file, `${prefix}\n\n${registrations}\n`);