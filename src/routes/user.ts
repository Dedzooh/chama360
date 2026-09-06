import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { 
  BadRequestError, 
  NotFoundError,
  UnauthorizedError,
  AppError,
} from '../middleware/errorHandler';
import { auditLog, logger } from '../config/logger';
import {
  userRegistrationSchema,
  profileUpdateSchema,
} from '../schemas/auth';
import {
  kycDataSchema,
  kycUpdateSchema,
  phoneVerificationSchema,
  emailVerificationSchema,
} from '../schemas/kyc';
import { NotificationService } from '../services/notificationService';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { AuthService } from '../services/authService';
import { IdentityProtectionService } from '../services/identityProtectionService';

const router = Router();
const notificationService = new NotificationService(prisma);

// Combined registration schema for user + KYC data
const fullRegistrationSchema = z.object({
  user: userRegistrationSchema,
  kyc: kycDataSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }) }),
});

// Profile update with optional KYC updates
const fullProfileUpdateSchema = z.object({
  profile: profileUpdateSchema,
  kyc: kycUpdateSchema.optional(),
});

/**
 * POST /user/register
 * Register a new user with comprehensive KYC data collection
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { user: userData, kyc: kycData } = fullRegistrationSchema.parse(req.body);
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Register user with KYC data
  const result = await UserService.registerUser(
    userData,
    kycData,
    ipAddress,
    userAgent
  );

  // Log registration
  auditLog('CREATE', result.user.id, undefined, {
    action: 'USER_REGISTRATION_WITH_KYC',
    email: result.user.email,
    kycRiskLevel: result.user.kycData?.riskLevel,
    documentsSubmitted: result.user.kycData?.documents?.length || 0,
    ipAddress,
    userAgent,
  });

  logger.info('User registered with KYC', {
    userId: result.user.id,
    email: result.user.email,
    nextSteps: result.nextSteps.length,
  });

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      kycStatus: result.user.kycStatus,
      verificationStatus: result.user.verificationStatus,
    },
    nextSteps: result.nextSteps,
    // Don't return verification tokens in response for security
    verificationRequired: {
      email: !!result.verificationTokens.emailToken,
      phone: !!result.verificationTokens.phoneToken,
    },
  });
}));

/**
 * GET /user/profile
 * Get current user profile with KYC data
 */
router.get('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const userProfile = await UserService.getUserProfile(req.user.id);

  res.json({
    user: {
      id: userProfile.id,
      email: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      phone: userProfile.phone,
      nationalId: IdentityProtectionService.mask(
        userProfile.nationalIdLast4 || userProfile.nationalId?.slice(-4),
      ),
      kycStatus: userProfile.kycStatus,
      isActive: userProfile.isActive,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
      verificationStatus: userProfile.verificationStatus,
      memberships: userProfile.memberships?.map(membership => ({
        chamaId: membership.chama.id,
        chamaName: membership.chama.name,
        chamaType: membership.chama.type,
        chamaStatus: membership.chama.status,
        role: membership.role,
        status: membership.status,
        reliabilityScore: membership.reliabilityScore,
        joinedAt: membership.joinedAt,
      })),
    },
    kycData: userProfile.kycData ? {
      // Return safe KYC data (excluding sensitive information)
      firstName: userProfile.kycData.firstName,
      lastName: userProfile.kycData.lastName,
      dateOfBirth: userProfile.kycData.dateOfBirth,
      gender: userProfile.kycData.gender,
      nationality: userProfile.kycData.nationality,
      employmentStatus: userProfile.kycData.employmentStatus,
      monthlyIncome: userProfile.kycData.monthlyIncome,
      currentAddress: userProfile.kycData.currentAddress,
      // Don't return sensitive data like documents, national ID details
    } : null,
  });
}));

/**
 * PUT /user/profile
 * Update user profile with optional KYC data
 */
