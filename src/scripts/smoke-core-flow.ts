import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { queueRedis, redis, RedisService } from '../config/redis';
import { AuthService } from '../services/authService';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
let smokeSessionId: string | undefined;
let smokeUserId: string | undefined;

type CheckResult = {
  name: string;
  path: string;
  status: number;
  ok: boolean;
  detail?: string;
};

async function request(path: string, token?: string): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

async function main(): Promise<void> {
  const membership = await prisma.organizationMember.findFirst({
    where: { status: 'ACTIVE', user: { isActive: true } },
    select: {
      organizationId: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!membership) {
    throw new Error('Smoke test requires one active organization member.');
  }

  smokeSessionId = `smoke-${randomUUID()}`;
  smokeUserId = membership.user.id;
  await RedisService.set(`session:v2:${smokeSessionId}`, {
    userId: membership.user.id,
    email: membership.user.email,
    sessionId: smokeSessionId,
    createdAt: new Date(),
    lastActivity: new Date(),
    userAgent: 'CHAMA360 smoke test',
    mfaVerified: false,
  }, 300);
  await RedisService.sadd(`user_sessions:v2:${smokeUserId}`, smokeSessionId);
  await RedisService.expire(`user_sessions:v2:${smokeUserId}`, 300);
  const token = AuthService.generateAccessToken({
    userId: membership.user.id,
    email: membership.user.email,
    sessionId: smokeSessionId,
  });
  const organizationId = membership.organizationId;
  const checks: Array<{ name: string; path: string; allowed?: number[] }> = [
    { name: 'Current user', path: '/auth/me' },
    { name: 'User profile', path: '/user/profile' },
    { name: 'Notifications', path: '/user/notifications?limit=50' },
    { name: 'Organizations', path: '/organizations/my' },
    { name: 'Organization workspace', path: `/organizations/${organizationId}` },
    { name: 'Members', path: `/organizations/${organizationId}/members` },
    { name: 'Contributions', path: `/organizations/${organizationId}/contributions` },
    { name: 'Contribution summary', path: `/organizations/${organizationId}/contributions/summary` },
    { name: 'Loans', path: `/organizations/${organizationId}/loans` },
    { name: 'Loan summary', path: `/organizations/${organizationId}/loans/summary` },
    { name: 'Welfare claims', path: `/organizations/${organizationId}/welfare/claims` },
    { name: 'Meetings', path: `/organizations/${organizationId}/meetings` },
    { name: 'Subscription', path: `/subscriptions/me?organizationId=${organizationId}` },
    { name: 'Custom package request', path: `/subscriptions/custom-request?organizationId=${organizationId}` },
    { name: 'Premium audit prompt', path: `/organizations/${organizationId}/audit-logs`, allowed: [200, 402, 403] },
  ];

  const results: CheckResult[] = [];
  for (const check of checks) {
    const response = await request(check.path, token);
    const allowed = check.allowed ?? [200];
    const ok = allowed.includes(response.status);
    results.push({
      name: check.name,
      path: check.path,
      status: response.status,
      ok,
      detail: ok ? undefined : (await response.text()).slice(0, 2_000),
    });
  }

  const unauthorized = await request('/auth/me');
  results.push({
    name: 'Protected route rejects anonymous access',
    path: '/auth/me',
    status: unauthorized.status,
    ok: unauthorized.status === 401,
  });

  console.table(results.map(({ name, status, ok }) => ({ check: name, status, result: ok ? 'PASS' : 'FAIL' })));
  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${failure.name}: ${failure.detail ?? 'No response body'}`);
    }
    throw new Error(`${failures.length} smoke check(s) failed: ${failures.map((failure) => failure.name).join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (smokeSessionId && smokeUserId) {
      await RedisService.del(`session:v2:${smokeSessionId}`);
      await RedisService.del(`user_sessions:v2:${smokeUserId}`);
    }
    await prisma.$disconnect();
    redis.disconnect();
    queueRedis.disconnect();
    process.exit(process.exitCode ?? 0);
  });
