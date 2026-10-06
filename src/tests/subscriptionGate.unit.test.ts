import { isSubscriptionFeatureActive } from '../middleware/subscription';
import { isTrialActive } from '../services/subscriptionLifecycleService';
import { planHasFeature } from '../config/subscriptions';

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
    // Plan is FREE after downgrade but trial is still live — features stay unlocked.
    expect(planHasFeature('FREE', 'MPESA_AUTOMATION')).toBe(false);
    expect(isSubscriptionFeatureActive({ status: 'ACTIVE', gracePeriodEnd: null }, now) || isTrialActive(trial, now)).toBe(true);
  });

  it('stops granting trial features once the trial has expired', () => {
    const expiredTrial = { trialEndsAt: new Date('2026-09-10T12:00:00.000Z') };
    expect(isTrialActive(expiredTrial, now)).toBe(false);
    expect(planHasFeature('FREE', 'MPESA_AUTOMATION')).toBe(false);
  });

  it('does not grant Community paid features', () => {
    expect(planHasFeature('FREE', 'ADVANCED_EXPORTS')).toBe(false);
    expect(planHasFeature('FREE', 'ADMIN_CONTROLS')).toBe(false);
    expect(planHasFeature('FREE', 'MPESA_AUTOMATION')).toBe(false);
  });
});