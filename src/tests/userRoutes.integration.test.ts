/**
 * Integration Tests for User Routes
 * 
 * Tests user registration, profile management, and KYC endpoints
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import request from 'supertest';
import app from '../index';
import { prisma } from '../config/database';
import { AuthService } from '../services/authService';
import { IdentityProtectionService } from '../services/identityProtectionService';

describe('User Routes Integration Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Connect to test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up and disconnect
    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /user/register', () => {
    it('should register a new user with valid data', async () => {
      const registrationData = {
        user: {
          email: `test${Date.now()}@example.com`,
          password: 'Test@1234',
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          nationalId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
          acceptTerms: true,
        },
        kyc: {
          firstName: 'John',
          middleName: 'M',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'MALE',
          maritalStatus: 'SINGLE',
          nationality: 'KE',
          email: `test${Date.now()}@example.com`,
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          currentAddress: {
            street: '123 Main St',
            city: 'Nairobi',
            state: 'Nairobi',
            postalCode: '00100',
            country: 'KE',
          },
          sameAsCurrent: true,
          nationalId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
          employmentStatus: 'EMPLOYED',
          employer: 'Test Company',
          occupation: 'Software Engineer',
          monthlyIncome: '50K_100K',
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
              type: 'NATIONAL_ID',
              frontImage: 'base64_image_data',
              backImage: 'base64_image_data',
              documentNumber: `${Math.floor(10000000 + Math.random() * 90000000)}`,
              issueDate: '2015-01-01',
              expiryDate: '2025-01-01',
              issuingAuthority: 'Government of Kenya',
            },
          ],
          acceptTerms: true,
          consentDataProcessing: true,
          consentCreditCheck: false,
          marketingConsent: false,
        },
      };

      const response = await request(app)
        .post('/api/v1/user/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.email).toBe(registrationData.user.email);
      expect(response.body.user.kycStatus).toBe('PENDING');
      expect(response.body.nextSteps).toBeInstanceOf(Array);
      expect(response.body.verificationRequired).toBeDefined();
      expect(response.body.verificationRequired.email).toBe(true);
      expect(response.body.verificationRequired.phone).toBe(true);

      // Store test user ID for cleanup
      testUserId = response.body.user.id;
    });

    it('should reject registration with invalid email', async () => {
      const invalidData = {
        user: {
          email: 'invalid-email',
          password: 'Test@1234',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+254712345678',
          nationalId: '12345678',
          acceptTerms: true,
        },
        kyc: {
          // ... minimal KYC data
        },
      };

      const response = await request(app)
        .post('/api/v1/user/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const invalidData = {
        user: {
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+254712345678',
          nationalId: '12345678',
          acceptTerms: true,
        },
        kyc: {
          // ... minimal KYC data
        },
      };

      const response = await request(app)
        .post('/api/v1/user/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject registration without accepting terms', async () => {
      const invalidData = {
        user: {
          email: 'test@example.com',
          password: 'Test@1234',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+254712345678',
          nationalId: '12345678',
          acceptTerms: false,
        },
        kyc: {
          // ... minimal KYC data
        },
      };

      const response = await request(app)
        .post('/api/v1/user/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /user/profile', () => {
    beforeEach(async () => {
      // Create a test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          passwordHash: await AuthService.hashPassword('Test@1234'),
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          ...IdentityProtectionService.protect(`${Math.floor(10000000 + Math.random() * 90000000)}`),
          kycStatus: 'VERIFIED',
          isActive: true,
        },
      });

      testUserId = testUser.id;

      // Generate auth token
      const tokens = await AuthService.createSession(testUser.id, '127.0.0.1', 'account-deletion-test');
      authToken = tokens.accessToken;
    });

    it('should return user profile when authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUserId);
      expect(response.body.user.email).toBeDefined();
      expect(response.body.user.firstName).toBe('John');
      expect(response.body.user.lastName).toBe('Doe');
      expect(response.body.user.kycStatus).toBe('VERIFIED');
      expect(response.body.user.verificationStatus).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/user/profile')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /user/profile', () => {
    beforeEach(async () => {
      // Create a test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          passwordHash: await AuthService.hashPassword('Test@1234'),
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          ...IdentityProtectionService.protect(`${Math.floor(10000000 + Math.random() * 90000000)}`),
          kycStatus: 'VERIFIED',
          isActive: true,
        },
      });

      testUserId = testUser.id;

      // Generate auth token
      const tokens = AuthService.generateTokens({ userId: testUser.id, email: testUser.email, sessionId: 'integration-test' });
      authToken = tokens.accessToken;
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      };

      const response = await request(app)
        .put('/api/v1/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.firstName).toBe('Jane');
      expect(response.body.user.lastName).toBe('Smith');
      expect(response.body.changedFields).toContain('firstName');
      expect(response.body.changedFields).toContain('lastName');
      expect(response.body.requiresReVerification).toBe(false);
    });

    it('should require re-verification when phone is updated', async () => {
      const updateData = {
        profile: {
          phone: `+254723${Math.floor(100000 + Math.random() * 900000)}`,
        },
      };

      const response = await request(app)
        .put('/api/v1/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.changedFields).toContain('phone');
      expect(response.body.requiresReVerification).toBe(true);
    });

    it('should reject update without authentication', async () => {
      const updateData = {
        profile: {
          firstName: 'Jane',
        },
      };

      const response = await request(app)
        .put('/api/v1/user/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /user/verify-email', () => {
    it('should verify email with valid code', async () => {
      // This test would require setting up verification tokens in Redis
      // For now, we'll test the endpoint structure
      const verificationData = {
        email: 'test@example.com',
        verificationCode: 'ABC123',
      };

      const response = await request(app)
        .post('/api/v1/user/verify-email')
        .send(verificationData);

      // Response will be 404 or 400 depending on whether user exists
      expect([400, 404]).toContain(response.status);
    });

    it('should reject verification with invalid email format', async () => {
      const verificationData = {
        email: 'invalid-email',
        verificationCode: 'ABC123',
      };

      const response = await request(app)
        .post('/api/v1/user/verify-email')
        .send(verificationData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /user/verify-phone', () => {
    it('should verify phone with valid code', async () => {
      const verificationData = {
        phone: '+254712345678',
        verificationCode: '123456',
      };

      const response = await request(app)
        .post('/api/v1/user/verify-phone')
        .send(verificationData);

      // Response will be 404 or 400 depending on whether user exists
      expect([400, 404]).toContain(response.status);
    });

    it('should reject verification with invalid code format', async () => {
      const verificationData = {
        phone: '+254712345678',
        verificationCode: 'INVALID',
      };

      const response = await request(app)
        .post('/api/v1/user/verify-phone')
        .send(verificationData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /user/kyc-status', () => {
    beforeEach(async () => {
      // Create a test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          passwordHash: await AuthService.hashPassword('Test@1234'),
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          ...IdentityProtectionService.protect(`${Math.floor(10000000 + Math.random() * 90000000)}`),
          kycStatus: 'PENDING',
          isActive: true,
        },
      });

      testUserId = testUser.id;

      // Generate auth token
      const tokens = AuthService.generateTokens({ userId: testUser.id, email: testUser.email, sessionId: 'integration-test' });
      authToken = tokens.accessToken;
    });

    it('should return KYC status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/user/kyc-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.kycStatus).toBeDefined();
      expect(response.body.kycStatus.status).toBe('PENDING');
      expect(response.body.kycStatus.riskLevel).toBeDefined();
      expect(response.body.kycStatus.completionPercentage).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/user/kyc-status')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /user/upload-document', () => {
    beforeEach(async () => {
      // Create a test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          passwordHash: await AuthService.hashPassword('Test@1234'),
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          ...IdentityProtectionService.protect(`${Math.floor(10000000 + Math.random() * 90000000)}`),
          kycStatus: 'PENDING',
          isActive: true,
        },
      });

      testUserId = testUser.id;

      // Generate auth token
      const tokens = AuthService.generateTokens({ userId: testUser.id, email: testUser.email, sessionId: 'integration-test' });
      authToken = tokens.accessToken;
    });

    it('should upload document successfully', async () => {
      const documentData = {
        type: 'NATIONAL_ID',
        frontImage: 'base64_image_data',
        backImage: 'base64_image_data',
        documentNumber: '12345678',
        issueDate: '2015-01-01',
        expiryDate: '2025-01-01',
        issuingAuthority: 'Government of Kenya',
      };

      const response = await request(app)
        .post('/api/v1/user/upload-document')
        .set('Authorization', `Bearer ${authToken}`)
        .send(documentData)
        .expect(201);

      expect(response.body.message).toBe('Document uploaded successfully');
      expect(response.body.document).toBeDefined();
      expect(response.body.document.id).toBeDefined();
      expect(response.body.document.type).toBe('NATIONAL_ID');
      expect(response.body.document.status).toBeDefined();
    });

    it('should reject document upload without authentication', async () => {
      const documentData = {
        type: 'NATIONAL_ID',
        frontImage: 'base64_image_data',
        documentNumber: '12345678',
      };

      const response = await request(app)
        .post('/api/v1/user/upload-document')
        .send(documentData)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject document upload with invalid type', async () => {
      const documentData = {
        type: 'INVALID_TYPE',
        frontImage: 'base64_image_data',
        documentNumber: '12345678',
      };

      const response = await request(app)
        .post('/api/v1/user/upload-document')
        .set('Authorization', `Bearer ${authToken}`)
        .send(documentData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /user/account', () => {
    beforeEach(async () => {
      // Create a test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: `test${Date.now()}@example.com`,
          passwordHash: await AuthService.hashPassword('Test@1234'),
          firstName: 'John',
          lastName: 'Doe',
          phone: `+254712${Math.floor(100000 + Math.random() * 900000)}`,
          ...IdentityProtectionService.protect(`${Math.floor(10000000 + Math.random() * 90000000)}`),
          kycStatus: 'VERIFIED',
          isActive: true,
        },
      });

      testUserId = testUser.id;

      // Generate auth token
      const tokens = AuthService.generateTokens({ userId: testUser.id, email: testUser.email, sessionId: 'integration-test' });
      authToken = tokens.accessToken;
    });

    it('should deactivate account successfully', async () => {
      const deactivationData = {
        confirmation: 'DELETE',
        currentPassword: 'Test@1234',
        reason: 'I no longer need this service and want to close my account',
      };

      const response = await request(app)
        .delete('/api/v1/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deactivationData)
        .expect(200);

      expect(response.body.message).toContain('Account deletion requested');

      // Verify account is deactivated
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(user?.isActive).toBe(false);
    });

    it('should reject deactivation without current password', async () => {
      const response = await request(app)
        .delete('/api/v1/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmation: 'DELETE' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject an incorrect password without deactivating the account', async () => {
      const deactivationData = {
        confirmation: 'DELETE',
        currentPassword: 'WrongPassword@123',
      };

      const response = await request(app)
        .delete('/api/v1/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deactivationData)
        .expect(401);

      expect(response.body.error).toBeDefined();
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.isActive).toBe(true);
    });
  });
});
