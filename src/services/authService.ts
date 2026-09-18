import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { config } from '../config/environment';
import { logger, auditLog } from '../config/logger';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../middleware/errorHandler';

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Authentication tokens interface
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// User session interface
export interface UserSession {
  userId: string;
  email: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  mfaVerified: boolean;
}

// MFA verification interface
export interface MfaVerification {
  userId: string;
  expiresAt: Date;
}

export class AuthService {
  // Versioning the namespace invalidates sessions created before the secure
  // session-index rollout, including any that cannot be enumerated safely.
  private static readonly SESSION_PREFIX = 'session:v2:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:v2:';
  private static readonly MFA_PREFIX = 'mfa:';
  private static readonly MFA_FAILURES_PREFIX = 'mfa_failures:';
  private static readonly MFA_USED_CODE_PREFIX = 'mfa_used_code:';
  private static readonly BLACKLIST_PREFIX = 'blacklist:';
  private static readonly FAILED_ATTEMPTS_PREFIX = 'failed_attempts:';
  
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

  private static sessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private static userSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }

  private static async indexSession(userId: string, sessionId: string): Promise<void> {
    const key = this.userSessionsKey(userId);
    await RedisService.sadd(key, sessionId);
    await RedisService.expire(key, this.SESSION_DURATION);
  }

  private static async unindexSession(userId: string, sessionId: string): Promise<void> {
    await RedisService.srem(this.userSessionsKey(userId), sessionId);
  }

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  static fingerprintToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate JWT access token
   */
  static generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as StringValue,
      issuer: 'chama-management-system',
      audience: 'chama-users',
    };
    return jwt.sign(payload, config.jwt.secret as string, options);
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as StringValue,
      issuer: 'chama-management-system',
      audience: 'chama-users',
    };
    return jwt.sign(payload, config.jwt.refreshSecret as string, options);
  }
  /**
   * Generate both access and refresh tokens without creating a session
   */
  static generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>): AuthTokens {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + this.parseTimeToMs(config.jwt.expiresIn)),
    };
  }
  /**
   * Verify JWT access token
   */
  static async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await RedisService.exists(`${this.BLACKLIST_PREFIX}${this.fingerprintToken(token)}`);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }

      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: 'chama-management-system',
        audience: 'chama-users',
      }) as JwtPayload;

      const activeUser = await prisma.user.findFirst({
        where: { id: payload.userId, isActive: true },
        select: { id: true },
      });
      if (!activeUser) {
        throw new UnauthorizedError('Account is inactive');
      }

      // Verify session exists in Redis
      const sessionExists = await RedisService.exists(this.sessionKey(payload.sessionId));
      if (!sessionExists) {
        throw new UnauthorizedError('Session not found or expired');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw error;
    }
  }

  /**
   * Verify JWT refresh token
   */
  static async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await RedisService.exists(`${this.BLACKLIST_PREFIX}${this.fingerprintToken(token)}`);
      if (isBlacklisted) {
        throw new UnauthorizedError('Refresh token has been revoked');
      }

      const payload = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'chama-management-system',
        audience: 'chama-users',
      }) as JwtPayload;

      // Verify refresh token exists in database
      const refreshTokenRecord = await prisma.refreshToken.findFirst({
        where: {
          tokenHash: this.fingerprintToken(token),
          userId: payload.userId,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!refreshTokenRecord) {
        throw new UnauthorizedError('Refresh token not found or expired');
      }
      if (refreshTokenRecord.isRevoked) {
        await this.revokeRefreshTokenFamily(refreshTokenRecord.familyId, payload.userId);
        throw new UnauthorizedError('Refresh token reuse detected; session family revoked');
      }

      const session = await RedisService.get<UserSession>(this.sessionKey(payload.sessionId), true);
      if (!session || session.userId !== payload.userId) {
        throw new UnauthorizedError('Session not found or expired');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Create user session and generate tokens
   */
  static async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    mfaVerified = false,
  ): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate session ID
    const sessionId = this.generateSecureToken();

    // Create JWT payload
    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      sessionId,
    };

    // Generate tokens
    const accessToken = this.generateAccessToken(jwtPayload);
    const refreshToken = this.generateRefreshToken(jwtPayload);

    // Calculate expiration dates
    const accessTokenExpiry = new Date(Date.now() + this.parseTimeToMs(config.jwt.expiresIn));
    const refreshTokenExpiry = new Date(Date.now() + this.parseTimeToMs(config.jwt.refreshExpiresIn));

    // Store session in Redis
    const session: UserSession = {
      userId: user.id,
      email: user.email,
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress,
      userAgent,
      mfaVerified,
    };

    await RedisService.set(
      this.sessionKey(sessionId),
      session,
      this.SESSION_DURATION
    );
    await this.indexSession(user.id, sessionId);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        tokenHash: this.fingerprintToken(refreshToken),
        familyId: sessionId,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Log successful authentication
    auditLog('LOGIN', user.id, undefined, {
      sessionId,
      ipAddress,
      userAgent,
      mfaVerified,
    });

    logger.info('User session created', {
      userId: user.id,
      sessionId,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: accessTokenExpiry,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = await this.verifyRefreshToken(refreshToken);
    const previousSession = await this.getSession(payload.sessionId);
    if (!previousSession || previousSession.userId !== payload.userId) {
      throw new UnauthorizedError('Session not found or expired');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const currentToken = await prisma.refreshToken.findFirst({
      where: { tokenHash: this.fingerprintToken(refreshToken), userId: user.id },
    });
    if (!currentToken || currentToken.userId !== user.id) {
      throw new UnauthorizedError('Refresh token not found or expired');
    }

    // Claim the token exactly once. A second use indicates token reuse.
    const claimed = await prisma.refreshToken.updateMany({
      where: {
        id: currentToken.id,
        userId: user.id,
        isRevoked: false,
        usedAt: null,
      },
      data: {
        isRevoked: true,
        usedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      await this.revokeRefreshTokenFamily(currentToken.familyId ?? payload.sessionId, user.id);
      throw new UnauthorizedError('Refresh token reuse detected; session family revoked');
    }

    // Generate new session ID for security
    const newSessionId = this.generateSecureToken();

    // Create new JWT payload
    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      sessionId: newSessionId,
    };

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(jwtPayload);
    const newRefreshToken = this.generateRefreshToken(jwtPayload);

    // Calculate expiration dates
    const accessTokenExpiry = new Date(Date.now() + this.parseTimeToMs(config.jwt.expiresIn));
    const refreshTokenExpiry = new Date(Date.now() + this.parseTimeToMs(config.jwt.refreshExpiresIn));

    // Update session in Redis
    const session: UserSession = {
      userId: user.id,
      email: user.email,
      sessionId: newSessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      mfaVerified: previousSession.mfaVerified === true,
    };

    // Remove old session
    await RedisService.del(this.sessionKey(payload.sessionId));
    await this.unindexSession(user.id, payload.sessionId);

    // Store new session
    await RedisService.set(
      this.sessionKey(newSessionId),
      session,
      this.SESSION_DURATION
    );
    await this.indexSession(user.id, newSessionId);

    // Store new refresh token in database
    await prisma.refreshToken.create({
      data: {
        tokenHash: this.fingerprintToken(newRefreshToken),
        familyId: currentToken.familyId ?? payload.sessionId,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Blacklist old tokens
    await this.blacklistToken(refreshToken);

    logger.info('Tokens refreshed', {
      userId: user.id,
      oldSessionId: payload.sessionId,
      newSessionId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: accessTokenExpiry,
    };
  }

  private static async revokeRefreshTokenFamily(familyId: string, userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { familyId, userId, isRevoked: false },
      data: { isRevoked: true, usedAt: new Date() },
    });

    const sessionIds = await RedisService.smembers(this.userSessionsKey(userId));
    await Promise.all(sessionIds.map((sessionId) => RedisService.del(this.sessionKey(sessionId))));
    await RedisService.del(this.userSessionsKey(userId));
  }

  /**
   * Revoke user session and tokens
   */
  static async revokeSession(sessionId: string, userId?: string): Promise<void> {
    // Get session from Redis
    const session = await RedisService.get<UserSession>(this.sessionKey(sessionId), true);
    
    if (!session) {
      throw new NotFoundError('Session');
    }

    // Verify user ownership if userId provided
    if (userId && session.userId !== userId) {
      throw new UnauthorizedError('Cannot revoke session for different user');
    }

    // Remove session from Redis
    await RedisService.del(this.sessionKey(sessionId));
    await this.unindexSession(session.userId, sessionId);

    // Refresh tokens are currently user-scoped rather than session-scoped.
    // Revoke them when a session is explicitly terminated so a copied refresh
    // token cannot recreate the logged-out session.
    await prisma.refreshToken.updateMany({
      where: { userId: session.userId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Log logout
    auditLog('LOGOUT', session.userId, undefined, {
      sessionId,
    });

    logger.info('User session revoked', {
      userId: session.userId,
      sessionId,
    });
  }

  /**
   * Revoke all sessions for a user
   */
  static async revokeAllSessions(userId: string): Promise<void> {
    const indexKey = this.userSessionsKey(userId);
    const sessionIds = await RedisService.smembers(indexKey);

    if (sessionIds.length > 0) {
      await Promise.all(sessionIds.map(sessionId => RedisService.del(this.sessionKey(sessionId))));
    }
    await RedisService.del(indexKey);

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    logger.info('All user sessions revoked', { userId, sessionCount: sessionIds.length });
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await RedisService.get<UserSession>(this.sessionKey(sessionId), true);
    
    if (session) {
      session.lastActivity = new Date();
      await RedisService.set(
        this.sessionKey(sessionId),
        session,
        this.SESSION_DURATION
      );
      await RedisService.expire(this.userSessionsKey(session.userId), this.SESSION_DURATION);
    }
  }

  /**
   * Blacklist a token
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      // Decode token to get expiration
      const decoded = jwt.decode(token) as JwtPayload;
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await RedisService.set(`${this.BLACKLIST_PREFIX}${this.fingerprintToken(token)}`, 'true', ttl);
        }
      } else {
        await RedisService.set(`${this.BLACKLIST_PREFIX}${this.fingerprintToken(token)}`, 'true', 24 * 60 * 60);
      }
    } catch (error) {
      // If we can't decode the token, blacklist it for a default duration
      await RedisService.set(`${this.BLACKLIST_PREFIX}${this.fingerprintToken(token)}`, 'true', 24 * 60 * 60); // 24 hours
    }
  }

  /**
   * Check if user account is locked due to failed attempts
   */
  static async isAccountLocked(identifier: string): Promise<boolean> {
    const attempts = await RedisService.get(`${this.FAILED_ATTEMPTS_PREFIX}${this.fingerprintToken(identifier.trim().toLowerCase())}`);
    return attempts !== null && parseInt(attempts) >= this.MAX_FAILED_ATTEMPTS;
  }

  /**
   * Record failed login attempt
   */
  static async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${this.fingerprintToken(identifier.trim().toLowerCase())}`;
    const attempts = await RedisService.incr(key);
    
    if (attempts === 1) {
      // Set expiration on first attempt
      await RedisService.expire(key, this.LOCKOUT_DURATION);
    }

    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      logger.warn('Account locked due to failed attempts', {
        identifier,
        attempts,
      });
    }
  }

  /**
   * Clear failed login attempts
   */
  static async clearFailedAttempts(identifier: string): Promise<void> {
    await RedisService.del(`${this.FAILED_ATTEMPTS_PREFIX}${this.fingerprintToken(identifier.trim().toLowerCase())}`);
  }

  /**
   * Generate MFA secret for user
   */
  static generateMfaSecret(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = randomBytes(20);
    let bits = '';
    for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');

    let secret = '';
    for (let offset = 0; offset < bits.length; offset += 5) {
      secret += alphabet[parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2)];
    }
    return secret;
  }

  static generateTotpCode(secret: string, timestamp = Date.now()): string {
    const normalized = secret.toUpperCase().replace(/=+$/g, '');
    if (!/^[A-Z2-7]+$/.test(normalized)) throw new BadRequestError('Invalid MFA secret');

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const character of normalized) {
      bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
    }
    const secretBytes = Buffer.alloc(Math.floor(bits.length / 8));
    for (let index = 0; index < secretBytes.length; index += 1) {
      secretBytes[index] = parseInt(bits.slice(index * 8, index * 8 + 8), 2);
    }

    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 1000 / 30)));
    const digest = createHmac('sha1', secretBytes).update(counter).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return binary.toString().padStart(6, '0');
  }

  static verifyMfaCode(code: string, secret: string, timestamp = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;

    const submitted = Buffer.from(code);
    // Permit one 30-second step of clock drift in either direction.
    return [-1, 0, 1].some(step => {
      const expected = Buffer.from(this.generateTotpCode(secret, timestamp + step * 30_000));
      return submitted.length === expected.length && timingSafeEqual(submitted, expected);
    });
  }

  static buildMfaProvisioningUri(secret: string, email: string): string {
    const issuer = 'CHAMA360';
    const label = `${issuer}:${email}`;
    return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  static generateMfaRecoveryCodes(count = 10): string[] {
    return Array.from({ length: count }, () => randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-'));
  }

  static fingerprintMfaRecoveryCode(userId: string, code: string): string {
    return this.fingerprintToken(`${userId}:${code.replace(/[^a-fA-F0-9]/g, '').toUpperCase()}`);
  }

  private static mfaEncryptionKey(): Buffer {
    if (config.security.mfaEncryptionKey) return Buffer.from(config.security.mfaEncryptionKey, 'hex');
    if (!config.server.isProduction) {
      return createHash('sha256').update(`development-mfa:${config.security.sessionSecret}`).digest();
    }
    throw new Error('MFA_ENCRYPTION_KEY is required in production');
  }

  static encryptMfaSecret(secret: string, userId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.mfaEncryptionKey(), iv);
    cipher.setAAD(Buffer.from(userId));
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  static decryptMfaSecret(encrypted: string, userId: string): string {
    const parts = encrypted.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new UnauthorizedError('MFA enrollment must be renewed');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.mfaEncryptionKey(), Buffer.from(parts[1]!, 'base64url'));
      decipher.setAAD(Buffer.from(userId));
      decipher.setAuthTag(Buffer.from(parts[2]!, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(parts[3]!, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new UnauthorizedError('MFA secret could not be decrypted');
    }
  }

  /**
   * Store temporary MFA verification token
   */
  static async storeMfaVerification(userId: string): Promise<string> {
    const tempToken = this.generateSecureToken();
    const verification: MfaVerification = {
      userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    await RedisService.set(
      `${this.MFA_PREFIX}${this.fingerprintToken(tempToken)}`,
      verification,
      5 * 60 // 5 minutes
    );

    return tempToken;
  }

  /**
   * Verify MFA token and complete authentication
   */
  static async verifyMfaAndCreateSession(
    tempToken: string,
    mfaCode: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    // Get MFA verification
    const verification = await RedisService.get<MfaVerification>(`${this.MFA_PREFIX}${this.fingerprintToken(tempToken)}`, true);
    
    if (!verification) {
      throw new UnauthorizedError('MFA verification expired or not found');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: verification.userId },
      select: { id: true, email: true, mfaSecret: true, mfaEnabled: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestError('MFA not enabled for this user');
    }

    const mfaSecret = this.decryptMfaSecret(user.mfaSecret, user.id);
    let isValidMfaCode = this.verifyMfaCode(mfaCode, mfaSecret);
    let usedRecoveryCode = false;
    if (!isValidMfaCode && /^[a-fA-F0-9]{4}(?:-[a-fA-F0-9]{4}){3}$/.test(mfaCode)) {
      const consumed = await prisma.mfaRecoveryCode.updateMany({
        where: {
          userId: user.id,
          codeHash: this.fingerprintMfaRecoveryCode(user.id, mfaCode),
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      isValidMfaCode = consumed.count === 1;
      usedRecoveryCode = isValidMfaCode;
    }
    if (!isValidMfaCode) {
      const failuresKey = `${this.MFA_FAILURES_PREFIX}${this.fingerprintToken(tempToken)}`;
      const failures = await RedisService.incr(failuresKey);
      if (failures === 1) await RedisService.expire(failuresKey, 5 * 60);
      if (failures >= 5) {
        await RedisService.del(`${this.MFA_PREFIX}${this.fingerprintToken(tempToken)}`);
        await RedisService.del(failuresKey);
      }
      throw new UnauthorizedError('Invalid MFA code');
    }

    // Recovery codes are consumed atomically in the database. TOTP codes need a
    // short replay cache because the same value is valid throughout its time step.
    if (!usedRecoveryCode) {
      const usedCodeKey = `${this.MFA_USED_CODE_PREFIX}${this.fingerprintToken(`${user.id}:${mfaCode}`)}`;
      const firstUse = await RedisService.setIfAbsent(usedCodeKey, 'true', 90);
      if (!firstUse) throw new UnauthorizedError('MFA code has already been used');
    }

    // Remove MFA verification
    await RedisService.del(`${this.MFA_PREFIX}${this.fingerprintToken(tempToken)}`);
    await RedisService.del(`${this.MFA_FAILURES_PREFIX}${this.fingerprintToken(tempToken)}`);

    // Create session
    return this.createSession(user.id, ipAddress, userAgent, true);
  }

  /**
   * Parse time string to milliseconds
   */
  private static parseTimeToMs(timeStr: string): number {
    const unit = timeStr.slice(-1);
    const value = parseInt(timeStr.slice(0, -1));

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return parseInt(timeStr) * 1000; // assume seconds
    }
  }

  /**
   * Get user session information
   */
  static async getSession(sessionId: string): Promise<UserSession | null> {
    return RedisService.get<UserSession>(this.sessionKey(sessionId), true);
  }

  static async getUserSessions(userId: string): Promise<UserSession[]> {
    const indexKey = this.userSessionsKey(userId);
    const sessionIds = await RedisService.smembers(indexKey);
    const records = await Promise.all(sessionIds.map(async sessionId => ({
      sessionId,
      session: await this.getSession(sessionId),
    })));

    const staleIds = records
      .filter(record => !record.session || record.session.userId !== userId)
      .map(record => record.sessionId);
    if (staleIds.length > 0) await RedisService.srem(indexKey, ...staleIds);

    return records
      .flatMap(record => {
        const session = record.session;
        if (!session || session.userId !== userId) return [];
        return [{
          ...session,
          createdAt: new Date(session.createdAt),
          lastActivity: new Date(session.lastActivity),
        }];
      })
      .sort((left, right) => right.lastActivity.getTime() - left.lastActivity.getTime());
  }

  /**
   * Cleanup expired refresh tokens (should be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true },
        ],
      },
    });

    logger.info('Cleaned up expired refresh tokens', {
      deletedCount: result.count,
    });
  }
}

