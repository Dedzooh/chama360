export type WelfareRuleSet = {
  enabled?: boolean;
  maxClaimAmount?: number;
  waitingPeriodDays?: number;
  requireDocuments?: boolean;
  categories?: Array<{
    key?: string;
    enabled?: boolean;
    limit?: number;
  }>;
};

export type WelfareEligibilityInput = {
  organization?: {
    status?: string;
    chama?: { id?: string } | null;
    metadata?: Record<string, unknown>;
  } | null;
  member?: {
    status?: string;
    joinedAt?: Date | string | null;
  } | null;
  rules?: WelfareRuleSet | null;
  memberId?: string;
  claimType?: string;
  amountRequested?: number;
  documents?: string[];
};

export type ApprovalOutcomeInput = {
  approvals: Array<string | null | undefined>;
  requiredApprovals?: number;
  thresholdPercent?: number;
  totalPossibleApprovers?: number;
};

export type WelfarePayoutInput = {
  organization?: {
    chama?: { id?: string } | null;
  } | null;
  walletBalance: number;
  amountRequested: number;
  amountApproved?: number | null;
};

export function resolveWelfareRulesFromMetadata(metadata: unknown): WelfareRuleSet {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const source = metadata as Record<string, any>;
  return (source.welfareRules ?? source.welfare ?? {}) as WelfareRuleSet;
}

export function getWelfareApprovalLimit(ruleSet: WelfareRuleSet | null | undefined, claimType?: string, fallbackMaxClaim = Number.POSITIVE_INFINITY) {
  const categoryRules = Array.isArray(ruleSet?.categories) ? ruleSet.categories : [];
  const categoryMatch = categoryRules.find((category) => {
    if (!category || typeof category !== 'object') return false;
    return String(category.key ?? '').toUpperCase() === String(claimType ?? '').toUpperCase();
  });

  const categoryLimit = Number(categoryMatch?.limit ?? ruleSet?.maxClaimAmount ?? fallbackMaxClaim);
  const overallLimit = Number(ruleSet?.maxClaimAmount ?? fallbackMaxClaim);
  const limit = Number.isFinite(categoryLimit) ? categoryLimit : Number.POSITIVE_INFINITY;
  const overall = Number.isFinite(overallLimit) ? overallLimit : Number.POSITIVE_INFINITY;
  return Math.min(limit, overall);
}

export function evaluateWelfareEligibility(input: WelfareEligibilityInput) {
  const organization = input.organization ?? null;
  const member = input.member ?? null;
  const ruleSet = input.rules ?? resolveWelfareRulesFromMetadata(organization?.metadata ?? {});
  const claimType = String(input.claimType ?? '').trim();
  const amountRequested = Number(input.amountRequested ?? 0);
  const documents = Array.isArray(input.documents) ? input.documents : [];

  const linkedChamaId = organization?.chama?.id;
  const errors: string[] = [];
  const welfareEnabled = Boolean((ruleSet.enabled ?? true) && (organization?.metadata as any)?.enabledModules?.welfare !== false);

  if (!linkedChamaId) {
    errors.push('Organization is not linked to an active Chama');
  }

  if (!welfareEnabled) {
    errors.push('Welfare claims are disabled for this chama');
  }

  const categories = Array.isArray(ruleSet.categories) ? ruleSet.categories : [];
  const selectedCategory = categories.find((category) => {
    if (!category || typeof category !== 'object') return false;
    return Boolean(category.enabled) && String(category.key ?? '').toUpperCase() === String(claimType ?? '').toUpperCase();
  });

  if (!selectedCategory) {
    errors.push(`Welfare category ${claimType || 'unknown'} is not enabled for this chama`);
  }

  if (!member || member.status !== 'ACTIVE') {
    errors.push('Only active members can submit welfare claims');
  }

  const waitingPeriodDays = Number(ruleSet.waitingPeriodDays ?? 0);
  if (waitingPeriodDays > 0 && member) {
    const joinedAt = member.joinedAt ? new Date(member.joinedAt) : null;
    if (!joinedAt || (Date.now() - joinedAt.getTime()) < waitingPeriodDays * 24 * 60 * 60 * 1000) {
      errors.push(`Members must be active for at least ${waitingPeriodDays} days before claiming welfare support`);
    }
  }

  const maxAllowed = getWelfareApprovalLimit(ruleSet, claimType, Number(ruleSet.maxClaimAmount ?? Number.POSITIVE_INFINITY));
  if (Number(amountRequested) > maxAllowed) {
    errors.push(`Requested amount exceeds the configured limit of KES ${Number(maxAllowed).toLocaleString()}`);
  }

  if (Boolean(ruleSet.requireDocuments) && documents.length === 0) {
    errors.push('Required welfare documents were not supplied');
  }

  return {
    valid: errors.length === 0,
    errors,
    selectedCategory: selectedCategory ?? null,
    maxAllowed,
    linkedChamaId: linkedChamaId ?? null,
  };
}

export function computeApprovalOutcome(input: ApprovalOutcomeInput) {
  const approvals = [...new Set((input.approvals ?? []).filter((approval): approval is string => Boolean(approval)))];
  const requiredApprovals = Math.max(1, Number(input.requiredApprovals ?? (approvals.length > 0 ? approvals.length : 1)));
  const thresholdPercent = Number.isFinite(input.thresholdPercent ?? 100) ? Number(input.thresholdPercent ?? 100) : 100;
  const totalPossibleApprovers = Math.max(approvals.length, Number(input.totalPossibleApprovers ?? (approvals.length > 0 ? approvals.length : 1)));
  const ratio = totalPossibleApprovers > 0 ? approvals.length / totalPossibleApprovers : 0;
  const reachedThreshold = approvals.length >= requiredApprovals && ratio * 100 >= thresholdPercent;

  return {
    approved: reachedThreshold,
    approvalsReceived: approvals.length,
    requiredApprovals,
    thresholdPercent,
    totalPossibleApprovers,
  };
}

export function validateWelfarePayout(input: WelfarePayoutInput) {
  const payoutAmount = Number(input.amountApproved ?? input.amountRequested ?? 0);
  const requestedAmount = Number(input.amountRequested ?? 0);
  const errors: string[] = [];

  if (!input.organization?.chama?.id) {
    errors.push('Organization is not linked to an active Chama');
  }

  if (requestedAmount <= 0) {
    errors.push('Welfare claim amount must be greater than zero');
  }

  if (payoutAmount <= 0) {
    errors.push('Approved welfare amount must be greater than zero');
  }

  if (input.amountApproved != null && Number(input.amountApproved) > requestedAmount) {
    errors.push('Approved welfare amount cannot exceed the requested amount');
  }

  if (Number(input.walletBalance ?? 0) < payoutAmount) {
    errors.push(`Insufficient welfare fund balance. Available: KES ${Number(input.walletBalance ?? 0).toLocaleString()}, required: KES ${payoutAmount.toLocaleString()}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    payoutAmount,
    requestedAmount,
  };
}
