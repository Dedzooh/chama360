import { rateLimitSensitive, requireMfaIfEnabled } from '../middleware/auth';
import { AuthService } from '../services/authService';
import { prisma } from '../config/database';
import { AppError, ForbiddenError } from '../middleware/errorHandler';
import { RedisService } from '../config/redis';

jest.mock('../config/database', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

jest.mock('../services/authService', () => ({
  AuthService: { getSession: jest.fn(), fingerprintToken: jest.fn((value: string) => `hash-${value}`) },
}));

jest.mock('../config/redis', () => ({
  RedisService: { incrementWithExpiry: jest.fn() },
}));

const mockPrisma = prisma as any;
const mockAuth = AuthService as jest.Mocked<typeof AuthService>;
const mockRedis = RedisService as jest.Mocked<typeof RedisService>;
const request = {
  user: {
    id: 'user123',
    email: 'member@example.com',
    sessionId: 'session123',
    kycStatus: 'VERIFIED',
    isActive: true,
  },
} as any;

describe('requireMfaIfEnabled', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows users who have not enrolled in MFA', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: false });
    const next = jest.fn();

    await requireMfaIfEnabled(request, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockAuth.getSession).not.toHaveBeenCalled();
  });

  it('allows an enrolled user only when this session completed MFA', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });
    mockAuth.getSession.mockResolvedValue({
      userId: 'user123',
      email: 'member@example.com',
      sessionId: 'session123',
      createdAt: new Date(),
      lastActivity: new Date(),
      mfaVerified: true,
    });
    const next = jest.fn();

    await requireMfaIfEnabled(request, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an enrolled user whose current session did not complete MFA', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });
    mockAuth.getSession.mockResolvedValue({
      userId: 'user123',
      email: 'member@example.com',
      sessionId: 'session123',
      createdAt: new Date(),
      lastActivity: new Date(),
      mfaVerified: false,
    });
    const next = jest.fn();

    await requireMfaIfEnabled(request, {} as any, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });
});

describe('rateLimitSensitive', () => {
  const response = { setHeader: jest.fn() } as any;

  beforeEach(() => jest.clearAllMocks());

  it('allows requests within the per-action limit and publishes quota headers', async () => {
    mockRedis.incrementWithExpiry.mockResolvedValue({ count: 3, ttl: 42 });
    const next = jest.fn();
    const rateRequest = { ...request, method: 'POST', baseUrl: '/api/v1/loan', path: '/loan1/approve', route: { path: '/:loanId/approve' } };

    await rateLimitSensitive(rateRequest as any, response, next);

    expect(response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '7');
    expect(next).toHaveBeenCalledWith();
  });

  it('returns a 429 error and retry timing after the limit', async () => {
    mockRedis.incrementWithExpiry.mockResolvedValue({ count: 11, ttl: 37 });
    const next = jest.fn();
    const rateRequest = { ...request, method: 'PATCH', baseUrl: '/api/v1/organization', path: '/pay', route: { path: '/:id/welfare/claims/:claimId/pay' } };

    await rateLimitSensitive(rateRequest as any, response, next);

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '37');
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    expect(next.mock.calls[0][0].statusCode).toBe(429);
  });
});
