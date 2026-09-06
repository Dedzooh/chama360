import { getLifecycleTransition } from '../services/subscriptionLifecycleService';
import { planHasFeature } from '../config/subscriptions';
import { isSystemAdminEmail } from '../middleware/systemAdmin';

const now = new Date('2026-07-13T12:00:00.000Z');
const base = { plan: 'GROWTH' as const, status: 'ACTIVE' as const, currentPeriodEnd: new Date('2026-07-12T12:00:00.000Z'), gracePeriodEnd: null, cancelAtPeriodEnd: false };

describe('subscription release safety', () => {
  it('moves an expired paid plan into a three-day grace period', () => {
    const result = getLifecycleTransition(base, now);
    expect(result?.status).toBe('PAST_DUE');
    expect(result?.gracePeriodEnd?.toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });
  it('downgrades after the grace period', () => {
    const result = getLifecycleTransition({ ...base, status: 'PAST_DUE', gracePeriodEnd: new Date('2026-07-13T11:59:00.000Z') }, now);
    expect(result).toMatchObject({ plan: 'FREE', status: 'EXPIRED' });
  });
  it('honours cancellation only after the paid-through date', () => {
    expect(getLifecycleTransition({ ...base, currentPeriodEnd: new Date('2026-07-14T12:00:00.000Z'), cancelAtPeriodEnd: true }, now)).toBeNull();
    expect(getLifecycleTransition({ ...base, cancelAtPeriodEnd: true }, now)).toMatchObject({ plan: 'FREE', status: 'CANCELLED' });
  });
  it('enforces the feature matrix', () => {
    expect(planHasFeature('FREE', 'VOTING')).toBe(false);
    expect(planHasFeature('GROWTH', 'VOTING')).toBe(true);
    expect(planHasFeature('STARTER', 'DOCUMENTS')).toBe(true);
    expect(planHasFeature('GROWTH', 'AUDIT_LOGS')).toBe(true);
    expect(planHasFeature('PRO', 'AUDIT_LOGS')).toBe(true);
  });
  it('matches platform admins case-insensitively and rejects other users', () => {
    expect(isSystemAdminEmail(' Owner@Example.com ', ['owner@example.com'])).toBe(true);
    expect(isSystemAdminEmail('member@example.com', ['owner@example.com'])).toBe(false);
  });
});
