import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ConflictError 
} from '../middleware/errorHandler';
import { auditLog, logger } from '../config/logger';
import { NotificationService } from '../services/notificationService';
import { randomInt } from 'crypto';
import * as QRCode from 'qrcode';
import { IdentityProtectionService } from '../services/identityProtectionService';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string()
    .transform(phone => phone.replace(/[\s-]/g, ''))
    .refine(
      phone => /^(\+?254|0)?[17]\d{8}$/.test(phone),
      'Invalid phone number. Use 0712345678, 254712345678, or +254712345678'
    )
    .transform((phone) => {
      if (phone.startsWith('+254')) return phone;
      if (phone.startsWith('254')) return `+${phone}`;
      if (phone.startsWith('0')) return `+254${phone.slice(1)}`;
      return `+254${phone}`;
    }),
  nationalId: z.string().min(1, 'National ID is required'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }) }),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const mfaSetupSchema = z.object({
  enable: z.boolean(),
  mfaCode: z.string().regex(/^\d{6}$/, 'MFA code must be exactly 6 digits').optional(),
});

const mfaVerifySchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  mfaCode: z.string().regex(/^(?:\d{6}|[a-fA-F0-9]{4}(?:-[a-fA-F0-9]{4}){3})$/, 'Enter a 6-digit code or recovery code'),
});

interface PasswordResetRequest {
  userId: string;
  email: string;
  createdAt: string;
}

const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
const PASSWORD_RESET_TTL_SECONDS = 15 * 60;
const PASSWORD_RESET_PREFIX = 'password_reset:';
const MFA_SETUP_PREFIX = 'mfa_setup:';
const MFA_SETUP_TTL_SECONDS = 10 * 60;
const isProduction = process.env.NODE_ENV === 'production';

const generateVerificationCode = (): string => randomInt(100000, 1000000).toString();

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);
  const protectedIdentity = IdentityProtectionService.protect(validatedData.nationalId);

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: validatedData.email },
        { phone: validatedData.phone },
        { nationalIdHash: protectedIdentity.nationalIdHash },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === validatedData.email) {
      throw new ConflictError('Email already registered');
    }
    if (existingUser.phone === validatedData.phone) {
      throw new ConflictError('Phone number already registered');
    }
    if (existingUser.nationalIdHash === protectedIdentity.nationalIdHash) {
      throw new ConflictError('National ID already registered');
    }
  }

  // Hash password
  const passwordHash = await AuthService.hashPassword(validatedData.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: validatedData.email,
      passwordHash,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      phone: validatedData.phone,
      ...protectedIdentity,
      kycStatus: 'PENDING',
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      legalVersion: '2026-07-14',
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      kycStatus: true,
      createdAt: true,
    },
  });

  const emailVerificationCode = generateVerificationCode();
  await RedisService.set(`email_verification:${user.id}`, emailVerificationCode, EMAIL_VERIFICATION_TTL_SECONDS);
  await RedisService.set(`verification_resend:email:${user.id}`, '1', 60);
  let verificationDelivery: 'SENT' | 'PROVIDER_NOT_CONFIGURED' = 'SENT';
  try {
    await NotificationService.sendEmailVerification(user.email, user.firstName, emailVerificationCode);
  } catch (error) {
    verificationDelivery = 'PROVIDER_NOT_CONFIGURED';
    logger.warn('Email verification could not be delivered', {
      userId: user.id,
      reason: error instanceof Error ? error.message : 'Unknown delivery error',
    });
  }

  // Log user registration
  await prisma.commercialFunnelEvent.create({ data: { eventType: 'ACCOUNT_CREATED', userId: user.id } });
  auditLog('CREATE', user.id, undefined, {
    action: 'USER_REGISTRATION',
    email: user.email,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  logger.info('New user registered', {
    userId: user.id,
    email: user.email,
    verificationDelivery,
  });

  res.status(201).json({
    message: 'User registered successfully',
    user,
    verificationRequired: true,
    verificationDelivery,
    emailVerificationCode: isProduction ? undefined : emailVerificationCode,
  });
}));

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Check for account lockout
  const isLocked = await AuthService.isAccountLocked(email);
  if (isLocked) {
    throw new UnauthorizedError('Account temporarily locked due to failed login attempts');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      platformRole: true,
      mfaEnabled: true,
      mfaSecret: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    await AuthService.recordFailedAttempt(email);
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    await AuthService.recordFailedAttempt(email);
    throw new UnauthorizedError('Invalid credentials');
  }

  // Clear failed attempts on successful password verification
  await AuthService.clearFailedAttempts(email);

  if (!user.emailVerifiedAt) {
    let verificationCode = await RedisService.get<string>(`email_verification:${user.id}`);
    let verificationDelivery: 'PENDING' | 'SENT' | 'PROVIDER_NOT_CONFIGURED' = 'PENDING';
    if (!verificationCode) {
      verificationCode = generateVerificationCode();
      await RedisService.set(`email_verification:${user.id}`, verificationCode, EMAIL_VERIFICATION_TTL_SECONDS);
      try {
        await NotificationService.sendEmailVerification(user.email, 'Member', verificationCode);
        verificationDelivery = 'SENT';
      } catch (error) {
        verificationDelivery = 'PROVIDER_NOT_CONFIGURED';
        logger.warn('Login verification code could not be delivered', { userId: user.id, reason: error instanceof Error ? error.message : 'Unknown delivery error' });
      }
    }
    res.json({ message: 'Email verification required', verificationRequired: true, verificationDelivery, email: user.email, verificationCode: isProduction ? undefined : verificationCode });
    return;
  }

  // Check if MFA is enabled
  if (user.mfaEnabled && user.mfaSecret) {
    // Store temporary verification token
    const tempToken = await AuthService.storeMfaVerification(user.id);
    
    res.json({
      message: 'MFA verification required',
      requiresMfa: true,
      tempToken,
    });
    return;
  }

  // Create session and generate tokens
  const tokens = await AuthService.createSession(user.id, ipAddress, userAgent);

  res.json({
    message: 'Login successful',
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
    },
  });
}));

