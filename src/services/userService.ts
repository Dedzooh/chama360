// @ts-nocheck
/**
 * User Service - Handles user registration, profile management, and KYC operations
 * 
 * This service provides comprehensive user management functionality including
 * registration with KYC validation, profile updates, and verification processes.
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { prisma } from '../config/database';
import { AuthService } from './authService';
import { NotificationService } from './notificationService';
import { DocumentService } from './documentService';
import { IdentityProtectionService } from './identityProtectionService';
import { logger, auditLog } from '../config/logger';
import { 
  BadRequestError, 
  ConflictError, 
  NotFoundError
} from '../middleware/errorHandler';
import {
  kycDataSchema,
  kycUpdateSchema,
  validateCountrySpecificData,
  validateDocumentRequirements,
  assessKycRisk,
  type KycData,
  type KycUpdate,
} from '../schemas/kyc';
import {
  userRegistrationSchema,
  profileUpdateSchema,
  type UserRegistration,
  type ProfileUpdate,
} from '../schemas/auth';
import { User, Prisma } from '@prisma/client';
import { randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { config } from '../config/environment';

// Extended user interface with KYC data
export interface UserWithKyc extends User {
  kycData?: any;
  verificationStatus?: {
    emailVerified: boolean;
    phoneVerified: boolean;
    documentsVerified: boolean;
  };
  memberships?: any[];
}

// Registration result interface
export interface RegistrationResult {
  user: UserWithKyc;
  verificationTokens: {
    emailToken?: string;
    phoneToken?: string;
  };
  nextSteps: string[];
}

// Profile update result interface
export interface ProfileUpdateResult {
  user: UserWithKyc;
  changedFields: string[];
  requiresReVerification: boolean;
}

const sanitizeKycForAudit = (kycData: Record<string, any>) => {
  const { nationalId, ...safeKycData } = kycData;
  return {
    ...safeKycData,
    ...(typeof nationalId === 'string' ? { nationalIdLast4: nationalId.slice(-4) } : {}),
    documents: Array.isArray(kycData.documents)
      ? kycData.documents.map(({ frontImage, backImage, documentNumber, ...document }: Record<string, any>) => ({
          ...document,
          ...(typeof documentNumber === 'string' ? { documentNumberLast4: documentNumber.slice(-4) } : {}),
          frontImageProvided: Boolean(frontImage),
          backImageProvided: Boolean(backImage),
          imagesExcludedFromAudit: true,
        }))
      : undefined,
  };
};

export class UserService {
  /**
   * Register a new user with comprehensive KYC data collection
   */
  static async registerUser(
    registrationData: UserRegistration,
    kycData: KycData,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RegistrationResult> {
    // Validate registration data
    const validatedRegistration = userRegistrationSchema.parse(registrationData);
    const validatedKyc = kycDataSchema.parse(kycData);
    const protectedIdentity = IdentityProtectionService.protect(validatedKyc.nationalId);

    // Check for existing users
    await this.checkExistingUser(validatedRegistration, validatedKyc);

    // Validate country-specific data
    const countryValidation = validateCountrySpecificData({
      nationalId: validatedKyc.nationalId,
      phone: validatedKyc.phone,
      country: validatedKyc.nationality,
    });

    if (!countryValidation.isValid) {
      throw new BadRequestError(`Validation errors: ${countryValidation.errors.join(', ')}`);
    }

    // Validate document requirements
    const docValidation = validateDocumentRequirements(
      validatedKyc.documents,
      validatedKyc.nationality
    );

    if (!docValidation.isValid) {
      throw new BadRequestError(`Missing required documents: ${docValidation.missingDocuments.join(', ')}`);
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(validatedRegistration.password);

    // Assess KYC risk level
    const riskLevel = assessKycRisk(validatedKyc);

    // Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedRegistration.email,
          passwordHash,
          firstName: validatedKyc.firstName,
          lastName: validatedKyc.lastName,
          phone: validatedKyc.phone,
          ...protectedIdentity,
          kycStatus: 'PENDING',
          isActive: true,
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
          legalVersion: '2026-07-14',
        },
      });

      // Store KYC data (in a real implementation, this would be in a separate KYC table)
      const kycRecord = await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'KYC_DATA',
          entityId: user.id,
          userId: user.id,
          newValues: {
            ...sanitizeKycForAudit(validatedKyc),
            riskLevel,
            submittedAt: new Date(),
          },
          metadata: {
            registrationSource: 'WEB',
            countryValidation: countryValidation,
            documentValidation: docValidation,
          },
          ipAddress,
          userAgent,
        },
      });

      return { user, kycRecord };
    });

    try {
      for (const doc of validatedKyc.documents) {
        await DocumentService.storeDocument({
          userId: result.user.id,
          type: doc.type,
          frontImage: doc.frontImage,
          backImage: doc.backImage,
          documentNumber: doc.documentNumber,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          issuingAuthority: doc.issuingAuthority,
        });
      }
    } catch (error) {
      await DocumentService.deleteUserDocuments(result.user.id).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { userId: result.user.id } });
      await prisma.user.delete({ where: { id: result.user.id } });
      throw error;
    }

    // Generate verification tokens
    const emailToken = this.generateVerificationToken();
    const phoneToken = this.generateVerificationCode();

    // Store verification tokens in Redis
    await this.storeVerificationTokens(result.user.id, emailToken, phoneToken);

    // Send verification notifications
    const notificationPromises = [];

    // Email verification
    notificationPromises.push(
      NotificationService.sendEmailVerification(
        result.user.email,
        result.user.firstName,
        emailToken
      )
    );

    // SMS verification
    notificationPromises.push(
      NotificationService.sendPhoneVerification(
        validatedKyc.phone,
        phoneToken
      )
    );

    // Send welcome notification
    notificationPromises.push(
      NotificationService.sendWelcomeNotification(result.user.id)
    );

    await Promise.allSettled(notificationPromises);

    // Determine next steps based on risk level
    const nextSteps = this.determineNextSteps(riskLevel, validatedKyc);

    // Log registration
    auditLog('CREATE', result.user.id, undefined, {
      action: 'USER_REGISTRATION',
      email: result.user.email,
      kycRiskLevel: riskLevel,
      documentsSubmitted: validatedKyc.documents.length,
      ipAddress,
      userAgent,
    });

    logger.info('User registered with KYC data', {
      userId: result.user.id,
      email: result.user.email,
      riskLevel,
      documentsCount: validatedKyc.documents.length,
    });

    return {
      user: {
        ...result.user,
        kycData: validatedKyc,
        verificationStatus: {
          emailVerified: false,
          phoneVerified: false,
          documentsVerified: false,
        },
      },
      verificationTokens: {
        emailToken,
        phoneToken,
      },
      nextSteps,
    };
  }

  /**
   * Update user profile with KYC validation
   */
  static async updateProfile(
    userId: string,
    profileData: ProfileUpdate,
    kycData?: KycUpdate,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ProfileUpdateResult> {
    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
            action: 'CREATE',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!currentUser) {
      throw new NotFoundError('User');
    }

    // Validate update data
    const validatedProfile = profileUpdateSchema.parse(profileData);
    const validatedKyc = kycData ? kycUpdateSchema.parse(kycData) : undefined;

    // Track changed fields
    const changedFields: string[] = [];
    let requiresReVerification = false;

    // Check what fields are being changed
    if (validatedProfile.firstName && validatedProfile.firstName !== currentUser.firstName) {
      changedFields.push('firstName');
    }
    if (validatedProfile.lastName && validatedProfile.lastName !== currentUser.lastName) {
      changedFields.push('lastName');
    }
    if (validatedProfile.phone && validatedProfile.phone !== currentUser.phone) {
      changedFields.push('phone');
      requiresReVerification = true; // Phone changes require re-verification
    }

    // Validate country-specific data if phone is being updated
    if (validatedProfile.phone && validatedKyc) {
      const currentKycData = currentUser.auditLogs[0]?.newValues as any;
      const countryValidation = validateCountrySpecificData({
        nationalId: validatedKyc.nationalId || currentUser.nationalId || '',
        phone: validatedProfile.phone,
        country: currentKycData?.nationality || 'KE',
      });

      if (!countryValidation.isValid) {
        throw new BadRequestError(`Validation errors: ${countryValidation.errors.join(', ')}`);
      }
    }

    // Start database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user profile
      const updateData: Prisma.UserUpdateInput = {};
      
      if (validatedProfile.firstName) updateData.firstName = validatedProfile.firstName;
      if (validatedProfile.lastName) updateData.lastName = validatedProfile.lastName;
      if (validatedProfile.phone) updateData.phone = validatedProfile.phone;

      // If phone is being updated, reset KYC status to pending
      if (validatedProfile.phone && validatedProfile.phone !== currentUser.phone) {
        updateData.kycStatus = 'PENDING';
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Store KYC updates if provided
      let kycUpdateRecord = null;
      if (validatedKyc) {
        kycUpdateRecord = await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'KYC_DATA',
            entityId: userId,
            userId,
            oldValues: sanitizeKycForAudit((currentUser.auditLogs[0]?.newValues as Record<string, any>) || {}),
            newValues: {
              ...sanitizeKycForAudit(validatedKyc),
              updatedAt: new Date(),
            },
            metadata: {
              changedFields,
              requiresReVerification,
              updateSource: 'PROFILE_UPDATE',
            },
            ipAddress,
            userAgent,
          },
        });

        changedFields.push('kycData');
      }

      return { updatedUser, kycUpdateRecord };
    });

    // Handle re-verification if required
    if (requiresReVerification) {
      if (validatedProfile.phone) {
        const phoneToken = this.generateVerificationCode();
        await this.storePhoneVerificationToken(userId, phoneToken);
        
        // Send phone verification
        await NotificationService.sendPhoneVerification(
          validatedProfile.phone,
          phoneToken
        );
      }
    }

    // Send profile update notification
    await NotificationService.sendProfileUpdateNotification(
      userId,
      changedFields,
      requiresReVerification
    );

    // Log profile update
    auditLog('UPDATE', userId, undefined, {
      action: 'PROFILE_UPDATE',
      changedFields,
      requiresReVerification,
      ipAddress,
      userAgent,
    });

    logger.info('User profile updated', {
      userId,
      changedFields,
      requiresReVerification,
    });

    return {
      user: {
        ...result.updatedUser,
        kycData: validatedKyc,
        verificationStatus: {
          emailVerified: true, // Assume email is already verified
          phoneVerified: !requiresReVerification,
          documentsVerified: currentUser.kycStatus === 'VERIFIED',
        },
      },
      changedFields,
      requiresReVerification,
    };
  }

  /**
   * Verify email address
   */
  static async verifyEmail(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.getVerificationToken(userId, 'email');
    if (!storedToken || !this.matchesVerificationCode(storedToken, token)) {
      await this.recordVerificationFailure(userId, 'email');
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Update user verification status
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
      },
    });

    // Remove verification token
    await this.removeVerificationToken(userId, 'email');
    await this.clearVerificationFailures(userId, 'email');

    // Log verification
    auditLog('UPDATE', userId, undefined, {
      action: 'EMAIL_VERIFIED',
    });

    logger.info('Email verified', { userId });

    return true;
  }

  /**
   * Verify phone number
   */
  static async verifyPhone(userId: string, code: string): Promise<boolean> {
    const storedCode = await this.getVerificationToken(userId, 'phone');
    if (!storedCode || !this.matchesVerificationCode(storedCode, code)) {
      await this.recordVerificationFailure(userId, 'phone');
      throw new BadRequestError('Invalid or expired verification code');
    }

    // Update user verification status
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerifiedAt: new Date(),
      },
    });

    // Remove verification token
    await this.removeVerificationToken(userId, 'phone');
    await this.clearVerificationFailures(userId, 'phone');

    // Check if user can be auto-verified
    await this.checkAutoVerification(userId);

    // Log verification
    auditLog('UPDATE', userId, undefined, {
      action: 'PHONE_VERIFIED',
    });

    logger.info('Phone verified', { userId });

    return true;
  }

  /**
   * Get user profile with KYC data
   */
  static async getUserProfile(userId: string): Promise<UserWithKyc> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        chamaMemberships: {
          where: { status: 'ACTIVE' },
          include: {
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

    const kycData = user.auditLogs[0]?.newValues as any;
    const { chamaMemberships, ...profile } = user;

    return {
      ...profile,
      kycData,
      memberships: chamaMemberships,
      verificationStatus: {
        emailVerified: Boolean(user.emailVerifiedAt),
        phoneVerified: Boolean(user.phoneVerifiedAt),
        documentsVerified: user.kycStatus === 'VERIFIED',
      },
    };
  }

  /**
   * Check for existing user conflicts
   */
  private static async checkExistingUser(
    registrationData: UserRegistration,
    kycData: KycData
  ): Promise<void> {
    const nationalIdHash = IdentityProtectionService.fingerprint(kycData.nationalId);
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: registrationData.email },
          { phone: kycData.phone },
          { nationalIdHash },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === registrationData.email) {
        throw new ConflictError('Email already registered');
      }
      if (existingUser.phone === kycData.phone) {
        throw new ConflictError('Phone number already registered');
      }
      if (existingUser.nationalIdHash === nationalIdHash) {
        throw new ConflictError('National ID already registered');
      }
    }
  }

  /**
   * Generate verification token
   */
  private static generateVerificationToken(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Generate verification code
   */
  private static generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private static matchesVerificationCode(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private static async recordVerificationFailure(userId: string, type: 'email' | 'phone'): Promise<void> {
    const { RedisService } = await import('../config/redis');
    const key = `verification_failures:${type}:${userId}`;
    const attempts = await RedisService.incr(key);
    if (attempts === 1) await RedisService.expire(key, 15 * 60);
    if (attempts >= 5) {
      await RedisService.del(`${type}_verification:${userId}`);
      throw new BadRequestError('Too many failed verification attempts. Request a new code.');
    }
  }

  private static async clearVerificationFailures(userId: string, type: 'email' | 'phone'): Promise<void> {
    const { RedisService } = await import('../config/redis');
    await RedisService.del(`verification_failures:${type}:${userId}`);
  }

  /**
   * Store verification tokens in Redis
   */
  private static async storeVerificationTokens(
    userId: string,
    emailToken: string,
    phoneToken: string
  ): Promise<void> {
    const { RedisService } = await import('../config/redis');
    
    // Store tokens with 24-hour expiration
    await Promise.all([
      RedisService.set(`email_verification:${userId}`, emailToken, 24 * 60 * 60),
      RedisService.set(`phone_verification:${userId}`, phoneToken, 24 * 60 * 60),
    ]);
  }

  /**
   * Store phone verification token
   */
  private static async storePhoneVerificationToken(
    userId: string,
    phoneToken: string
  ): Promise<void> {
    const { RedisService } = await import('../config/redis');
    await RedisService.set(`phone_verification:${userId}`, phoneToken, 24 * 60 * 60);
  }

  /**
   * Get verification token
   */
  private static async getVerificationToken(
    userId: string,
    type: 'email' | 'phone'
  ): Promise<string | null> {
    const { RedisService } = await import('../config/redis');
    return RedisService.get(`${type}_verification:${userId}`);
  }

  /**
   * Remove verification token
   */
  private static async removeVerificationToken(
    userId: string,
    type: 'email' | 'phone'
  ): Promise<void> {
    const { RedisService } = await import('../config/redis');
    await RedisService.del(`${type}_verification:${userId}`);
  }

  /**
   * Determine next steps based on risk level
   */
  private static determineNextSteps(riskLevel: string, kycData: KycData): string[] {
    const steps = [
      'Verify your email address',
      'Verify your phone number',
    ];

    if (riskLevel === 'HIGH') {
      steps.push('Additional document verification required');
      steps.push('Manual review by compliance team');
    } else if (riskLevel === 'MEDIUM') {
      steps.push('Document verification in progress');
    }

    if (kycData.documents.length < 2) {
      steps.push('Upload additional identity documents');
    }

    return steps;
  }

  /**
   * Check if user can be auto-verified
   */
  private static async checkAutoVerification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
            action: 'CREATE',
          },
          take: 1,
        },
      },
    });

    if (!user || user.kycStatus !== 'PENDING') {
      return;
    }

    const kycData = user.auditLogs[0]?.newValues as any;
    if (!kycData) {
      return;
    }

    // Auto-verify low-risk users with complete documentation
    const riskLevel = assessKycRisk(kycData);
    if (riskLevel === 'LOW' && kycData.documents?.length >= 2) {
      await prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'VERIFIED' },
      });

      // Send verification success notification
      await NotificationService.sendKycApprovalNotification(userId);

      logger.info('User auto-verified', { userId, riskLevel });
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<UserWithKyc | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return null;
    }

    const kycData = user.auditLogs[0]?.newValues as any;

    return {
      ...user,
      kycData,
      verificationStatus: {
        emailVerified: true, // In a full implementation, check actual status
        phoneVerified: true, // In a full implementation, check actual status
        documentsVerified: user.kycStatus === 'VERIFIED',
      },
    };
  }

  /**
   * Get user by phone
   */
  static async getUserByPhone(phone: string): Promise<UserWithKyc | null> {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return null;
    }

    const kycData = user.auditLogs[0]?.newValues as any;

    return {
      ...user,
      kycData,
      verificationStatus: {
        emailVerified: true, // In a full implementation, check actual status
        phoneVerified: true, // In a full implementation, check actual status
        documentsVerified: user.kycStatus === 'VERIFIED',
      },
    };
  }

  /**
   * Resend verification code
   */
  static async resendVerification(userId: string, type: 'email' | 'phone'): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    if ((type === 'email' && user.emailVerifiedAt) || (type === 'phone' && user.phoneVerifiedAt)) return true;
    const { RedisService } = await import('../config/redis');
    const cooldownKey = `verification_resend:${type}:${userId}`;
    if (await RedisService.exists(cooldownKey)) throw new BadRequestError('Please wait 60 seconds before requesting another code.');
    await RedisService.set(cooldownKey, '1', 60);

    if (type === 'email') {
      const emailToken = this.generateVerificationToken();
      await RedisService.set(`email_verification:${userId}`, emailToken, 24 * 60 * 60);
      await this.clearVerificationFailures(userId, 'email');
      
      await NotificationService.sendEmailVerification(
        user.email,
        user.firstName,
        emailToken
      );
    } else {
      const phoneToken = this.generateVerificationCode();
      await this.storePhoneVerificationToken(userId, phoneToken);
      await this.clearVerificationFailures(userId, 'phone');
      
      await NotificationService.sendPhoneVerification(
        user.phone,
        phoneToken
      );
    }

    return true;
  }

  /**
   * Get verification status
   */
  static async getVerificationStatus(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      documentsVerified: user.kycStatus === 'VERIFIED',
      kycStatus: user.kycStatus,
    };
  }

  /**
   * Upload document
   */
  static async uploadDocument(userId: string, documentData: any): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Store document using DocumentService
    const document = await DocumentService.storeDocument({
      userId,
      type: documentData.type,
      frontImage: documentData.frontImage,
      backImage: documentData.backImage,
      documentNumber: documentData.documentNumber,
      issueDate: documentData.issueDate,
      expiryDate: documentData.expiryDate,
      issuingAuthority: documentData.issuingAuthority,
    });

    return {
      id: document.id,
      type: documentData.type,
      status: document.status,
      uploadedAt: document.createdAt,
    };
  }

  /**
   * Get user documents
   */
  static async getUserDocuments(userId: string): Promise<any[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const documents = await DocumentService.listDocuments(userId);
    return documents.map(document => ({
      id: document.id,
      type: document.type,
      status: document.status,
      uploadedAt: document.createdAt,
    }));
  }

  /**
   * Deactivate user account
   */
  static async deactivateAccount(userId: string, reason?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const requestedAt = new Date();
    const graceDays = config.security.accountDeletionGraceDays;
    const scheduledFor = graceDays === undefined
      ? null
      : new Date(requestedAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletionRequestedAt: requestedAt,
        deletionScheduledFor: scheduledFor,
        deletionReason: reason || null,
      },
    });

    // Log deactivation reason
    auditLog('UPDATE', userId, undefined, {
      action: 'ACCOUNT_DEACTIVATED',
      reason: reason || undefined,
      deletionScheduledFor: scheduledFor?.toISOString(),
    });
  }

  /**
   * Get KYC status
   */
  static async getKycStatus(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        auditLogs: {
          where: {
            entityType: 'KYC_DATA',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const kycData = user.auditLogs[0]?.newValues as any;

    return {
      status: user.kycStatus,
      riskLevel: kycData?.riskLevel || 'MEDIUM',
      documentsSubmitted: kycData?.documents?.length || 0,
      requiredDocuments: ['NATIONAL_ID'],
      completionPercentage: user.kycStatus === 'VERIFIED' ? 100 : 75,
      nextSteps: user.kycStatus === 'PENDING' ? 
        ['Complete document verification', 'Wait for manual review'] : 
        [],
    };
  }
}
