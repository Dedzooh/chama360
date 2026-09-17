export type WelfareApprovalMode = 'COMMITTEE' | 'CHAIR_TREASURER' | 'MEMBER_VOTE' | 'AUTO';

export type WelfareCategoryRule = {
  key: string;
  label: string;
  enabled: boolean;
  limit: number;
  documents: string[];
};

export type WelfareRulesConfig = {
  enabled: boolean;
  monthlyContribution: number;
  maxClaimAmount: number;
  waitingPeriodDays: number;
  approvalMode: WelfareApprovalMode;
  allowPartialApproval: boolean;
  requireDocuments: boolean;
  reminderDay: number;
  categories: WelfareCategoryRule[];
  updatedAt?: string;
};

export const WELFARE_APPROVAL_OPTIONS: Array<{ value: WelfareApprovalMode; label: string }> = [
  { value: 'COMMITTEE', label: 'Committee approval' },
  { value: 'CHAIR_TREASURER', label: 'Chair + Treasurer' },
  { value: 'MEMBER_VOTE', label: 'Member vote' },
  { value: 'AUTO', label: 'Auto approve within limits' },
];

export const DEFAULT_WELFARE_RULES: WelfareRulesConfig = {
  enabled: true,
  monthlyContribution: 500,
  maxClaimAmount: 25000,
  waitingPeriodDays: 30,
  approvalMode: 'COMMITTEE',
  allowPartialApproval: true,
  requireDocuments: true,
  reminderDay: 5,
  categories: [
    { key: 'MEDICAL', label: 'Medical', enabled: true, limit: 25000, documents: ['Receipt', 'Hospital note'] },
    { key: 'FUNERAL', label: 'Funeral', enabled: true, limit: 30000, documents: ['Burial permit', 'Family letter'] },
    { key: 'EMERGENCY', label: 'Emergency', enabled: true, limit: 15000, documents: ['Evidence', 'Committee note'] },
    { key: 'EDUCATION', label: 'Education', enabled: false, limit: 10000, documents: ['Fee statement'] },
    { key: 'OTHER', label: 'Other', enabled: true, limit: 8000, documents: ['Support evidence'] },
  ],
};

const toNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const toBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const normalizeCategory = (value: unknown, fallback: WelfareCategoryRule): WelfareCategoryRule => {
  const source = typeof value === 'object' && value !== null ? (value as Partial<WelfareCategoryRule>) : {};
  const rawDocuments = Array.isArray(source.documents) ? source.documents : fallback.documents;
  return {
    key: String(source.key || fallback.key).toUpperCase(),
    label: String(source.label || fallback.label),
    enabled: toBoolean(source.enabled, fallback.enabled),
    limit: toNumber(source.limit, fallback.limit),
    documents: rawDocuments.map((document) => String(document).trim()).filter(Boolean),
  };
};

export const normalizeWelfareRules = (value: unknown, enabledFallback = true): WelfareRulesConfig => {
  const source = typeof value === 'object' && value !== null ? (value as Partial<WelfareRulesConfig> & { categories?: unknown }) : {};
  const legacyCategories: unknown[] = Array.isArray(source.categories)
    ? source.categories
    : [...DEFAULT_WELFARE_RULES.categories];
  const categories = DEFAULT_WELFARE_RULES.categories.map((fallback) => {
    const match = legacyCategories.find((category) => {
      if (typeof category === 'string') return category.toUpperCase() === fallback.key;
      if (typeof category === 'object' && category !== null) return String((category as { key?: unknown }).key ?? '').toUpperCase() === fallback.key;
      return false;
    });
    if (typeof match === 'string') return { ...fallback, enabled: true, label: match };
    return normalizeCategory(match, fallback);
  }).concat(
    legacyCategories
      .filter((category) => typeof category === 'object' && category !== null && !DEFAULT_WELFARE_RULES.categories.some((fallback) => fallback.key === String((category as { key?: unknown }).key ?? '').toUpperCase()))
      .map((category) => normalizeCategory(category, { key: 'CUSTOM', label: 'Custom benefit', enabled: true, limit: DEFAULT_WELFARE_RULES.maxClaimAmount, documents: [] })),
  );

  return {
    enabled: toBoolean(source.enabled, enabledFallback),
    monthlyContribution: toNumber(source.monthlyContribution, DEFAULT_WELFARE_RULES.monthlyContribution),
    maxClaimAmount: toNumber(source.maxClaimAmount, DEFAULT_WELFARE_RULES.maxClaimAmount),
    waitingPeriodDays: toNumber(source.waitingPeriodDays, DEFAULT_WELFARE_RULES.waitingPeriodDays),
    approvalMode: WELFARE_APPROVAL_OPTIONS.some((option) => option.value === source.approvalMode) ? (source.approvalMode as WelfareApprovalMode) : DEFAULT_WELFARE_RULES.approvalMode,
    allowPartialApproval: toBoolean(source.allowPartialApproval, DEFAULT_WELFARE_RULES.allowPartialApproval),
    requireDocuments: toBoolean(source.requireDocuments, DEFAULT_WELFARE_RULES.requireDocuments),
    reminderDay: Math.min(28, Math.max(1, toNumber(source.reminderDay, DEFAULT_WELFARE_RULES.reminderDay))),
    categories,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
  };
};

export const getEnabledWelfareCategories = (rules: WelfareRulesConfig) => rules.categories.filter((category) => category.enabled);

export const documentsToText = (documents: string[]) => documents.join(', ');

export const textToDocuments = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
