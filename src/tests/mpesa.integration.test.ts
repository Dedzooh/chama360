import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { prisma } from '../config/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { IdentityProtectionService } from '../services/identityProtectionService';

/**
 * M-Pesa Integration Tests
 * 
 * Tests M-Pesa payment integration endpoints including:
 * - Payment initiation
 * - Callback handling
 * - Payment status queries
 * - Manual reconciliation
 * 
 * Requirements: 8.5, 15.1, 15.2, 15.3, 15.4, 15.5
 */

// Helper function to generate test token
function generateTestToken(userId: string): string {
  return jwt.sign(
    { id: userId, email: 'test@example.com' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

describe('M-Pesa Integration Tests', () => {
  let testUserId: string;
  let testChamaId: string;
  let testContributionId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'mpesa-test@example.com',
        phone: '254712345678',
        ...IdentityProtectionService.protect('MPESA12345'),
        firstName: 'M-Pesa',
        lastName: 'Test',
        passwordHash: 'hashed_password',
        kycStatus: 'VERIFIED',
      },
    });
    testUserId = testUser.id;

    // Create test Chama
    const testChama = await prisma.chama.create({
      data: {
        name: 'M-Pesa Test Chama',
        createdById: testUserId,
        type: 'ROSCA',
        description: 'Test Chama for M-Pesa integration',
        maxMembers: 10,
        contributionAmount: 1000,
        contributionFrequency: 'MONTHLY',
        currency: 'KES',
        visibility: 'PRIVATE',
        shareableLink: 'https://example.com/join/mpesa-test',
        qrCode: 'QR_CODE_DATA',
        status: 'ACTIVE',
        settings: {},
      },
    });
    testChamaId = testChama.id;

    // Create membership
    await prisma.chamaMembership.create({
      data: {
        chamaId: testChamaId,
        userId: testUserId,
        role: 'TREASURER',
        status: 'ACTIVE',
      },
    });

    // Create test contribution
    const testContribution = await prisma.contribution.create({
      data: {
        chamaId: testChamaId,
        memberId: testUserId,
        amount: 1000,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'PENDING',
      },
    });
    testContributionId = testContribution.id;

    // Generate auth token
    authToken = generateTestToken(testUserId);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.contribution.deleteMany({ where: { chamaId: testChamaId } });
    await prisma.chamaMembership.deleteMany({ where: { chamaId: testChamaId } });
    await prisma.chama.delete({ where: { id: testChamaId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('POST /api/v1/mpesa/initiate', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/mpesa/initiate')
        .send({
          contributionId: testContributionId,
          phoneNumber: '0712345678',
          accountReference: 'TEST-123',
          transactionDesc: 'Test Payment',
        });

      expect(response.status).toBe(401);
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/api/v1/mpesa/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contributionId: 'invalid-id',
          phoneNumber: 'invalid-phone',
          accountReference: '',
          transactionDesc: '',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-existent contribution', async () => {
      const response = await request(app)
        .post('/api/v1/mpesa/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contributionId: 'clxxxxxxxxxxxxxxxxxxxxxxx',
          phoneNumber: '0712345678',
          accountReference: 'TEST-123',
          transactionDesc: 'Test Payment',
        });

      expect(response.status).toBe(404);
    });

    // Note: Actual M-Pesa API call would fail in test environment
    // In production, this would initiate a real STK Push
  });

  describe('POST /api/v1/mpesa/callback', () => {
    it('should accept M-Pesa callback without authentication', async () => {
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-merchant-123',
            CheckoutRequestID: 'test-checkout-456',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'QGH1234567' },
                { Name: 'TransactionDate', Value: '20231215120000' },
                { Name: 'PhoneNumber', Value: '254712345678' },
              ],
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/mpesa/callback')
        .send(callbackData);

      expect(response.status).toBe(200);
      expect(response.body.ResultCode).toBe(0);
      expect(response.body.ResultDesc).toBe('Accepted');
    });

    it('should validate callback data structure', async () => {
      const invalidCallback = {
        Body: {
          stkCallback: {
            // Missing required fields
            MerchantRequestID: 'test-merchant-123',
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/mpesa/callback')
        .send(invalidCallback);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/mpesa/status/:checkoutRequestId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/mpesa/status/test-checkout-123');

      expect(response.status).toBe(401);
    });

    it('should return NOT_FOUND for non-existent payment', async () => {
      const response = await request(app)
        .get('/api/v1/mpesa/status/non-existent-checkout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/mpesa/reconcile/manual', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/mpesa/reconcile/manual')
        .send({
          mpesaReceiptNumber: 'QGH1234567',
          contributionId: testContributionId,
          amount: 1000,
          phoneNumber: '0712345678',
          transactionDate: new Date().toISOString(),
        });

      expect(response.status).toBe(401);
    });

    it('should require treasurer role or higher', async () => {
      // Create a regular member
      const regularUser = await prisma.user.create({
        data: {
          email: 'regular-member@example.com',
          phone: '254723456789',
          ...IdentityProtectionService.protect('REGULAR123'),
          firstName: 'Regular',
          lastName: 'Member',
          passwordHash: 'hashed_password',
          kycStatus: 'VERIFIED',
        },
      });

      await prisma.chamaMembership.create({
        data: {
          chamaId: testChamaId,
          userId: regularUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      const memberToken = generateTestToken(regularUser.id);

      const response = await request(app)
        .post('/api/v1/mpesa/reconcile/manual')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          mpesaReceiptNumber: 'QGH1234567',
          contributionId: testContributionId,
          amount: 1000,
          phoneNumber: '0712345678',
          transactionDate: new Date().toISOString(),
        });

      expect(response.status).toBe(403);

      // Clean up
      await prisma.chamaMembership.deleteMany({ where: { userId: regularUser.id } });
      await prisma.user.delete({ where: { id: regularUser.id } });
    });

    it('should validate M-Pesa receipt number format', async () => {
      const response = await request(app)
        .post('/api/v1/mpesa/reconcile/manual')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mpesaReceiptNumber: 'invalid',
          contributionId: testContributionId,
          amount: 1000,
          phoneNumber: '0712345678',
          transactionDate: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/mpesa/history', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/mpesa/history');

      expect(response.status).toBe(401);
    });

    it('should return empty list when no payments exist', async () => {
      const response = await request(app)
        .get('/api/v1/mpesa/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ chamaId: testChamaId });

      expect(response.status).toBe(200);
      expect(response.body.payments).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/mpesa/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          chamaId: testChamaId,
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('pages');
    });
  });
});
