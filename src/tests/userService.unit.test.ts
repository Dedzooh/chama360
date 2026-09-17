/**
 * Unit Tests for User Service
 * 
 * Tests user registration, profile management, and KYC operations
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { UserService } from '../services/userService';
import { prisma } from '../config/database';
import { AuthService } from '../services/authService';
import { NotificationService } from '../services/notificationService';
import { DocumentService } from '../services/documentService';
import { IdentityProtectionService } from '../services/identityProtectionService';
import { 
  BadRequestError, 
  ConflictError, 
  NotFoundError 
} from '../middleware/errorHandler';

// Mock dependencies
jest.mock('../config/database', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock('../services/authService');
jest.mock('../services/notificationService');
jest.mock('../services/documentService');
jest.mock('../config/redis', () => ({
  RedisService: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(true),
  },
}));

describe('UserService - User Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'Test@1234',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+254712345678',
      nationalId: '12345678',
      acceptTerms: true,
    };

    const validKycData = {
      firstName: 'John',
      middleName: 'M',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE' as const,
      maritalStatus: 'SINGLE' as const,
      nationality: 'KE' as const,
      email: 'test@example.com',
      phone: '+254712345678',
      alternativePhone: '+254723456789',
      currentAddress: {
        street: '123 Main St',
        city: 'Nairobi',
        state: 'Nairobi',
        postalCode: '00100',
        country: 'KE' as const,
      },
      sameAsCurrent: true,
      nationalId: '12345678',
      employmentStatus: 'EMPLOYED' as const,
      employer: 'Test Company',
      occupation: 'Software Engineer',
      monthlyIncome: '50K_100K' as const,
      sourceOfIncome: 'Salary',
      nextOfKin: {
        firstName: 'Jane',
        lastName: 'Doe',
        relationship: 'Sister',
        phone: '+254734567890',
        email: 'jane@example.com',
      },
      documents: [
        {
          type: 'NATIONAL_ID' as const,
          frontImage: 'base64_image_data',
          backImage: 'base64_image_data',
          documentNumber: '12345678',
          issueDate: new Date('2015-01-01'),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          issuingAuthority: 'Government of Kenya',
        },
      ],
      acceptTerms: true,
      consentDataProcessing: true,
      consentCreditCheck: false,
      marketingConsent: false,
    };

    it('should successfully register a new user with valid data', async () => {
      const mockUser = {
        id: 'user_123',
        email: validRegistrationData.email,
        firstName: validKycData.firstName,
        lastName: validKycData.lastName,
        phone: validKycData.phone,
        nationalId: validKycData.nationalId,
        kycStatus: 'PENDING',
        isActive: true,
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        mfaSecret: null,
        mfaEnabled: false,
      };

      // Mock database operations
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (AuthService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_123' }),
          },
        });
      });
      (DocumentService.storeDocument as jest.Mock).mockResolvedValue({ id: 'doc_123' });
      (NotificationService.sendEmailVerification as jest.Mock).mockResolvedValue(true);
      (NotificationService.sendPhoneVerification as jest.Mock).mockResolvedValue(true);
      (NotificationService.sendWelcomeNotification as jest.Mock).mockResolvedValue(true);

      const result = await UserService.registerUser(
        validRegistrationData,
        validKycData,
        '127.0.0.1',
        'Test User Agent'
      );

      expect(result.user.id).toBe('user_123');
      expect(result.user.email).toBe(validRegistrationData.email);
      expect(result.user.kycStatus).toBe('PENDING');
      expect(result.verificationTokens.emailToken).toBeDefined();
      expect(result.verificationTokens.phoneToken).toBeDefined();
      expect(result.nextSteps).toBeInstanceOf(Array);
      expect(result.nextSteps.length).toBeGreaterThan(0);
    });

    it('should reject registration with duplicate email', async () => {
      const existingUser = {
        id: 'existing_user',
        email: validRegistrationData.email,
        phone: '+254700000000',
        nationalId: '00000000',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow(ConflictError);
      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow('Email already registered');
    });

    it('should reject registration with duplicate phone number', async () => {
      const existingUser = {
        id: 'existing_user',
        email: 'other@example.com',
        phone: validKycData.phone,
        nationalId: '00000000',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow(ConflictError);
      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow('Phone number already registered');
    });

    it('should reject registration with duplicate national ID', async () => {
      const existingUser = {
        id: 'existing_user',
        email: 'other@example.com',
        phone: '+254700000000',
        nationalId: null,
        nationalIdHash: IdentityProtectionService.fingerprint(validKycData.nationalId),
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow(ConflictError);
      await expect(
        UserService.registerUser(validRegistrationData, validKycData)
      ).rejects.toThrow('National ID already registered');
    });

    it('should reject registration with invalid country-specific data', async () => {
      const invalidKycData = {
        ...validKycData,
        nationalId: 'INVALID',
        phone: '+254999999999', // Invalid format
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.registerUser(validRegistrationData, invalidKycData)
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject registration with missing required documents', async () => {
      const invalidKycData = {
        ...validKycData,
        documents: [], // No documents provided
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.registerUser(validRegistrationData, invalidKycData)
      ).rejects.toThrow('At least one identity document is required');
    });

    it('should assess risk level correctly for different user profiles', async () => {
      // High risk profile
      const highRiskKyc = {
        ...validKycData,
        dateOfBirth: new Date('2005-01-01'), // Young user
        employmentStatus: 'UNEMPLOYED' as const,
        monthlyIncome: 'BELOW_10K' as const,
        documents: [{
          type: 'NATIONAL_ID' as const,
          frontImage: 'base64_image_data',
          backImage: 'base64_image_data',
          documentNumber: '12345678',
          issueDate: new Date('2015-01-01'),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          issuingAuthority: 'Government of Kenya',
        }], // Only one document
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (AuthService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user_123',
              email: validRegistrationData.email,
              kycStatus: 'PENDING',
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_123' }),
          },
        });
      });
      (DocumentService.storeDocument as jest.Mock).mockResolvedValue({ id: 'doc_123' });
      (NotificationService.sendEmailVerification as jest.Mock).mockResolvedValue(true);
      (NotificationService.sendPhoneVerification as jest.Mock).mockResolvedValue(true);
      (NotificationService.sendWelcomeNotification as jest.Mock).mockResolvedValue(true);

      const result = await UserService.registerUser(
        validRegistrationData,
        highRiskKyc
      );

      expect(result.nextSteps).toContain('Additional document verification required');
      expect(result.nextSteps).toContain('Manual review by compliance team');
    });
  });

  describe('updateProfile', () => {
    const userId = 'user_123';
    const currentUser = {
      id: userId,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+254712345678',
      nationalId: '12345678',
      kycStatus: 'VERIFIED',
      isActive: true,
      passwordHash: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date(),
      mfaSecret: null,
      mfaEnabled: false,
      auditLogs: [
        {
          id: 'audit_123',
          action: 'CREATE',
          entityType: 'KYC_DATA',
          entityId: userId,
          userId,
          newValues: {
            nationality: 'KE',
          },
          createdAt: new Date(),
        },
      ],
    };

    it('should successfully update user profile', async () => {
      const profileUpdate = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(currentUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            update: jest.fn().mockResolvedValue({
              ...currentUser,
              ...profileUpdate,
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_456' }),
          },
        });
      });
      (NotificationService.sendProfileUpdateNotification as jest.Mock).mockResolvedValue(true);

      const result = await UserService.updateProfile(userId, profileUpdate);

      expect(result.user.firstName).toBe('Jane');
      expect(result.user.lastName).toBe('Smith');
      expect(result.changedFields).toContain('firstName');
      expect(result.changedFields).toContain('lastName');
      expect(result.requiresReVerification).toBe(false);
    });

    it('should require re-verification when phone is updated', async () => {
      const profileUpdate = {
        phone: '+254723456789',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(currentUser);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            update: jest.fn().mockResolvedValue({
              ...currentUser,
              ...profileUpdate,
              kycStatus: 'PENDING',
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit_456' }),
          },
        });
      });
      (NotificationService.sendPhoneVerification as jest.Mock).mockResolvedValue(true);
      (NotificationService.sendProfileUpdateNotification as jest.Mock).mockResolvedValue(true);

      const result = await UserService.updateProfile(userId, profileUpdate);

      expect(result.changedFields).toContain('phone');
      expect(result.requiresReVerification).toBe(true);
      expect(NotificationService.sendPhoneVerification).toHaveBeenCalled();
    });

    it('should reject update for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.updateProfile(userId, { firstName: 'Jane' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyEmail', () => {
    const userId = 'user_123';
    const validToken = 'valid_token_123';

    it('should successfully verify email with valid token', async () => {
      const { RedisService } = require('../config/redis');
      RedisService.get.mockResolvedValue(validToken);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        updatedAt: new Date(),
      });

      const result = await UserService.verifyEmail(userId, validToken);

      expect(result).toBe(true);
      expect(RedisService.del).toHaveBeenCalledWith(`email_verification:${userId}`);
    });

    it('should reject verification with invalid token', async () => {
      const { RedisService } = require('../config/redis');
      RedisService.get.mockResolvedValue('different_token');

      await expect(
        UserService.verifyEmail(userId, validToken)
      ).rejects.toThrow(BadRequestError);
      await expect(
        UserService.verifyEmail(userId, validToken)
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should reject verification with expired token', async () => {
      const { RedisService } = require('../config/redis');
      RedisService.get.mockResolvedValue(null);

      await expect(
        UserService.verifyEmail(userId, validToken)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('verifyPhone', () => {
    const userId = 'user_123';
    const validCode = '123456';

    it('should successfully verify phone with valid code', async () => {
      const { RedisService } = require('../config/redis');
      RedisService.get.mockResolvedValue(validCode);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        kycStatus: 'PENDING',
        auditLogs: [
          {
            newValues: {
              documents: [{ type: 'NATIONAL_ID' }, { type: 'PASSPORT' }],
              riskLevel: 'LOW',
            },
          },
        ],
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        kycStatus: 'VERIFIED',
      });
      (NotificationService.sendKycApprovalNotification as jest.Mock).mockResolvedValue(true);

      const result = await UserService.verifyPhone(userId, validCode);

      expect(result).toBe(true);
      expect(RedisService.del).toHaveBeenCalledWith(`phone_verification:${userId}`);
    });

    it('should reject verification with invalid code', async () => {
      const { RedisService } = require('../config/redis');
      RedisService.get.mockResolvedValue('654321');

      await expect(
        UserService.verifyPhone(userId, validCode)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getUserProfile', () => {
    const userId = 'user_123';

    it('should return complete user profile with KYC data', async () => {
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+254712345678',
        nationalId: '12345678',
        kycStatus: 'VERIFIED',
        isActive: true,
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        mfaSecret: null,
        mfaEnabled: false,
        auditLogs: [
          {
            newValues: {
              firstName: 'John',
              lastName: 'Doe',
              nationality: 'KE',
            },
          },
        ],
        chamaMemberships: [
          {
            chamaId: 'chama_123',
            userId,
            role: 'MEMBER',
            status: 'ACTIVE',
            chama: {
              id: 'chama_123',
              name: 'Test Chama',
              type: 'ROSCA',
              status: 'ACTIVE',
            },
          },
        ],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserProfile(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('test@example.com');
      expect(result.kycData).toBeDefined();
      expect(result.verificationStatus).toBeDefined();
      expect(result.memberships).toHaveLength(1);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.getUserProfile(userId)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
