import type { ChamaStatus } from "../types";

export const APP_LABELS = {
  organization: "Organization",
  chama: "Chama",
  welfare: "Welfare",
  members: "Members",
  finance: "Finance",
} as const;

export const ChamaType = {
  Savings: "SAVINGS",
  MerryGoRound: "MERRY_GO_ROUND",
  Investment: "INVESTMENT",
  Welfare: "WELFARE",
  Family: "FAMILY",
  Staff: "STAFF",
  Church: "CHURCH",
  Hybrid: "HYBRID",
} as const;

export type ChamaType = (typeof ChamaType)[keyof typeof ChamaType];

export const CHAMA_TYPE_OPTIONS = [
  ChamaType.Savings,
  ChamaType.MerryGoRound,
  ChamaType.Investment,
  ChamaType.Welfare,
  ChamaType.Family,
  ChamaType.Staff,
  ChamaType.Church,
  ChamaType.Hybrid,
] as const;

export interface ChamaTypeDetail {
  label: string;
  description: string;
  bestFor: string;
}

export const CHAMA_TYPE_DETAILS: Record<ChamaType, ChamaTypeDetail> = {
  [ChamaType.Savings]: {
    label: "Savings Chama",
    description: "For groups that mainly collect regular savings and track member contributions.",
    bestFor: "Table banking, monthly savings, and simple contribution groups.",
  },
  [ChamaType.MerryGoRound]: {
    label: "Merry-Go-Round",
    description: "Members contribute on a cycle and take turns receiving the pooled payout.",
    bestFor: "Rotating payouts where every member gets a planned turn.",
  },
  [ChamaType.Investment]: {
    label: "Investment Chama",
    description: "For pooling money into assets, shares, businesses, land, or long-term projects.",
    bestFor: "Groups that need records for investments, votes, and project decisions.",
  },
  [ChamaType.Welfare]: {
    label: "Welfare Chama",
    description: "For supporting members during emergencies, bereavement, medical needs, or hardship.",
    bestFor: "Groups focused on claims, assistance funds, and member support.",
  },
  [ChamaType.Family]: {
    label: "Family Chama",
    description: "For relatives saving together, supporting family events, and keeping shared records.",
    bestFor: "Family savings, welfare support, documents, and meetings.",
  },
  [ChamaType.Staff]: {
    label: "Staff Chama",
    description: "For employees or colleagues who save together and may offer member loans.",
    bestFor: "Workplace savings, staff loans, and contribution tracking.",
  },
  [ChamaType.Church]: {
    label: "Church Chama",
    description: "For faith-based groups that save, support members, and coordinate activities.",
    bestFor: "Church fellowships, welfare support, meetings, and shared documents.",
  },
  [ChamaType.Hybrid]: {
    label: "Hybrid Chama",
    description: "A flexible setup that combines savings, loans, welfare, investments, and governance.",
    bestFor: "Groups that want most modules available from the start.",
  },
};

export const MODULE_KEYS = [
  "savings",
  "contributions",
  "loans",
  "welfare",
  "investments",
  "meetings",
  "voting",
  "fines",
  "reports",
  "documents",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type EnabledModules = Record<string, boolean>;

export const CUSTOM_MODULE_PREFIX = "custom:";

export interface ModuleDetail {
  label: string;
  description: string;
}

export const MODULE_DETAILS: Record<ModuleKey, ModuleDetail> = {
  savings: {
    label: "Savings",
    description: "Track member savings, balances, and saving cycles.",
  },
  contributions: {
    label: "Contributions",
    description: "Manage recurring member payments, periods, arrears, and receipts.",
  },
  loans: {
    label: "Loans",
    description: "Handle loan applications, approvals, repayments, and balances.",
  },
  welfare: {
    label: "Welfare",
    description: "Support claims for emergencies, bereavement, medical needs, or assistance.",
  },
  investments: {
    label: "Investments",
    description: "Track pooled investments, assets, projects, shares, and growth decisions.",
  },
  meetings: {
    label: "Meetings",
    description: "Schedule meetings, agendas, attendance, and follow-up records.",
  },
  voting: {
    label: "Voting",
    description: "Run decisions, approvals, polls, and member resolutions.",
  },
  fines: {
    label: "Fines",
    description: "Apply penalties for missed meetings, late payments, or group rules.",
  },
  reports: {
    label: "Reports",
    description: "Generate summaries for members, committees, and audits.",
  },
  documents: {
    label: "Documents",
    description: "Store constitutions, minutes, receipts, agreements, and member files.",
  },
};

export const createCustomModuleKey = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `${CUSTOM_MODULE_PREFIX}${slug}` : "";
};

export const isCustomModuleKey = (key: string) => key.startsWith(CUSTOM_MODULE_PREFIX);

