import { AuthService } from '../services/authService';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { UnauthorizedError, BadRequestError } from '../middleware/errorHandler';

// Mock dependencies
jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    mfaRecoveryCode: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../config/redis', () => ({
  RedisService: {
    set: jest.fn(),
    setIfAbsent: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
    srem: jest.fn(),
  },
}));

jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  auditLog: jest.fn(),
}));

const mockPrisma = prisma as any;
const mockRedis = RedisService as any;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.smembers.mockResolvedValue([]);
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123!';
      const hash = await AuthService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hash = await AuthService.hashPassword(password);
      
      const isValid = await AuthService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hash = await AuthService.hashPassword(password);
      
      const isValid = await AuthService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate unique tokens', () => {
      const token1 = AuthService.generateSecureToken();
      const token2 = AuthService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('fingerprintToken', () => {
    it('creates a deterministic one-way fingerprint without retaining the token', () => {
      const token = 'sensitive-refresh-token';
      const fingerprint = AuthService.fingerprintToken(token);
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(fingerprint).not.toContain(token);
      expect(AuthService.fingerprintToken(token)).toBe(fingerprint);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate valid JWT access token', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const token = AuthService.generateAccessToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid JWT refresh token', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const token = AuthService.generateRefreshToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('createSession', () => {
    it('should create session for active user', async () => {
      const userId = 'user123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.refreshToken.create.mockResolvedValue({} as any);
      mockRedis.set.mockResolvedValue();
      mockRedis.setIfAbsent.mockResolvedValue(true);
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      const tokens = await AuthService.createSession(userId, '127.0.0.1', 'test-agent');

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      const persisted = mockPrisma.refreshToken.create.mock.calls[0][0].data;
      expect(persisted.tokenHash).toBe(AuthService.fingerprintToken(tokens.refreshToken));
      expect(persisted.token).toBeUndefined();
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:v2:/),
        expect.objectContaining({ mfaVerified: false }),
        expect.any(Number),
      );
    });

    it('should throw error for inactive user', async () => {
      const userId = 'user123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        isActive: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(AuthService.createSession(userId)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw error for non-existent user', async () => {
      const userId = 'user123';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.createSession(userId)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const token = AuthService.generateAccessToken(payload);
      
      mockRedis.exists.mockResolvedValue(false); // Not blacklisted
      mockRedis.exists.mockResolvedValueOnce(false); // Not blacklisted
      mockRedis.exists.mockResolvedValueOnce(true); // Session exists
      mockPrisma.user.findFirst.mockResolvedValue({ id: payload.userId });

      const verifiedPayload = await AuthService.verifyAccessToken(token);

      expect(verifiedPayload.userId).toBe(payload.userId);
      expect(verifiedPayload.email).toBe(payload.email);
      expect(verifiedPayload.sessionId).toBe(payload.sessionId);
    });

    it('should reject blacklisted token', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const token = AuthService.generateAccessToken(payload);
      
      mockRedis.exists.mockResolvedValue(true); // Blacklisted

      await expect(AuthService.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it('should reject token with non-existent session', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const token = AuthService.generateAccessToken(payload);
      
      mockRedis.exists.mockResolvedValueOnce(false); // Not blacklisted
      mockRedis.exists.mockResolvedValueOnce(false); // Session doesn't exist
      mockPrisma.user.findFirst.mockResolvedValue({ id: payload.userId });

      await expect(AuthService.verifyAccessToken(token)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId: 'session123',
      };
      
      const refreshToken = AuthService.generateRefreshToken(payload);
      
      const mockUser = {
        id: payload.userId,
        email: payload.email,
        isActive: true,
      };

      const mockRefreshToken = {
        tokenHash: AuthService.fingerprintToken(refreshToken),
        id: 'refresh-token-1',
        familyId: 'family-1',
        userId: payload.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      };

      mockRedis.exists.mockResolvedValue(false); // Not blacklisted
      mockRedis.get.mockResolvedValue({
        userId: payload.userId,
        email: payload.email,
        sessionId: payload.sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        mfaVerified: true,
      });
      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockRefreshToken as any);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.refreshToken.create.mockResolvedValue({} as any);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue();
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      const newTokens = await AuthService.refreshTokens(refreshToken);

      expect(newTokens).toBeDefined();
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      const rotatedSession = mockRedis.set.mock.calls.find((call: any) =>
        String(call[0]).startsWith('session:v2:')
      )?.[1];
      expect(rotatedSession).toEqual(expect.objectContaining({ mfaVerified: true }));
    });

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.token.here';
      
      mockRedis.exists.mockResolvedValue(false); // Not blacklisted
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(AuthService.refreshTokens(invalidToken)).rejects.toThrow(UnauthorizedError);
    });

    it('rejects a valid refresh token whose server session was revoked', async () => {
      const payload = { userId: 'user123', email: 'test@example.com', sessionId: 'revoked-session' };
      const refreshToken = AuthService.generateRefreshToken(payload);
      mockRedis.exists.mockResolvedValue(false);
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        tokenHash: AuthService.fingerprintToken(refreshToken),
        userId: payload.userId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow('Session not found or expired');
    });
  });

    it('revokes the entire token family when a rotated token is reused', async () => {
      const payload = { userId: 'user123', email: 'test@example.com', sessionId: 'session123' };
      const refreshToken = AuthService.generateRefreshToken(payload);
      mockRedis.exists.mockResolvedValue(false);
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'refresh-token-1',
        tokenHash: AuthService.fingerprintToken(refreshToken),
        familyId: 'family-1',
        userId: payload.userId,
        isRevoked: true,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow('reuse detected');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { familyId: 'family-1', userId: payload.userId, isRevoked: false },
      }));
    });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const sessionId = 'session123';
      const mockSession = {
        userId: 'user123',
        email: 'test@example.com',
        sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockRedis.get.mockResolvedValue(mockSession);
      mockRedis.del.mockResolvedValue(1);

      await AuthService.revokeSession(sessionId);

      expect(mockRedis.del).toHaveBeenCalledWith(`session:v2:${sessionId}`);
      expect(mockRedis.srem).toHaveBeenCalledWith('user_sessions:v2:user123', sessionId);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user123', isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('should throw error for non-existent session', async () => {
      const sessionId = 'session123';

      mockRedis.get.mockResolvedValue(null);

      await expect(AuthService.revokeSession(sessionId)).rejects.toThrow();
    });

    it('does not allow a user to revoke another user’s session', async () => {
      mockRedis.get.mockResolvedValue({
        userId: 'other-user', email: 'other@example.com', sessionId: 'foreign-session',
        createdAt: new Date(), lastActivity: new Date(), mfaVerified: false,
      });

      await expect(AuthService.revokeSession('foreign-session', 'user123'))
        .rejects.toThrow('Cannot revoke session for different user');
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockRedis.srem).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllSessions', () => {
    it('immediately removes every indexed session and revokes refresh tokens', async () => {
      mockRedis.smembers.mockResolvedValue(['session1', 'session2']);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await AuthService.revokeAllSessions('user123');

      expect(mockRedis.del).toHaveBeenCalledWith('session:v2:session1');
      expect(mockRedis.del).toHaveBeenCalledWith('session:v2:session2');
      expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:v2:user123');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user123', isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });

  describe('getUserSessions', () => {
    it('returns indexed sessions by recent activity and removes stale entries', async () => {
      mockRedis.smembers.mockResolvedValue(['older', 'stale', 'newer']);
      mockRedis.get
        .mockResolvedValueOnce({
          userId: 'user123', email: 'test@example.com', sessionId: 'older',
          createdAt: '2026-01-01T00:00:00.000Z', lastActivity: '2026-01-01T01:00:00.000Z',
          mfaVerified: false,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userId: 'user123', email: 'test@example.com', sessionId: 'newer',
          createdAt: '2026-01-02T00:00:00.000Z', lastActivity: '2026-01-02T01:00:00.000Z',
          mfaVerified: true,
        });
      mockRedis.srem.mockResolvedValue(1);

      const sessions = await AuthService.getUserSessions('user123');

      expect(sessions.map(session => session.sessionId)).toEqual(['newer', 'older']);
      expect(sessions[0]!.lastActivity).toBeInstanceOf(Date);
      expect(mockRedis.srem).toHaveBeenCalledWith('user_sessions:v2:user123', 'stale');
    });

    it('does not return a session indexed under the wrong user', async () => {
      mockRedis.smembers.mockResolvedValue(['foreign']);
      mockRedis.get.mockResolvedValue({
        userId: 'another-user', email: 'other@example.com', sessionId: 'foreign',
        createdAt: new Date(), lastActivity: new Date(), mfaVerified: false,
      });

      await expect(AuthService.getUserSessions('user123')).resolves.toEqual([]);
      expect(mockRedis.srem).toHaveBeenCalledWith('user_sessions:v2:user123', 'foreign');
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for unlocked account', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.get.mockResolvedValue(null);

      const isLocked = await AuthService.isAccountLocked(identifier);
      expect(isLocked).toBe(false);
    });

    it('should return true for locked account', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.get.mockResolvedValue('5'); // 5 failed attempts

      const isLocked = await AuthService.isAccountLocked(identifier);
      expect(isLocked).toBe(true);
    });

    it('should return false for account with fewer than max attempts', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.get.mockResolvedValue('3'); // 3 failed attempts

      const isLocked = await AuthService.isAccountLocked(identifier);
      expect(isLocked).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      await AuthService.recordFailedAttempt(identifier);

      expect(mockRedis.incr).toHaveBeenCalledWith(`failed_attempts:${AuthService.fingerprintToken(identifier)}`);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should not set expiration on subsequent attempts', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.incr.mockResolvedValue(2); // Second attempt

      await AuthService.recordFailedAttempt(identifier);

      expect(mockRedis.incr).toHaveBeenCalledWith(`failed_attempts:${AuthService.fingerprintToken(identifier)}`);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('clearFailedAttempts', () => {
    it('should clear failed attempts', async () => {
      const identifier = 'test@example.com';
      
      mockRedis.del.mockResolvedValue(1);

      await AuthService.clearFailedAttempts(identifier);

      expect(mockRedis.del).toHaveBeenCalledWith(`failed_attempts:${AuthService.fingerprintToken(identifier)}`);
    });
  });

  describe('storeMfaVerification', () => {
    it('should store MFA verification token', async () => {
      const userId = 'user123';
      
      mockRedis.set.mockResolvedValue();

      const tempToken = await AuthService.storeMfaVerification(userId);

      expect(tempToken).toBeDefined();
      expect(typeof tempToken).toBe('string');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('TOTP', () => {
    it('matches the RFC 6238 SHA-1 test secret with six digits', () => {
      const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      expect(AuthService.generateTotpCode(secret, 59_000)).toBe('287082');
      expect(AuthService.verifyMfaCode('287082', secret, 59_000)).toBe(true);
      expect(AuthService.verifyMfaCode('287083', secret, 59_000)).toBe(false);
    });

    it('creates an authenticator-compatible provisioning URI', () => {
      const uri = AuthService.buildMfaProvisioningUri('ABC234', 'member@example.com');
      expect(uri).toContain('otpauth://totp/CHAMA360%3Amember%40example.com');
      expect(uri).toContain('secret=ABC234');
      expect(uri).toContain('issuer=CHAMA360');
    });

    it('encrypts MFA secrets with user-bound tamper detection', () => {
      const secret = AuthService.generateMfaSecret();
      const encrypted = AuthService.encryptMfaSecret(secret, 'user123');

      expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(encrypted).not.toContain(secret);
      expect(AuthService.decryptMfaSecret(encrypted, 'user123')).toBe(secret);
      expect(() => AuthService.decryptMfaSecret(encrypted, 'different-user')).toThrow(UnauthorizedError);

      const tamperedParts = encrypted.split('.');
      const encryptedPayload = tamperedParts[3]!;
      tamperedParts[3] = `${encryptedPayload[0] === 'A' ? 'B' : 'A'}${encryptedPayload.slice(1)}`;
      const tampered = tamperedParts.join('.');
      expect(() => AuthService.decryptMfaSecret(tampered, 'user123')).toThrow(UnauthorizedError);
    });

    it('generates unique formatted recovery codes and user-bound fingerprints', () => {
      const codes = AuthService.generateMfaRecoveryCodes();
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10);
      expect(codes.every(code => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(code))).toBe(true);
      expect(AuthService.fingerprintMfaRecoveryCode('user1', codes[0]!))
        .not.toBe(AuthService.fingerprintMfaRecoveryCode('user2', codes[0]!));
    });
  });

  describe('verifyMfaAndCreateSession', () => {
    it('should verify MFA and create session', async () => {
      const tempToken = 'temp123';
      const mfaSecret = AuthService.generateMfaSecret();
      const mfaCode = AuthService.generateTotpCode(mfaSecret);
      const userId = 'user123';
      
      const mockVerification = {
        userId,
        tempToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        mfaSecret: AuthService.encryptMfaSecret(mfaSecret, userId),
        mfaEnabled: true,
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(mockVerification);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.refreshToken.create.mockResolvedValue({} as any);
      mockRedis.set.mockResolvedValue();
      mockRedis.setIfAbsent.mockResolvedValue(true);
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      const tokens = await AuthService.verifyMfaAndCreateSession(tempToken, mfaCode);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(mockRedis.del).toHaveBeenCalledWith(`mfa:${AuthService.fingerprintToken(tempToken)}`);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:v2:/),
        expect.objectContaining({ mfaVerified: true }),
        expect.any(Number),
      );
    });

    it('rejects reuse of an accepted MFA code', async () => {
      const tempToken = 'temp-replay';
      const mfaSecret = AuthService.generateMfaSecret();
      const mfaCode = AuthService.generateTotpCode(mfaSecret);
      mockRedis.get.mockResolvedValue({ userId: 'user123', expiresAt: new Date(Date.now() + 60_000) });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user123', email: 'test@example.com',
        mfaSecret: AuthService.encryptMfaSecret(mfaSecret, 'user123'),
        mfaEnabled: true, isActive: true,
      });
      mockRedis.setIfAbsent.mockResolvedValue(false);

      await expect(AuthService.verifyMfaAndCreateSession(tempToken, mfaCode))
        .rejects.toThrow('MFA code has already been used');
    });

    it('atomically consumes a recovery code and creates an MFA-verified session', async () => {
      const tempToken = 'temp-recovery';
      const recoveryCode = 'ABCD-1234-EF56-7890';
      const userId = 'user123';
      const mfaSecret = AuthService.generateMfaSecret();
      mockRedis.get.mockResolvedValue({ userId, expiresAt: new Date(Date.now() + 60_000) });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        mfaSecret: AuthService.encryptMfaSecret(mfaSecret, userId),
        mfaEnabled: true,
        isActive: true,
      });
      mockPrisma.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.create.mockResolvedValue({} as any);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue();
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(true);

      const tokens = await AuthService.verifyMfaAndCreateSession(tempToken, recoveryCode);

      expect(tokens.accessToken).toBeDefined();
      expect(mockPrisma.mfaRecoveryCode.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          codeHash: AuthService.fingerprintMfaRecoveryCode(userId, recoveryCode),
          usedAt: null,
        },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockRedis.setIfAbsent).not.toHaveBeenCalled();
    });

    it('should reject invalid MFA verification', async () => {
      const tempToken = 'temp123';
      const mfaCode = '123456';
      
      mockRedis.get.mockResolvedValue(null);

      await expect(AuthService.verifyMfaAndCreateSession(tempToken, mfaCode))
        .rejects.toThrow(UnauthorizedError);
    });

    it('should reject user without MFA enabled', async () => {
      const tempToken = 'temp123';
      const mfaCode = '123456';
      const userId = 'user123';
      
      const mockVerification = {
        userId,
        tempToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        mfaSecret: null,
        mfaEnabled: false,
        isActive: true,
      };

      mockRedis.get.mockResolvedValue(mockVerification);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(AuthService.verifyMfaAndCreateSession(tempToken, mfaCode))
        .rejects.toThrow(BadRequestError);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired refresh tokens', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 } as any);

      await AuthService.cleanupExpiredTokens();

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { isRevoked: true },
          ],
        },
      });
    });
  });
});
