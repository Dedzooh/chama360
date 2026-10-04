import { BillingCycle, SubscriptionPlan } from '@prisma/client';

export type SubscriptionPlanDefinition = {
  name: string;
  /** Swahili tagline used on the pricing page. */
  tagline?: string;
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
  FREE: {
    name: 'Community',
    tagline: 'Kuanzia - start small',
    monthlyPrice: 0,
    annualPrice: 0,
    memberLimit: 15,
    storageLimitMb: 100,
    trialDays: 0,
    features: ['CORE'],
  },
  STARTER: {
    name: 'Jenga',
    tagline: 'Build - for growing chamas',
    monthlyPrice: 250,
    annualPrice: 2500,
    memberLimit: 40,
    storageLimitMb: 1024,
    // 30-day full-feature trial: every new chama tastes the paid experience.
    trialDays: 30,
    features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'AUDIT_LOGS', 'ADMIN_CONTROLS'],
  },
  GROWTH: {
    name: 'Maendeleo',
    tagline: 'Progress - governance for serious chamas',
    monthlyPrice: 500,
    annualPrice: 5000,
    memberLimit: 60,
    storageLimitMb: 5120,
    trialDays: 30,
    features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'ADMIN_CONTROLS'],
  },
  PRO: {
    name: 'Tajiri Business',
    tagline: 'Wealth - M-Pesa automation for active chamas',
    monthlyPrice: 999,
    annualPrice: 9990,
    memberLimit: 250,
    storageLimitMb: 20480,
    trialDays: 30,
    features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS'],
    priceTiers: [{ maxMembers: 60, monthlyPrice: 999, annualPrice: 9990, label: 'Small Chama' }],
  },
  INVESTMENT_AUTOMATION: {
    name: 'Tajiri SACCO',
    tagline: 'Full investment & SACCO automation',
    monthlyPrice: 2999,
    annualPrice: 29990,
    memberLimit: 250,
    storageLimitMb: 51200,
    trialDays: 30,
    features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS', 'INVESTMENT_AUTOMATION'],
    priceTiers: [{ maxMembers: 60, monthlyPrice: 1999, annualPrice: 19990, label: 'Small Chama' }],
  },
  ENTERPRISE: {
    name: 'Institution',
    tagline: 'Custom for unions, cooperatives & large SACCOs',
    monthlyPrice: 0,
    annualPrice: 0,
    memberLimit: null,
    storageLimitMb: null,
    trialDays: 0,
    features: ['CORE', 'ADVANCED_EXPORTS', 'DOCUMENTS', 'VOTING', 'AUDIT_LOGS', 'MPESA_AUTOMATION', 'ADMIN_CONTROLS', 'INVESTMENT_AUTOMATION'],
  },
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