export const getModuleLabel = (key: string) => {
  const detail = (MODULE_DETAILS as Record<string, ModuleDetail | undefined>)[key];
  if (detail) {
    return detail.label;
  }

  const normalizedKey = isCustomModuleKey(key) ? key.slice(CUSTOM_MODULE_PREFIX.length) : key;
  return normalizedKey
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export interface Organization {
  id: string;
  name: string;
  shortCode: string;
  description?: string | null;
  county: string;
  town: string;
  phone: string;
  logoUrl?: string | null;
  chamaType: ChamaType;
  enabledModules: EnabledModules;
  currency: "KES";
  status: ChamaStatus;
  createdAt: string;
  updatedAt: string;
}

export type MemberStatus = "INVITATION_SENT" | "PENDING_APPROVAL" | "PENDING" | "ACTIVE" | "SUSPENDED" | "EXITED" | "ARCHIVED";

export interface Member {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: "FOUNDER" | "CHAIR" | "TREASURER" | "SECRETARY" | "AUDITOR" | "MEMBER";
  status: MemberStatus;
  joinedAt: string;
}

export const PERMISSION_KEYS = [
  "view_dashboard",
  "view_members",
  "manage_members",
  "view_contributions",
  "manage_contributions",
  "view_loans",
  "manage_loans",
  "view_welfare",
  "manage_welfare",
  "view_meetings",
  "manage_meetings",
  "view_voting",
  "manage_voting",
  "view_documents",
  "manage_documents",
  "view_reports",
  "manage_reports",
  "view_wallet",
  "manage_wallet",
  "manage_roles",
  "manage_approvals",
  "view_audit_logs",
  "manage_settings",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface Permission {
  key: PermissionKey;
  label: string;
  description?: string;
}

export type RoleKey = "member" | "chairperson" | "secretary" | "treasurer" | "auditor" | "admin";

export interface Role {
  id: string;
  organizationId: string;
  key: RoleKey;
  name: string;
  permissions: PermissionKey[];
  isSystemRole: boolean;
}

export type WelfareClaimStatus = "draft" | "pending" | "under_review" | "approved" | "rejected" | "paid";

export interface WelfareClaim {
  id: string;
  organizationId: string;
  memberId: string;
  claimCategory: string;
  title: string;
  description: string;
  amountRequested: number;
  amountApproved?: number | null;
  status: WelfareClaimStatus;
  approvalRequired: boolean;
  submittedAt: string;
}

export type ContributionFrequency = "daily" | "weekly" | "monthly";
export type ContributionStatus = "pending" | "paid" | "overdue" | "waived";

export interface Contribution {
  id: string;
  organizationId: string;
  memberId: string;
  amount: number;
  frequency: ContributionFrequency;
  dueDate: string;
  paidAt?: string | null;
  latePenalty?: number | null;
  gracePeriodDays?: number | null;
  status: ContributionStatus;
}

export type LoanStatus = "draft" | "pending" | "approved" | "disbursed" | "partially_repaid" | "repaid" | "defaulted";

export interface Loan {
  id: string;
  organizationId: string;
  memberId: string;
  principalAmount: number;
  interestRate: number;
  repaymentPeriodMonths: number;
  guarantorsRequired: number;
  lateRepaymentPenalty?: number | null;
  status: LoanStatus;
  requestedAt: string;
  dueAt?: string | null;
}

export const WIZARD_STEP_KEYS = [
  "choose_type",
  "chama_details",
  "enable_modules",
  "contribution_rules",
  "loan_rules",
  "welfare_rules",
  "committee",
  "invite_members",
  "review_setup",
] as const;

export type WizardStepKey = (typeof WIZARD_STEP_KEYS)[number];

export interface WizardStep {
  key: WizardStepKey;
  order: number;
  title: string;
  route: string;
  requiredModules?: ModuleKey[];
}

export const CREATE_CHAMA_WIZARD_STEPS: readonly WizardStep[] = [
  { key: "choose_type", order: 1, title: "Create Chama", route: "/create-chama/type" },
  { key: "chama_details", order: 2, title: "Chama Details", route: "/create-chama/details" },
  { key: "enable_modules", order: 3, title: "Enable Modules", route: "/create-chama/modules" },
  {
    key: "contribution_rules",
    order: 4,
    title: "Contribution Rules",
    route: "/create-chama/contributions",
    requiredModules: ["savings", "contributions"],
  },
  { key: "loan_rules", order: 5, title: "Loan Rules", route: "/create-chama/loans", requiredModules: ["loans"] },
  { key: "welfare_rules", order: 6, title: "Welfare Rules", route: "/create-chama/welfare", requiredModules: ["welfare"] },
  { key: "committee", order: 7, title: "Committee", route: "/create-chama/committee" },
  { key: "invite_members", order: 8, title: "Invite Members", route: "/create-chama/invite" },
  { key: "review_setup", order: 9, title: "Review Setup", route: "/create-chama/review" },
] as const;

export type DashboardWidgetKey =
  | "wallet_balance"
  | "active_members"
  | "monthly_contributions"
  | "outstanding_loans"
  | "welfare_fund"
  | "upcoming_meeting"
  | "pending_claims"
  | "open_votes"
  | "recent_documents"
  | "report_summary";

export interface DashboardWidgetConfig {
  key: DashboardWidgetKey;
  title: string;
  description: string;
  moduleRequirement?: ModuleKey;
}

export const DASHBOARD_WIDGETS: Record<DashboardWidgetKey, DashboardWidgetConfig> = {
  wallet_balance: { key: "wallet_balance", title: "Wallet Balance", description: "Quick view of the current chama balance." },
  active_members: { key: "active_members", title: "Active Members", description: "Members actively participating in the chama." },
  monthly_contributions: {
    key: "monthly_contributions",
    title: "This Month's Contributions",
    description: "Total contributions collected for the current cycle.",
    moduleRequirement: "contributions",
  },
  outstanding_loans: {
    key: "outstanding_loans",
    title: "Outstanding Loans",
    description: "Unpaid loans currently in circulation.",
    moduleRequirement: "loans",
  },
  welfare_fund: {
    key: "welfare_fund",
    title: "Welfare Fund",
    description: "Amount available for support and emergency claims.",
    moduleRequirement: "welfare",
  },
  upcoming_meeting: {
    key: "upcoming_meeting",
    title: "Upcoming Meeting",
    description: "The next scheduled gathering and agenda.",
    moduleRequirement: "meetings",
  },
  pending_claims: {
    key: "pending_claims",
    title: "Pending Claims",
    description: "Claims awaiting review or approval.",
    moduleRequirement: "welfare",
  },
  open_votes: { key: "open_votes", title: "Open Votes", description: "Active motions waiting for member input.", moduleRequirement: "voting" },
  recent_documents: {
    key: "recent_documents",
    title: "Recent Documents",
    description: "Latest uploaded files and records.",
    moduleRequirement: "documents",
  },
  report_summary: { key: "report_summary", title: "Report Summary", description: "Export-friendly reporting overview." },
};

export const DASHBOARD_WIDGETS_BY_CHAMA_TYPE: Record<ChamaType, DashboardWidgetKey[]> = {
  [ChamaType.Savings]: ["wallet_balance", "active_members", "monthly_contributions", "outstanding_loans", "upcoming_meeting", "report_summary"],
  [ChamaType.MerryGoRound]: ["active_members", "monthly_contributions", "upcoming_meeting", "open_votes", "report_summary"],
  [ChamaType.Investment]: ["wallet_balance", "active_members", "monthly_contributions", "report_summary"],
  [ChamaType.Welfare]: ["wallet_balance", "welfare_fund", "pending_claims", "active_members", "upcoming_meeting"],
  [ChamaType.Family]: ["active_members", "welfare_fund", "upcoming_meeting", "recent_documents"],
  [ChamaType.Staff]: ["wallet_balance", "active_members", "monthly_contributions", "outstanding_loans"],
  [ChamaType.Church]: ["active_members", "welfare_fund", "upcoming_meeting", "recent_documents"],
  [ChamaType.Hybrid]: [
    "wallet_balance",
    "active_members",
    "monthly_contributions",
    "outstanding_loans",
    "welfare_fund",
    "upcoming_meeting",
    "pending_claims",
    "open_votes",
    "recent_documents",
    "report_summary",
  ],
};

export interface ModuleRule {
  module: ModuleKey;
  visibleInChamaTypes: ChamaType[];
  defaultEnabledFor: ChamaType[];
  dependsOn?: ModuleKey[];
}

export const MODULE_VISIBILITY_RULES: readonly ModuleRule[] = [
  { module: "savings", visibleInChamaTypes: Object.values(ChamaType), defaultEnabledFor: [ChamaType.Savings, ChamaType.Hybrid] },
  {
    module: "contributions",
    visibleInChamaTypes: Object.values(ChamaType),
    defaultEnabledFor: [ChamaType.Savings, ChamaType.MerryGoRound, ChamaType.Welfare, ChamaType.Family, ChamaType.Staff, ChamaType.Church, ChamaType.Hybrid],
  },
  {
    module: "loans",
    visibleInChamaTypes: [ChamaType.Savings, ChamaType.Investment, ChamaType.Staff, ChamaType.Hybrid],
    defaultEnabledFor: [ChamaType.Savings, ChamaType.Staff, ChamaType.Hybrid],
    dependsOn: ["contributions"],
  },
  {
    module: "welfare",
    visibleInChamaTypes: [ChamaType.Welfare, ChamaType.Family, ChamaType.Church, ChamaType.Hybrid],
    defaultEnabledFor: [ChamaType.Welfare, ChamaType.Family, ChamaType.Church, ChamaType.Hybrid],
    dependsOn: ["contributions"],
  },
  { module: "investments", visibleInChamaTypes: [ChamaType.Investment, ChamaType.Hybrid], defaultEnabledFor: [ChamaType.Investment, ChamaType.Hybrid], dependsOn: ["savings"] },
  { module: "meetings", visibleInChamaTypes: Object.values(ChamaType), defaultEnabledFor: Object.values(ChamaType) },
  {
    module: "voting",
    visibleInChamaTypes: [ChamaType.MerryGoRound, ChamaType.Welfare, ChamaType.Family, ChamaType.Church, ChamaType.Hybrid],
    defaultEnabledFor: [ChamaType.MerryGoRound, ChamaType.Welfare, ChamaType.Church, ChamaType.Hybrid],
  },
  { module: "fines", visibleInChamaTypes: [ChamaType.Hybrid, ChamaType.Staff, ChamaType.Church], defaultEnabledFor: [ChamaType.Hybrid] },
  { module: "reports", visibleInChamaTypes: Object.values(ChamaType), defaultEnabledFor: Object.values(ChamaType) },
  {
    module: "documents",
    visibleInChamaTypes: Object.values(ChamaType),
    defaultEnabledFor: [ChamaType.Savings, ChamaType.Investment, ChamaType.Welfare, ChamaType.Family, ChamaType.Church, ChamaType.Hybrid],
  },
] as const;

export const getDefaultEnabledModules = (type: ChamaType): EnabledModules => {
  const defaults = new Set(MODULE_VISIBILITY_RULES.filter((rule) => rule.defaultEnabledFor.includes(type)).map((rule) => rule.module));
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = defaults.has(key);
    return acc;
  }, {} as EnabledModules);
};

