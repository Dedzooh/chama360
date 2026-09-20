import { BillingCycle, SubscriptionPlan } from '@prisma/client';

export type SubscriptionPlanDefinition = {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  memberLimit: number | null;
  storageLimitMb: number | null;
  trialDays: number;
  features: string[];
  priceTiers?: Array<{
    maxMembers: number;
    monthlyPrice: number;
    annualPrice: number;
    label: string;
  }>;
};

export const subscriptionPlans = {
  FREE: { name: 'Community', monthlyPrice: 0, annualPrice: 0, memberLimit: 15, storageLimitMb: 100, trialDays: 0, features: ['CORE'] },
  STARTER: { name: 'Starter', monthlyPrice: 399, annualPrice: 3990, memberLimit: 50, storageLimitMb: 1024, trialDays: 0, features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS'] },
  GROWTH: { name: 'Growth', monthlyPrice: 899, annualPrice: 8990, memberLimit: 100, storageLimitMb: 5120, trialDays: 14, features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'ADMIN_CONTROLS'] },
  PRO: { name: 'Pro', monthlyPrice: 1799, annualPrice: 17990, memberLimit: 250, storageLimitMb: 20480, trialDays: 0, features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS'], priceTiers: [{ maxMembers: 50, monthlyPrice: 1299, annualPrice: 12990, label: 'Small Chama' }] },
  INVESTMENT_AUTOMATION: { name: 'Investment & SACCO Automation', monthlyPrice: 2999, annualPrice: 29990, memberLimit: 250, storageLimitMb: 51200, trialDays: 0, features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS', 'INVESTMENT_AUTOMATION'], priceTiers: [{ maxMembers: 50, monthlyPrice: 1999, annualPrice: 19990, label: 'Small Chama' }] },
  ENTERPRISE: { name: 'Custom / Enterprise', monthlyPrice: 0, annualPrice: 0, memberLimit: null, storageLimitMb: null, trialDays: 0, features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS', 'INVESTMENT_AUTOMATION'] },
} satisfies Record<SubscriptionPlan, SubscriptionPlanDefinition>;

export const getPlanPriceDefinition = (plan: SubscriptionPlan, memberCount?: number | null) => {
  const definition: SubscriptionPlanDefinition = subscriptionPlans[plan];
  if (memberCount === null || memberCount === undefined) return definition;
  return definition.priceTiers?.find((tier) => memberCount <= tier.maxMembers) ?? definition;
};

export const getPlanPrice = (plan: SubscriptionPlan, cycle: BillingCycle, memberCount?: number | null) => {
  const priceDefinition = getPlanPriceDefinition(plan, memberCount);
  return cycle === 'ANNUAL' ? priceDefinition.annualPrice : priceDefinition.monthlyPrice;
};

export const planHasFeature = (plan: SubscriptionPlan, feature: string) => subscriptionPlans[plan].features.includes(feature);
