export type SubscriptionPlan = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO' | 'INVESTMENT_AUTOMATION' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type PremiumFeature = 'ADVANCED_EXPORTS' | 'DOCUMENTS' | 'VOTING' | 'AUDIT_LOGS' | 'MPESA_AUTOMATION' | 'ADMIN_CONTROLS' | 'INVESTMENT_AUTOMATION';
export type PlanPriceTier = { maxMembers: number; monthlyPrice: number; annualPrice: number; label: string };
export type StorageAllowance = { label: string; megabytes: number | null };

export const PLAN_RANK: Record<SubscriptionPlan, number> = { FREE: 0, STARTER: 1, GROWTH: 2, PRO: 3, INVESTMENT_AUTOMATION: 4, ENTERPRISE: 5 };
export const FEATURE_PLAN: Record<PremiumFeature, SubscriptionPlan> = { ADVANCED_EXPORTS: 'STARTER', DOCUMENTS: 'STARTER', VOTING: 'GROWTH', AUDIT_LOGS: 'GROWTH', MPESA_AUTOMATION: 'PRO', ADMIN_CONTROLS: 'GROWTH', INVESTMENT_AUTOMATION: 'INVESTMENT_AUTOMATION' };
export const FEATURE_COPY: Record<PremiumFeature, { title: string; description: string }> = {
  ADVANCED_EXPORTS: { title: 'Professional PDF & CSV exports', description: 'Download management reports, member registers, and financial records for review.' },
  DOCUMENTS: { title: 'Document management', description: 'Store and manage member verification and supporting documents.' },
  VOTING: { title: 'Digital voting', description: 'Run tracked votes and preserve governance decisions.' },
  AUDIT_LOGS: { title: 'Advanced audit trail', description: 'Search accountable system and governance activity across the chama.' },
  MPESA_AUTOMATION: { title: 'M-Pesa automation', description: 'Automate payment collection, reconciliation, and transaction monitoring.' },
  ADMIN_CONTROLS: { title: 'Advanced administration', description: 'Access approvals, role controls, wallet administration, and security tools.' },
  INVESTMENT_AUTOMATION: { title: 'Investment & SACCO automation', description: 'Automate investment schedules, penalties, advance allocations, member statements, and share-out preparation.' },
};

export const SUBSCRIPTION_PLANS = [
  { id: 'FREE' as const, name: 'Community', monthlyPrice: 0, annualPrice: 0, memberLimit: 15, storage: { label: '100 MB', megabytes: 100 }, description: 'A useful free starting point for small Chamas to manage everyday money and meetings.', features: ['Free forever', 'Up to 15 members', 'Members, manual contributions, basic loans and welfare', 'Meetings, invitations and basic dashboard'] },
  { id: 'STARTER' as const, name: 'Starter', monthlyPrice: 399, annualPrice: 3990, memberLimit: 50, storage: { label: '1 GB', megabytes: 1024 }, description: 'Professional Chama records and a complete monthly meeting pack.', features: ['Up to 50 members', 'Everything in Community', 'Member statements and contribution reports', 'Loan, welfare and arrears reports', 'Documents, receipts and CSV/Excel exports'] },
  { id: 'GROWTH' as const, name: 'Growth', monthlyPrice: 899, annualPrice: 8990, memberLimit: 100, storage: { label: '5 GB', megabytes: 5120 }, description: 'Governance and accountability for established Chamas.', popular: true, features: ['Up to 100 members', 'Everything in Starter', 'Digital voting and complete audit trail', 'Approval workflows and multi-approval welfare', 'Treasurer, Chairperson and Secretary controls', 'Financial exception centre and reminders'] },
  { id: 'PRO' as const, name: 'Pro', monthlyPrice: 1799, annualPrice: 17990, memberLimit: 250, storage: { label: '20 GB', megabytes: 20480 }, description: 'Stop manually checking M-Pesa messages and updating Excel.', priceTiers: [{ maxMembers: 50, monthlyPrice: 1299, annualPrice: 12990, label: 'Small Chama' }], features: ['Up to 250 members', 'KES 1,299/month for 50 members or fewer', 'M-Pesa STK Push and automatic reconciliation', 'Automatic contribution matching and receipts', 'Payment exceptions, advanced approvals and security'] },
  { id: 'INVESTMENT_AUTOMATION' as const, name: 'Investment & SACCO Automation', monthlyPrice: 2999, annualPrice: 29990, memberLimit: 250, storage: { label: '50 GB', megabytes: 51200 }, description: 'Automate investment schedules, performance, statements and share-out preparation.', priceTiers: [{ maxMembers: 50, monthlyPrice: 1999, annualPrice: 19990, label: 'Small Chama' }], features: ['Everything in Pro', 'KES 1,999/month for 50 members or fewer', 'Investment portfolios and performance tracking', 'Monthly schedules, penalties and advance allocation', 'Member investment statements and share-out preparation'] },
  { id: 'ENTERPRISE' as const, name: 'Custom / Enterprise', monthlyPrice: 0, annualPrice: 0, memberLimit: null, storage: { label: 'Custom', megabytes: null }, description: 'A serious operating package for large and complex organizations, priced as setup plus an ongoing subscription.', features: ['For large Chamas, welfare groups, SACCO-like and multi-branch organizations', 'Paid setup, migration and onboarding scope', 'Custom workflows, integrations and member capacity', 'Ongoing subscription, support and service agreement'] },
];

export const SETUP_SERVICES = [
  { name: 'Self Setup', price: 'Free', description: 'Create your organization and configure it with guided setup.' },
  { name: 'Assisted Setup', price: 'KES 2,500–5,000', description: 'Organization creation, members, roles, welfare, loan rules, M-Pesa and official orientation.' },
  { name: 'Data Migration + Setup', price: 'KES 5,000–15,000', description: 'Historical members, contributions, documents, configuration and migration review.' },
  { name: 'Enterprise Implementation', price: 'Quote', description: 'Multi-branch rollout, integrations, migration, training and service planning.' },
] as const;

export const TRAINING_SERVICES = [
  { name: 'Remote onboarding session', price: 'KES 2,000' },
  { name: 'Full officials training', price: 'KES 5,000' },
  { name: 'On-site training', price: 'Custom quote + travel' },
] as const;

export const SMS_CREDIT_PACKS = [
  { credits: 100, price: 'Contact CHAMAZ360' },
  { credits: 500, price: 'Contact CHAMAZ360' },
  { credits: 1000, price: 'Contact CHAMAZ360' },
] as const;

export const VAULT_ADDON = { name: 'Chama Vault', price: 'Contact CHAMAZ360', description: "Periodic downloadable archives of members, contributions, loans, welfare, meetings, votes, documents and audit logs." } as const;

export const getPlanPriceDefinition = (plan: (typeof SUBSCRIPTION_PLANS)[number], memberCount?: number | null) => {
  if (memberCount === null || memberCount === undefined) return plan;
  return plan.priceTiers?.find((tier: PlanPriceTier) => memberCount <= tier.maxMembers) ?? plan;
};

export const getPlanPrice = (plan: (typeof SUBSCRIPTION_PLANS)[number], billingCycle: BillingCycle, memberCount?: number | null) => {
  const priceDefinition = getPlanPriceDefinition(plan, memberCount);
  return billingCycle === 'ANNUAL' ? priceDefinition.annualPrice : priceDefinition.monthlyPrice;
};