export const isModuleEnabled = (enabledModules: EnabledModules, module: ModuleKey) => Boolean(enabledModules[module]);

export const MODULE_DEPENDENCIES: Partial<Record<ModuleKey, ModuleKey[]>> = {
  loans: ["contributions"],
  welfare: ["contributions"],
  investments: ["savings"],
};

export const MODULE_REQUIRED_PLAN: Partial<Record<ModuleKey, 'STARTER' | 'GROWTH' | 'PRO'>> = {
  documents: 'STARTER',
  voting: 'GROWTH',
};

export const getRequiredPlanForModules = (modules: EnabledModules): 'FREE' | 'STARTER' | 'GROWTH' | 'PRO' => {
  const plans = MODULE_KEYS.filter((module) => modules[module]).map((module) => MODULE_REQUIRED_PLAN[module]);
  if (plans.includes('PRO')) return 'PRO';
  if (plans.includes('GROWTH')) return 'GROWTH';
  if (plans.includes('STARTER')) return 'STARTER';
  return 'FREE';
};

export const toggleModuleWithDependencies = (modules: EnabledModules, module: ModuleKey): EnabledModules => {
  const next = { ...modules, [module]: !modules[module] };
  if (next[module]) {
    for (const dependency of MODULE_DEPENDENCIES[module] ?? []) next[dependency] = true;
  } else {
    for (const [dependent, dependencies] of Object.entries(MODULE_DEPENDENCIES) as Array<[ModuleKey, ModuleKey[]]>) {
      if (dependencies.includes(module)) next[dependent] = false;
    }
  }
  return next;
};