/**
 * POST /auth/mfa/verify
 * Verify MFA code and complete authentication
 */
router.post('/mfa/verify', asyncHandler(async (req: Request, res: Response) => {
  const { tempToken, mfaCode } = mfaVerifySchema.parse(req.body);
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Verify MFA and create session
  const tokens = await AuthService.verifyMfaAndCreateSession(
    tempToken,
    mfaCode,
    ipAddress,
    userAgent
  );

  res.json({
    message: 'MFA verification successful',
    ...tokens,
  });
}));

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshTokenSchema.parse(req.body);

  // Refresh tokens
  const tokens = await AuthService.refreshTokens(refreshToken);

  res.json({
    message: 'Tokens refreshed successfully',
    ...tokens,
  });
}));

/**
 * POST /auth/logout
 * Logout user and revoke session
 */
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.sessionId) {
    throw new BadRequestError('No active session');
  }

  // Revoke session
  await AuthService.revokeSession(req.user.sessionId, req.user.id);

  res.json({
    message: 'Logout successful',
  });
}));

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  // Revoke all sessions
  await AuthService.revokeAllSessions(req.user.id);

  res.json({
    message: 'Logged out from all devices',
  });
}));

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError('User not found');
  }

  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      kycStatus: true,
      mfaEnabled: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      chamaMemberships: {
        where: { status: 'ACTIVE' },
        select: {
          role: true,
          reliabilityScore: true,
          joinedAt: true,
          chama: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  res.json({
    user,
  });
}));

/**
 * PUT /auth/change-password
 * Change user password
 */
router.put('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  if (!req.user?.id) {
    throw new UnauthorizedError('User not found');
  }

  // Get current password hash
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify current password
  const isValidPassword = await AuthService.verifyPassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await AuthService.hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Revoke all sessions except current one
  await AuthService.revokeAllSessions(req.user.id);

  // Log password change
  auditLog('UPDATE', req.user.id, undefined, {
    action: 'PASSWORD_CHANGE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({
    message: 'Password changed successfully',
  });
}));

/**
 * POST /auth/mfa/setup
 * Setup or disable multi-factor authentication
 */