router.put('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { profile: profileData, kyc: kycData } = fullProfileUpdateSchema.parse(req.body);
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Update profile
  const result = await UserService.updateProfile(
    req.user.id,
    profileData,
    kycData,
    ipAddress,
    userAgent
  );

  // Log profile update
  auditLog('UPDATE', req.user.id, undefined, {
    action: 'PROFILE_UPDATE',
    changedFields: result.changedFields,
    requiresReVerification: result.requiresReVerification,
    ipAddress,
    userAgent,
  });

  logger.info('User profile updated', {
    userId: req.user.id,
    changedFields: result.changedFields,
    requiresReVerification: result.requiresReVerification,
  });

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      phone: result.user.phone,
      kycStatus: result.user.kycStatus,
      verificationStatus: result.user.verificationStatus,
    },
    changedFields: result.changedFields,
    requiresReVerification: result.requiresReVerification,
  });
}));

/**
 * POST /user/verify-email
 * Verify user email address
 */
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { email, verificationCode } = emailVerificationSchema.parse(req.body);

  // Find user by email
  const user = await UserService.getUserByEmail(email);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify email
  const isVerified = await UserService.verifyEmail(user.id, verificationCode);

  if (isVerified) {
    // Log email verification
    auditLog('UPDATE', user.id, undefined, {
      action: 'EMAIL_VERIFIED',
      email: user.email,
    });

    logger.info('Email verified', {
      userId: user.id,
      email: user.email,
    });

    res.json({
      message: 'Email verified successfully',
      verified: true,
    });
  } else {
    throw new BadRequestError('Invalid or expired verification code');
  }
}));

/**
 * POST /user/verify-phone
 * Verify user phone number
 */
router.post('/verify-phone', asyncHandler(async (req: Request, res: Response) => {
  const { phone, verificationCode } = phoneVerificationSchema.parse(req.body);

  // Find user by phone
  const user = await UserService.getUserByPhone(phone);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify phone
  const isVerified = await UserService.verifyPhone(user.id, verificationCode);

  if (isVerified) {
    // Log phone verification
    auditLog('UPDATE', user.id, undefined, {
      action: 'PHONE_VERIFIED',
      phone: user.phone,
    });

    logger.info('Phone verified', {
      userId: user.id,
      phone: user.phone,
    });

    res.json({
      message: 'Phone verified successfully',
      verified: true,
    });
  } else {
    throw new BadRequestError('Invalid or expired verification code');
  }
}));

/**
 * POST /user/resend-verification
 * Resend verification codes for email or phone
 */
router.post('/resend-verification', asyncHandler(async (req: Request, res: Response) => {
  const { type, email } = z.object({
    type: z.literal('email'),
    email: z.string().email(),
  }).parse(req.body);
  const user = await UserService.getUserByEmail(email);
  if (!user) {
    res.json({ message: 'If the account exists, a verification code has been sent.', sent: true });
    return;
  }
  const result = await UserService.resendVerification(user.id, type);

  logger.info('Verification code resent', {
    userId: user.id,
    type,
  });

  res.json({
    message: `${type === 'email' ? 'Email' : 'Phone'} verification code sent successfully`,
    sent: result,
  });
}));

/**
 * GET /user/verification-status
 * Get current verification status for user
 */
router.get('/verification-status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const status = await UserService.getVerificationStatus(req.user.id);

  res.json({
    verificationStatus: status,
  });
}));

/**
 * POST /user/upload-document
 * Upload additional KYC documents
 */
router.post('/upload-document', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const documentSchema = z.object({
    type: z.enum(['NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT']),
    frontImage: z.string().min(1, 'Front image is required'),
    backImage: z.string().optional(),
    documentNumber: z.string().min(1, 'Document number is required'),
    issueDate: z.string().optional(),
    expiryDate: z.string().optional(),
    issuingAuthority: z.string().optional(),
  });

  const documentData = documentSchema.parse(req.body);

  const result = await UserService.uploadDocument(req.user.id, {
    ...documentData,
    issueDate: documentData.issueDate ? new Date(documentData.issueDate) : undefined,
    expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : undefined,
  });

  // Log document upload
  auditLog('CREATE', req.user.id, undefined, {
    action: 'DOCUMENT_UPLOADED',
    documentType: documentData.type,
    documentId: result.id,
  });

  logger.info('Document uploaded', {
    userId: req.user.id,
    documentType: documentData.type,
    documentId: result.id,
  });

  res.status(201).json({
    message: 'Document uploaded successfully',
    document: {
      id: result.id,
      type: result.type,
      status: result.status,
      uploadedAt: result.uploadedAt,
    },
  });
}));