export const getActiveWizardSteps = (enabledModules: EnabledModules) => CREATE_CHAMA_WIZARD_STEPS.filter((step) =>
  !step.requiredModules?.length || step.requiredModules.some((module) => Boolean(enabledModules[module]))
);

export const getWizardRouteAfter = (currentKey: WizardStepKey, enabledModules: EnabledModules) => {
  const steps = getActiveWizardSteps(enabledModules);
  const index = steps.findIndex((step) => step.key === currentKey);
  return steps[index + 1]?.route ?? steps[steps.length - 1].route;
};

export const getWizardRouteBefore = (currentKey: WizardStepKey, enabledModules: EnabledModules) => {
  const steps = getActiveWizardSteps(enabledModules);
  const index = steps.findIndex((step) => step.key === currentKey);
  return steps[Math.max(0, index - 1)]?.route ?? steps[0].route;
};

export const getVisibleDashboardWidgets = (organization: Pick<Organization, "chamaType" | "enabledModules">) => {
  return DASHBOARD_WIDGETS_BY_CHAMA_TYPE[organization.chamaType].filter((widgetKey) => {
    const widget = DASHBOARD_WIDGETS[widgetKey];
    return !widget.moduleRequirement || isModuleEnabled(organization.enabledModules, widget.moduleRequirement);
  });
};
