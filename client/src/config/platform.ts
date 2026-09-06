import type { ChamaModuleKey, ChamaType } from "../types";

export const PLATFORM_NAME = "CHAMA360";
export const PLATFORM_TAGLINE = "Community Chama Management";
export const PLATFORM_SUBTITLE =
  "One application for chamas, welfare groups, SACCOs, churches, estates, families, youth groups, and community groups.";

export const ALL_CHAMA_MODULES: ChamaModuleKey[] = [
  "SAVINGS",
  "CONTRIBUTIONS",
  "LOANS",
  "SHARES",
  "INVESTMENTS",
  "WELFARE",
  "MEETINGS",
  "VOTING",
  "FINES",
  "ASSET_REGISTER",
  "PROJECTS",
  "MPESA",
  "REPORTS",
  "DOCUMENTS",
];

export interface ChamaBlueprint {
  kind: ChamaType;
  title: string;
  description: string;
  highlight: string;
  recommendedModules: ChamaModuleKey[];
}

export const CHAMA_BLUEPRINTS: ChamaBlueprint[] = [
  {
    kind: "SAVINGS",
    title: "Savings Chama",
    description: "For regular saving and member contributions.",
    highlight: "Core savings",
    recommendedModules: ["SAVINGS", "MEETINGS", "REPORTS"],
  },
  {
    kind: "MERRY_GO_ROUND",
    title: "Merry-Go-Round",
    description: "Members contribute and take turns receiving payouts.",
    highlight: "Rotating payout",
    recommendedModules: ["SAVINGS", "MEETINGS", "REPORTS"],
  },
  {
    kind: "INVESTMENT",
    title: "Investment Chama",
    description: "Pool money for land, shares, business, or assets.",
    highlight: "Growth focused",
    recommendedModules: ["SHARES", "INVESTMENTS", "PROJECTS", "VOTING", "REPORTS"],
  },
  {
    kind: "WELFARE",
    title: "Welfare Chama",
    description: "Support members during emergencies, bereavement, and medical needs.",
    highlight: "Care and support",
    recommendedModules: ["WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "BUSINESS",
    title: "Business Chama",
    description: "Members contribute capital to start or run businesses.",
    highlight: "Capital and growth",
    recommendedModules: ["SAVINGS", "LOANS", "INVESTMENTS", "REPORTS", "MPESA"],
  },
  {
    kind: "HOUSING",
    title: "Housing Chama",
    description: "Save towards land, houses, and real estate projects.",
    highlight: "Asset building",
    recommendedModules: ["SAVINGS", "LOANS", "ASSET_REGISTER", "PROJECTS", "REPORTS"],
  },
  {
    kind: "FAMILY",
    title: "Family Chama",
    description: "Savings and welfare support among family members.",
    highlight: "Shared responsibility",
    recommendedModules: ["SAVINGS", "WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "CHURCH",
    title: "Church Chama",
    description: "Church members save and support one another.",
    highlight: "Community stewardship",
    recommendedModules: ["SAVINGS", "WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "YOUTH",
    title: "Youth Chama",
    description: "Savings and projects for youth groups.",
    highlight: "Growth and projects",
    recommendedModules: ["SAVINGS", "PROJECTS", "MEETINGS", "REPORTS"],
  },
  {
    kind: "STAFF",
    title: "Staff Chama",
    description: "Employees save and access loans together.",
    highlight: "Employee support",
    recommendedModules: ["SAVINGS", "LOANS", "MEETINGS", "REPORTS"],
  },
  {
    kind: "FARMERS",
    title: "Farmers Chama",
    description: "Agricultural savings, equipment, and farming projects.",
    highlight: "Agribusiness",
    recommendedModules: ["SAVINGS", "LOANS", "ASSET_REGISTER", "PROJECTS", "REPORTS"],
  },
  {
    kind: "WOMEN",
    title: "Women's Chama",
    description: "Savings, welfare, and support for women-led groups.",
    highlight: "Women-led",
    recommendedModules: ["SAVINGS", "WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "MEN",
    title: "Men's Chama",
    description: "Savings and support for men-led groups.",
    highlight: "Men-led",
    recommendedModules: ["SAVINGS", "WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "COMMUNITY",
    title: "Community Chama",
    description: "Flexible groups for shared savings and community support.",
    highlight: "Flexible setup",
    recommendedModules: ["SAVINGS", "WELFARE", "MEETINGS", "REPORTS"],
  },
  {
    kind: "HYBRID",
    title: "Hybrid Chama",
    description: "Combination of savings, loans, investments, and welfare.",
    highlight: "All-in-one",
    recommendedModules: ALL_CHAMA_MODULES,
  },
  {
    kind: "ASCA",
    title: "ASCA Chama",
    description: "Accumulating savings with share-out and lending rules.",
    highlight: "Accumulating savings",
    recommendedModules: ["SAVINGS", "LOANS", "MEETINGS", "REPORTS"],
  },
  {
    kind: "NORMAL",
    title: "General Chama",
    description: "Flexible group setup with configurable modules.",
    highlight: "Flexible",
    recommendedModules: ["SAVINGS", "LOANS", "WELFARE", "MEETINGS", "REPORTS"],
  },
];

export type PlatformModuleKey = "finance" | "welfare" | "members" | "meetings" | "reports";

export interface PlatformModule {
  key: PlatformModuleKey;
  title: string;
  description: string;
  examples: string[];
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    key: "finance",
    title: "Finance",
    description: "Contributions, loans, savings, investments, shares, and wallet balances.",
    examples: ["Monthly contributions", "Loan approvals", "Ledger and statements"],
  },
  {
    key: "welfare",
    title: "Welfare",
    description: "Member claims, evidence uploads, committee review, and payout tracking.",
    examples: ["Hospital claims", "Death benefits", "Emergency assistance"],
  },
  {
    key: "members",
    title: "Members",
    description: "Profiles, contacts, dependants, documents, roles, and history.",
    examples: ["Member wallets", "Beneficiaries", "Emergency contacts"],
  },
  {
    key: "meetings",
    title: "Meetings",
    description: "Attendance, minutes, agendas, resolutions, votes, and signatures.",
    examples: ["Attendance register", "Meeting notes", "Action items"],
  },
  {
    key: "reports",
    title: "Reports",
    description: "Financial statements, audit logs, exports, and management summaries.",
    examples: ["PDF export", "Excel export", "Audit trail"],
  },
];

export interface CoreModuleField {
  label: string;
  description?: string;
  required?: boolean;
}

export interface CoreModuleDefinition {
  key: "members" | "contributions" | "loans" | "welfare" | "meetings" | "reports";
  title: string;
  description: string;
  iconLabel: string;
  fields: CoreModuleField[];
  outputs?: string[];
}

export const CHAMA_CORE_MODULES: CoreModuleDefinition[] = [
  {
    key: "members",
    title: "Members Module",
    description: "Member profiles, identity, history, and engagement.",
    iconLabel: "Members",
    fields: [
      { label: "Full name", required: true },
      { label: "Phone number", required: true },
      { label: "ID number", required: true },
      { label: "Role", required: true },
      { label: "Join date", required: true },
      { label: "Beneficiaries" },
      { label: "Contribution history" },
      { label: "Loan history" },
      { label: "Welfare history" },
      { label: "Attendance" },
    ],
  },
  {
    key: "contributions",
    title: "Contributions Module",
    description: "Record and track member payments.",
    iconLabel: "Contributions",
    fields: [
      { label: "Member", required: true },
      { label: "Amount", required: true },
      { label: "Payment method", required: true },
      { label: "Reference number" },
      { label: "Contribution type", required: true },
      { label: "Month / week", required: true },
      { label: "Receipt" },
    ],
  },
  {
    key: "loans",
    title: "Loans Module",
    description: "Application, approval, and repayment tracking.",
    iconLabel: "Loans",
    fields: [
      { label: "Member", required: true },
      { label: "Amount requested", required: true },
      { label: "Purpose", required: true },
      { label: "Interest rate", required: true },
      { label: "Repayment period", required: true },
      { label: "Guarantors" },
      { label: "Approval status", required: true },
    ],
  },
  {
    key: "welfare",
    title: "Welfare Module",
    description: "Claims, approvals, and benefit payment tracking.",
    iconLabel: "Welfare",
    fields: [
      { label: "Member affected", required: true },
      { label: "Claim type", required: true },
      { label: "Reason", required: true },
      { label: "Amount requested", required: true },
      { label: "Supporting document" },
      { label: "Approval status", required: true },
      { label: "Payment status", required: true },
    ],
  },
  {
    key: "meetings",
    title: "Meetings Module",
    description: "Schedule, attendance, and action tracking.",
    iconLabel: "Meetings",
    fields: [
      { label: "Date", required: true },
      { label: "Venue", required: true },
      { label: "Agenda", required: true },
      { label: "Attendance", required: true },
      { label: "Minutes" },
      { label: "Resolutions" },
      { label: "Action items" },
    ],
  },
  {
    key: "reports",
    title: "Reports Module",
    description: "Statements, ledgers, and export-ready summaries.",
    iconLabel: "Reports",
    fields: [
      { label: "Member statement" },
      { label: "Contribution report" },
      { label: "Loan report" },
      { label: "Welfare report" },
      { label: "Cashbook" },
      { label: "Arrears report" },
      { label: "PDF export" },
      { label: "Excel export" },
    ],
    outputs: ["PDF", "Excel", "Audit trail"],
  },
];

export const LEGACY_CHAMA_TYPES: ChamaType[] = ["ROSCA", "ASCA", "NORMAL"];

export const getDefaultRecommendedModules = (type: ChamaType): ChamaModuleKey[] => {
  return CHAMA_BLUEPRINTS.find((item) => item.kind === type)?.recommendedModules ?? ["SAVINGS", "MEETINGS", "REPORTS"];
};

export const getDefaultEnabledModulesForType = (type: ChamaType): Record<ChamaModuleKey, boolean> => {
  const recommended = new Set(getDefaultRecommendedModules(type));
  return ALL_CHAMA_MODULES.reduce((acc, moduleKey) => {
    acc[moduleKey] = recommended.has(moduleKey);
    return acc;
  }, {} as Record<ChamaModuleKey, boolean>);
};
