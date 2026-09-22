import { getLifecycleTransition } from '../services/subscriptionLifecycleService';
import { planHasFeature, subscriptionPlans } from '../config/subscriptions';
import { isPlatformRole, isSelfPlatformOwnerDemotion, isSystemAdminEmail, requireSystemAdmin } from '../middleware/systemAdmin';
import { ForbiddenError } from '../middleware/errorHandler';

const now = new Date('2026-07-13T12:00:00.000Z');
const base = { plan: 'GROWTH' as const, status: 'ACTIVE' as const, currentPeriodEnd: new Date('2026-07-12T12:00:00.000Z'), gracePeriodEnd: null, cancelAtPeriodEnd: false };

describe('subscription release safety', () => {
  it('moves an expired paid plan into a three-day grace period', () => {
    const result = getLifecycleTransition(base, now);
    expect(result?.status).toBe('PAST_DUE');
    expect(result?.gracePeriodEnd?.toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });
  it('moves an expired Growth trial into the same controlled grace lifecycle', () => {
    const result = getLifecycleTransition({ ...base, trialEndsAt: new Date('2026-07-12T12:00:00.000Z') } as typeof base & { trialEndsAt: Date }, now);
    expect(result?.status).toBe('PAST_DUE');
    expect(result?.gracePeriodEnd?.toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });
  it('downgrades after the grace period', () => {
    const result = getLifecycleTransition({ ...base, status: 'PAST_DUE', gracePeriodEnd: new Date('2026-07-13T11:59:00.000Z') }, now);
    expect(result).toMatchObject({ plan: 'FREE', status: 'ACTIVE' });
  });
  it('honours cancellation only after the paid-through date', () => {
    expect(getLifecycleTransition({ ...base, currentPeriodEnd: new Date('2026-07-14T12:00:00.000Z'), cancelAtPeriodEnd: true }, now)).toBeNull();
    expect(getLifecycleTransition({ ...base, cancelAtPeriodEnd: true }, now)).toMatchObject({ plan: 'FREE', status: 'ACTIVE' });
  });
  it('enforces the feature matrix', () => {
    expect(planHasFeature('FREE', 'VOTING')).toBe(false);
    expect(planHasFeature('GROWTH', 'VOTING')).toBe(true);
    expect(planHasFeature('STARTER', 'DOCUMENTS')).toBe(true);
    expect(planHasFeature('GROWTH', 'AUDIT_LOGS')).toBe(true);
    expect(planHasFeature('GROWTH', 'ADMIN_CONTROLS')).toBe(true);
    expect(planHasFeature('PRO', 'AUDIT_LOGS')).toBe(true);
  });
  it('applies the requested starter and standard pricing tiers while keeping the rest unchanged', () => {
    expect(subscriptionPlans.STARTER.monthlyPrice).toBe(150);
    expect(subscriptionPlans.STARTER.annualPrice).toBe(1500);
    expect(subscriptionPlans.STARTER.memberLimit).toBe(30);
    expect(subscriptionPlans.GROWTH.monthlyPrice).toBe(350);
    expect(subscriptionPlans.GROWTH.annualPrice).toBe(3500);
    expect(subscriptionPlans.GROWTH.memberLimit).toBe(50);
    expect(subscriptionPlans.PRO.monthlyPrice).toBe(1799);
  });
  it('matches platform admins case-insensitively and rejects other users', () => {
    expect(isSystemAdminEmail(' Owner@Example.com ', ['owner@example.com'])).toBe(true);
    expect(isSystemAdminEmail('member@example.com', ['owner@example.com'])).toBe(false);
  });
  it('keeps platform roles separate from Chama roles', () => {
    expect(isPlatformRole('PLATFORM_OWNER')).toBe(true);
    expect(isPlatformRole('FINANCE_ADMIN')).toBe(true);
    expect(isPlatformRole('OWNER')).toBe(false);
    expect(isPlatformRole(null)).toBe(false);
  });
  it('passes ordinary authenticated Chama users to the 403 path', () => {
    const next = jest.fn();
    requireSystemAdmin({ user: { id: 'member', email: 'member@example.com', sessionId: 'session', kycStatus: 'VERIFIED', isActive: true, platformRole: null } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
  it('prevents persisted and bootstrap owners from removing their own owner access', () => {
    expect(isSelfPlatformOwnerDemotion({ id: 'owner', email: 'owner@example.com', platformRole: 'PLATFORM_OWNER' }, 'owner', null)).toBe(true);
    expect(isSelfPlatformOwnerDemotion({ id: 'owner', email: 'kimdedan95@gmail.com', platformRole: null }, 'owner', 'PLATFORM_ADMIN', ['kimdedan95@gmail.com'])).toBe(true);
    expect(isSelfPlatformOwnerDemotion({ id: 'owner', email: 'owner@example.com', platformRole: 'PLATFORM_OWNER' }, 'owner', 'PLATFORM_OWNER')).toBe(false);
  });
});
