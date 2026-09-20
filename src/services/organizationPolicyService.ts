export const OrganizationPermission = {
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

type OrganizationAccess = { role?: { name?: string | null; permissions?: unknown } | null };

export const isOwnerLike = (roleName?: string | null) => ['OWNER', 'FOUNDER', 'ADMIN'].includes((roleName ?? '').toUpperCase());
export const hasOrganizationPermission = (membership: OrganizationAccess, permissionKey: string) => {
  if (isOwnerLike(membership.role?.name)) return true;
  return Array.isArray(membership.role?.permissions) && membership.role.permissions.includes(permissionKey);
};
export const isFinanceManager = (membership: OrganizationAccess) => isOwnerLike(membership.role?.name) || membership.role?.name === 'TREASURER';
export const canViewAllFinancials = (membership: OrganizationAccess) => isFinanceManager(membership) || membership.role?.name === 'AUDITOR' || hasOrganizationPermission(membership, 'VIEW_FINANCIALS');
export const isWelfareApprover = (membership: OrganizationAccess) => isOwnerLike(membership.role?.name) || membership.role?.name === 'CHAIR';
export const isMeetingManager = (membership: OrganizationAccess) => isOwnerLike(membership.role?.name) || membership.role?.name === 'SECRETARY';
export const isVoteManager = (membership: OrganizationAccess) => isOwnerLike(membership.role?.name) || membership.role?.name === 'CHAIR';
export const canManageOrganizationLifecycle = (membership: OrganizationAccess) => isOwnerLike(membership.role?.name) || hasOrganizationPermission(membership, 'EDIT_ORGANIZATION') || hasOrganizationPermission(membership, 'MANAGE_SETTINGS');

export const getRequiredGuarantorCount = (rawRules: any): number => {
  const ruleValue = rawRules?.guarantorsRequired;
  if (typeof ruleValue === 'boolean') return ruleValue ? 1 : 0;
  const numericRule = Number(ruleValue);
  return Number.isFinite(numericRule) ? Math.max(0, Math.floor(numericRule)) : 1;
};

export const getRuleNumber = (value: unknown, fallback: number): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const resolveWelfareRulesFromMetadata = (metadata: unknown): any => {
  if (!metadata || typeof metadata !== 'object') return {};
  const source = metadata as Record<string, any>;
  return source.welfareRules ?? source.welfare ?? {};
};

export const resolveWelfareApprovalPolicy = (metadata: unknown, _claimType?: string, amountRequested = 0) => {
  const ruleSet = resolveWelfareRulesFromMetadata(metadata);
  const approvalMode = String(ruleSet.approvalMode ?? 'COMMITTEE').toUpperCase();
  const thresholdPercent = Number(ruleSet.approvalThreshold ?? 60);
  const maxClaimAmount = Number(ruleSet.maxClaimAmount ?? Number.POSITIVE_INFINITY);
  const totalPossibleApprovers = Math.max(2, Number((metadata as any)?.committeeSize ?? 2));
  const requiredApprovals = Math.max(1, Math.ceil((thresholdPercent / 100) * totalPossibleApprovers));
  return { approvalMode, thresholdPercent, totalPossibleApprovers, requiredApprovals, autoApproveWithinLimits: approvalMode === 'AUTO' && Number(amountRequested) <= maxClaimAmount };
};
