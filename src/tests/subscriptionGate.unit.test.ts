import { isSubscriptionFeatureActive } from '../middleware/subscription';
import { hasFeatureAccess, isTrialActive, planHasFeature } from '../config/subscriptions';

describe('paid feature gate invariants', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('allows active Growth trials and plans before their grace boundary', () => {
    expect(isSubscriptionFeatureActive({ status: 'ACTIVE', gracePeriodEnd: null }, now)).toBe(true);
    expect(planHasFeature('GROWTH', 'VOTING')).toBe(true);
  });

  it('allows an active past-due subscription only inside grace', () => {
    expect(isSubscriptionFeatureActive({ status: 'PAST_DUE', gracePeriodEnd: new Date('2026-09-21T12:00:00.000Z') }, now)).toBe(true);
    expect(isSubscriptionFeatureActive({ status: 'PAST_DUE', gracePeriodEnd: new Date('2026-09-19T12:00:00.000Z') }, now)).toBe(false);
  });

  it('grants every feature while the 30-day trial is active, regardless of plan', () => {
    const trial = { trialEndsAt: new Date('2026-09-30T12:00:00.000Z') };
    expect(isTrialActive(trial, now)).toBe(true);
    // Centralized entitlement: trial active → every feature unlocked, any plan.
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'FREE', trialEndsAt: trial.trialEndsAt }, now)).toBe(true);
    expect(hasFeatureAccess('ADMIN_CONTROLS', { plan: 'FREE', trialEndsAt: trial.trialEndsAt }, now)).toBe(true);
  });

  it('stops granting trial features once the trial has expired', () => {
    const expiredTrial = { trialEndsAt: new Date('2026-09-10T12:00:00.000Z') };
    expect(isTrialActive(expiredTrial, now)).toBe(false);
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'FREE', trialEndsAt: expiredTrial.trialEndsAt }, now)).toBe(false);
    // A paid plan with the feature still passes after the trial.
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'PRO', trialEndsAt: expiredTrial.trialEndsAt }, now)).toBe(true);
  });

  it('does not grant Community paid features', () => {
    expect(planHasFeature('FREE', 'ADVANCED_EXPORTS')).toBe(false);
    expect(planHasFeature('FREE', 'ADMIN_CONTROLS')).toBe(false);
    expect(planHasFeature('FREE', 'MPESA_AUTOMATION')).toBe(false);
  });
});
describe('entitlement matrix: trial x plan x feature', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');
  const activeTrial = new Date('2026-09-30T12:00:00.000Z');
  const expiredTrial = new Date('2026-09-10T12:00:00.000Z');

  it('covers the required trial/plan/feature cases', () => {
    // active trial + premium feature = allowed (any plan)
    for (const plan of ['FREE', 'STARTER', 'GROWTH', 'PRO', 'INVESTMENT_AUTOMATION'] as const) {
      expect(hasFeatureAccess('MPESA_AUTOMATION', { plan, trialEndsAt: activeTrial }, now)).toBe(true);
    }
    // expired trial + free plan + premium feature = denied
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'FREE', trialEndsAt: expiredTrial }, now)).toBe(false);
    // expired trial + premium plan + premium feature = allowed
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'PRO', trialEndsAt: expiredTrial }, now)).toBe(true);
    // expired trial + non-eligible plan + M-Pesa automation = denied
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'GROWTH', trialEndsAt: expiredTrial }, now)).toBe(false);
    // active trial + M-Pesa automation = allowed
    expect(hasFeatureAccess('MPESA_AUTOMATION', { plan: 'FREE', trialEndsAt: activeTrial }, now)).toBe(true);
  });
});