router.post('/mfa/setup', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { enable, mfaCode } = mfaSetupSchema.parse(req.body);

  if (!req.user?.id) {
    throw new UnauthorizedError('User not found');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { mfaEnabled: true, mfaSecret: true },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  if (enable) {
    // Enable MFA
    if (user.mfaEnabled) {
      throw new BadRequestError('MFA is already enabled');
    }

    const setupKey = `${MFA_SETUP_PREFIX}${req.user.id}`;
    if (!mfaCode) {
      const mfaSecret = AuthService.generateMfaSecret();
      await RedisService.set(setupKey, mfaSecret, MFA_SETUP_TTL_SECONDS);
      const provisioningUri = AuthService.buildMfaProvisioningUri(mfaSecret, req.user.email);
      const qrCode = await QRCode.toDataURL(provisioningUri, { errorCorrectionLevel: 'M' });

      res.status(202).json({
        message: 'Scan the QR code, then submit the current 6-digit code to confirm MFA',
        secret: mfaSecret,
        qrCode,
      });
      return;
    }

    const mfaSecret = await RedisService.get<string>(setupKey);
    if (!mfaSecret) throw new BadRequestError('MFA setup expired; start setup again');
    if (!AuthService.verifyMfaCode(mfaCode, mfaSecret)) {
      throw new UnauthorizedError('Invalid MFA code');
    }

    const recoveryCodes = AuthService.generateMfaRecoveryCodes();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          mfaEnabled: true,
          mfaSecret: AuthService.encryptMfaSecret(mfaSecret, req.user.id),
        },
      }),
      prisma.mfaRecoveryCode.deleteMany({ where: { userId: req.user.id } }),
      prisma.mfaRecoveryCode.createMany({
        data: recoveryCodes.map(code => ({
          userId: req.user!.id,
          codeHash: AuthService.fingerprintMfaRecoveryCode(req.user!.id, code),
        })),
      }),
    ]);
    await RedisService.del(setupKey);
    await AuthService.revokeAllSessions(req.user.id);

    // Log MFA setup
    auditLog('UPDATE', req.user.id, undefined, {
      action: 'MFA_ENABLED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'MFA enabled successfully',
      requiresReauthentication: true,
      recoveryCodes,
    });
  } else {
    // Disable MFA
    if (!user.mfaEnabled) {
      throw new BadRequestError('MFA is not enabled');
    }
    if (!mfaCode || !user.mfaSecret || !AuthService.verifyMfaCode(mfaCode, AuthService.decryptMfaSecret(user.mfaSecret, req.user.id))) {
      throw new UnauthorizedError('A valid current MFA code is required');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
        },
      }),
      prisma.mfaRecoveryCode.deleteMany({ where: { userId: req.user.id } }),
    ]);
    await AuthService.revokeAllSessions(req.user.id);

    // Log MFA disable
    auditLog('UPDATE', req.user.id, undefined, {
      action: 'MFA_DISABLED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'MFA disabled successfully',
      requiresReauthentication: true,
    });
  }
}));

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, isActive: true },
  });

  // Always return success to prevent email enumeration
  if (!user || !user.isActive) {
    res.json({
      message: 'If the email exists, a password reset link has been sent',
    });
    return;
  }

  const resetToken = generateVerificationCode();
  const resetRequest: PasswordResetRequest = {
    userId: user.id,
    email: user.email,
    createdAt: new Date().toISOString(),
  };

  await RedisService.set(`${PASSWORD_RESET_PREFIX}${AuthService.fingerprintToken(resetToken)}`, resetRequest, PASSWORD_RESET_TTL_SECONDS);

  let resetDelivery: 'SENT' | 'PROVIDER_NOT_CONFIGURED' = 'SENT';
  try {
    await NotificationService.sendPasswordReset(user.email, user.firstName, resetToken);
  } catch (error) {
    resetDelivery = 'PROVIDER_NOT_CONFIGURED';
    logger.warn('Password reset code could not be delivered', {
      userId: user.id,
      reason: error instanceof Error ? error.message : 'Unknown delivery error',
    });
  }
  
  logger.info('Password reset requested', {
    userId: user.id,
    email: user.email,
    resetDelivery,
    resetToken: isProduction ? undefined : resetToken,
  });

  res.json({
    message: 'If the email exists, a password reset link has been sent',
    resetToken: isProduction ? undefined : resetToken,
  });
}));

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke one other device session owned by the current user.
 */
router.delete('/sessions/:sessionId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw new UnauthorizedError('User not found');
  const { sessionId } = z.object({
    sessionId: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid session ID'),
  }).parse(req.params);
  if (sessionId === req.user.sessionId) {
    throw new BadRequestError('Use logout to end the current session');
  }

  await AuthService.revokeSession(sessionId, req.user.id);
  res.json({ message: 'Device session signed out' });
}));

/**
 * POST /auth/reset-password
 * Reset password using reset token
 */
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);

  const resetKey = `${PASSWORD_RESET_PREFIX}${AuthService.fingerprintToken(token)}`;
  const resetRequest = await RedisService.get<PasswordResetRequest>(resetKey, true);

  if (!resetRequest) {
    throw new BadRequestError('Invalid or expired reset token');
  }

  const user = await prisma.user.findUnique({
    where: { id: resetRequest.userId },
    select: { id: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    await RedisService.del(resetKey);
    throw new BadRequestError('Invalid or expired reset token');
  }

  const passwordHash = await AuthService.hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await RedisService.del(resetKey);
  await AuthService.revokeAllSessions(user.id);

  auditLog('UPDATE', user.id, undefined, {
    action: 'PASSWORD_RESET',
    email: user.email,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  logger.info('Password reset completed', {
    userId: user.id,
    email: user.email,
  });

  res.json({
    message: 'Password reset successful',
  });
}));

/**
 * GET /auth/sessions
 * Get active sessions for current user
 */
router.get('/sessions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError('User not found');
  }

  const sessions = await AuthService.getUserSessions(req.user.id);

  res.json({
    sessions: sessions.map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      current: session.sessionId === req.user!.sessionId,
    })),
  });
}));

export { router as authRouter };
