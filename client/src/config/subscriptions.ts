export type SubscriptionPlan = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO' | 'INVESTMENT_AUTOMATION' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type PremiumFeature = 'ADVANCED_EXPORTS' | 'DOCUMENTS' | 'VOTING' | 'AUDIT_LOGS' | 'MPESA_AUTOMATION' | 'ADMIN_CONTROLS' | 'INVESTMENT_AUTOMATION';
export type PlanPriceTier = { maxMembers: number; monthlyPrice: number; annualPrice: number; label: string };

export const PLAN_RANK: Record<SubscriptionPlan, number> = { FREE: 0, STARTER: 1, GROWTH: 2, PRO: 3, INVESTMENT_AUTOMATION: 4, ENTERPRISE: 5 };
export const FEATURE_PLAN: Record<PremiumFeature, SubscriptionPlan> = { ADVANCED_EXPORTS: 'STARTER', DOCUMENTS: 'STARTER', VOTING: 'GROWTH', AUDIT_LOGS: 'GROWTH', MPESA_AUTOMATION: 'PRO', ADMIN_CONTROLS: 'PRO', INVESTMENT_AUTOMATION: 'INVESTMENT_AUTOMATION' };
export const FEATURE_COPY: Record<PremiumFeature, { title: string; description: string }> = {
  ADVANCED_EXPORTS: { title: 'Professional PDF & CSV exports', description: 'Download management reports, member registers, and financial records for review.' },
  DOCUMENTS: { title: 'Document management', description: 'Store and manage member verification and supporting documents.' },
  VOTING: { title: 'Digital voting', description: 'Run tracked votes and preserve governance decisions.' },
  AUDIT_LOGS: { title: 'Advanced audit trail', description: 'Search accountable system and governance activity across the chama.' },
  MPESA_AUTOMATION: { title: 'M-Pesa automation', description: 'Automate payment collection, reconciliation, and transaction monitoring.' },
  ADMIN_CONTROLS: { title: 'Advanced administration', description: 'Access approvals, role controls, wallet administration, and security tools.' },
  INVESTMENT_AUTOMATION: { title: 'Investment contribution automation', description: 'Automate monthly deadlines, penalties, advance allocations, coverage periods, and member reminders.' },
};

export const SUBSCRIPTION_PLANS = [
  { id: 'FREE' as const, name: 'Community', monthlyPrice: 0, annualPrice: 0, memberLimit: 30, description: 'Build trust in CHAMA360 with complete everyday chama management at no cost.', features: ['Free forever', 'Up to 30 members', 'Contributions, loans and welfare', 'Meetings and member management'] },
  { id: 'STARTER' as const, name: 'Starter', monthlyPrice: 399, annualPrice: 3990, memberLimit: 50, description: 'Prepare accurate monthly meeting records in minutes.', features: ['Up to 50 members', 'Everything in Community', 'Monthly paid, due and overdue statement PDF', 'Professional PDF and CSV exports', 'Documents and verification'] },
  { id: 'GROWTH' as const, name: 'Growth', monthlyPrice: 899, annualPrice: 8990, memberLimit: 100, description: 'Stronger governance and accountability for active groups.', popular: true, features: ['Up to 100 members', 'Everything in Starter', 'Digital voting', 'Searchable audit trail'] },
  { id: 'PRO' as const, name: 'Pro', monthlyPrice: 1799, annualPrice: 17990, memberLimit: 250, description: 'Payment automation and advanced controls for established groups.', priceTiers: [{ maxMembers: 50, monthlyPrice: 1299, annualPrice: 12990, label: 'Small Chama' }], features: ['Up to 250 members', 'KES 1,299/month for 50 members or fewer', 'M-Pesa automation', 'Advanced administration', 'Approval and security controls'] },
  { id: 'INVESTMENT_AUTOMATION' as const, name: 'Investment Automation', monthlyPrice: 2999, annualPrice: 29990, memberLimit: 250, description: 'Contribution and payment automation for investment groups.', priceTiers: [{ maxMembers: 50, monthlyPrice: 1999, annualPrice: 19990, label: 'Small Chama' }], features: ['Everything in Pro', 'KES 1,999/month for 50 members or fewer', 'Monthly deadlines and contribution calendar', 'Automatic penalties and advance allocations', 'Months-covered statements and scheduled reminders'] },
  { id: 'ENTERPRISE' as const, name: 'Custom', monthlyPrice: 0, annualPrice: 0, memberLimit: null, description: 'A tailored package designed with CHAMA360 for your organization’s exact structure and requirements.', features: ['Custom Chama type and workflows', 'Custom member capacity', 'Selected integrations and modules', 'Agreed onboarding and support'] },
];

export const getPlanPriceDefinition = (plan: (typeof SUBSCRIPTION_PLANS)[number], memberCount?: number | null) => {
  if (memberCount === null || memberCount === undefined) return plan;
  return plan.priceTiers?.find((tier: PlanPriceTier) => memberCount <= tier.maxMembers) ?? plan;
};

export const getPlanPrice = (plan: (typeof SUBSCRIPTION_PLANS)[number], billingCycle: BillingCycle, memberCount?: number | null) => {
  const priceDefinition = getPlanPriceDefinition(plan, memberCount);
  return billingCycle === 'ANNUAL' ? priceDefinition.annualPrice : priceDefinition.monthlyPrice;
};
