import { planHasFeature, subscriptionPlans } from '../config/subscriptions';

describe('paid feature entitlement matrix', () => {
  const expectations: Array<[string, keyof typeof subscriptionPlans]> = [
    ['ADVANCED_EXPORTS', 'STARTER'],
    ['DOCUMENTS', 'STARTER'],
    ['VOTING', 'GROWTH'],
    ['AUDIT_LOGS', 'GROWTH'],
    ['ADMIN_CONTROLS', 'GROWTH'],
    ['MPESA_AUTOMATION', 'PRO'],
    ['INVESTMENT_AUTOMATION', 'INVESTMENT_AUTOMATION'],
  ];

  it.each(expectations)('%s starts at %s', (feature, plan) => {
    expect(planHasFeature(plan, feature)).toBe(true);
    expect(planHasFeature('FREE', feature)).toBe(false);
    expect(plan).not.toBe('FREE');
  });
});