/**
 * GET /user/documents
 * Get user's uploaded documents
 */
router.get('/documents', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const documents = await UserService.getUserDocuments(req.user.id);

  res.json({
    documents: documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      // Don't return actual document content for security
    })),
  });
}));

/**
 * GET /user/notifications
 * Get current user's notifications
 */
router.get('/notifications', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const unreadOnly = req.query.unreadOnly === 'true';

  const { notifications, total } = await notificationService.getUserNotifications(req.user.id, {
    limit,
    offset,
  });

  const filteredNotifications = unreadOnly
    ? notifications.filter((notification) => !notification.acknowledgedAt)
    : notifications;

  res.json({
    notifications: filteredNotifications.map((notification) => ({
      id: notification.id,
      recipientId: notification.recipientId,
      chamaId: notification.chamaId,
      organizationId: notification.organizationId,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      acknowledgedAt: notification.acknowledgedAt,
      createdAt: notification.createdAt,
      channels: notification.channels,
    })),
    total,
  });
}));

/**
 * GET /user/notification-preferences
 * Get user notification preferences
 */
router.get('/notification-preferences', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const preferences = await notificationService.getUserPreferences(req.user.id);
  res.json({ preferences });
}));

/**
 * PUT /user/notification-preferences
 * Update user notification preferences
 */
router.put('/notification-preferences', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const preferences = await notificationService.updateUserPreferences(req.user.id, req.body);
  res.json({ preferences });
}));

/**
 * PATCH /user/notifications/:notificationId/acknowledge
 * Acknowledge a notification
 */
router.patch('/notifications/:notificationId/acknowledge', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { notificationId } = req.params as { notificationId: string };
  const notification = await notificationService.acknowledgeNotification(notificationId);

  res.json({ notification });
}));

/**
 * DELETE /user/account
 * Request account deletion and immediately disable access.
 * Financial and audit records may be retained where legally required.
 */
router.delete('/account', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { currentPassword, reason } = z.object({
    confirmation: z.literal('DELETE'),
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    reason: z.string().trim().max(500, 'Reason too long').optional(),
  }).parse(req.body);

  const account = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true, isActive: true },
  });
  if (!account?.isActive) throw new UnauthorizedError('Account is inactive');
  const deletionAttemptsKey = `account_deletion_attempts:${req.user.id}`;
  const deletionAttempts = Number(await RedisService.get<string>(deletionAttemptsKey) || '0');
  if (deletionAttempts >= 5) {
    throw new AppError('Too many failed deletion confirmations; try again later', 429, 'RATE_LIMITED');
  }
  if (!await AuthService.verifyPassword(currentPassword, account.passwordHash)) {
    const attempts = await RedisService.incr(deletionAttemptsKey);
    if (attempts === 1) await RedisService.expire(deletionAttemptsKey, 15 * 60);
    throw new UnauthorizedError('Current password is incorrect');
  }
  await RedisService.del(deletionAttemptsKey);

  await UserService.deactivateAccount(req.user.id, reason);
  await AuthService.revokeAllSessions(req.user.id);

  // Log account deactivation
  auditLog('UPDATE', req.user.id, undefined, {
    action: 'ACCOUNT_DEACTIVATED',
    reason: reason || undefined,
  });

  logger.info('User account deactivated', {
    userId: req.user.id,
    reasonProvided: Boolean(reason),
  });

  res.json({
    message: 'Account deletion requested. Access has been disabled and active sessions have been revoked.',
    retainedDataNotice: 'Financial, dispute, security, and audit records may be retained where required by law. Other account data will be deleted or anonymized under the published retention policy.',
  });
}));

/**
 * GET /user/kyc-status
 * Get detailed KYC status and requirements
 */
router.get('/kyc-status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const kycStatus = await UserService.getKycStatus(req.user.id);

  res.json({
    kycStatus,
  });
}));

export { router as userRouter };
