// @ts-nocheck

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { classifyMpesaResultCode, MpesaService } from '../services/mpesaService';
import { prisma } from '../config/database';
import { ContributionService } from '../services/contributionService';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../config/database', () => ({
  prisma: {
    contribution: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    backgroundJob: {
      create: jest.fn(),
    },
  },
}));
jest.mock('../services/contributionService');
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockAxiosInstance = {
  post: jest.fn(),
} as any;

describe('MpesaService', () => {
  let mpesaService: MpesaService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret';
    process.env.MPESA_SHORTCODE = '174379';
    process.env.MPESA_PASSKEY = 'test_passkey';
    process.env.MPESA_CALLBACK_URL = 'https://example.com/callback';
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockAxiosInstance.post.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Phone Number Normalization', () => {
    it('should normalize phone numbers starting with 0', () => {
      const service = new MpesaService();
      const normalized = (service as any).normalizePhoneNumber('0712345678');
      expect(normalized).toBe('254712345678');
    });

    it('should normalize phone numbers starting with +254', () => {
      const service = new MpesaService();
      const normalized = (service as any).normalizePhoneNumber('+254712345678');
      expect(normalized).toBe('254712345678');
    });

    it('should handle phone numbers already in correct format', () => {
      const service = new MpesaService();
      const normalized = (service as any).normalizePhoneNumber('254712345678');
      expect(normalized).toBe('254712345678');
    });

    it('should handle 9-digit phone numbers', () => {
      const service = new MpesaService();
      const normalized = (service as any).normalizePhoneNumber('712345678');
      expect(normalized).toBe('254712345678');
    });
  });

  describe('Password Generation', () => {
    it('should generate correct M-Pesa password', () => {
      const service = new MpesaService();
      const timestamp = '20231215120000';
      const password = (service as any).generatePassword(timestamp);
      
      // Password should be base64 encoded
      expect(password).toBeTruthy();
      expect(typeof password).toBe('string');
      
      // Decode and verify format
      const decoded = Buffer.from(password, 'base64').toString();
      expect(decoded).toContain('174379');
      expect(decoded).toContain('test_passkey');
      expect(decoded).toContain(timestamp);
    });
  });

  describe('Timestamp Generation', () => {
    it('should generate timestamp in correct format', () => {
      const service = new MpesaService();
      const timestamp = (service as any).generateTimestamp();
      
      // Should be in format YYYYMMDDHHmmss
      expect(timestamp).toMatch(/^\d{14}$/);
      expect(timestamp.length).toBe(14);
    });
  });

  describe('Payment Initiation', () => {
    it('should successfully initiate STK Push payment', async () => {
      const service = new MpesaService();
      
      // Mock access token response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          access_token: 'test_access_token',
          expires_in: '3599',
        },
      });

      // Mock STK Push response
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'merchant-123',
          CheckoutRequestID: 'checkout-456',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success. Request accepted for processing',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        id: 'trans-123',
        chamaId: 'chama-123',
        type: 'CONTRIBUTION',
        amount: 1000,
        status: 'PENDING',
      });

      const result = await service.initiatePayment({
        contributionId: 'contrib-123',
        memberId: 'member-123',
        chamaId: 'chama-123',
        organizationId: 'org-123',
        amount: 1000,
        phoneNumber: '0712345678',
        accountReference: 'CONTRIB-123',
        transactionDesc: 'Contribution',
      });

      expect(result.merchantRequestId).toBe('merchant-123');
      expect(result.checkoutRequestId).toBe('checkout-456');
      expect(result.responseCode).toBe('0');
      expect(prisma.transaction.upsert).toHaveBeenCalled();
    });

    it('should handle M-Pesa API errors', async () => {
      const service = new MpesaService();
      
      // Mock access token response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          access_token: 'test_access_token',
          expires_in: '3599',
        },
      });

      // Mock STK Push error
      const mockError = {
        response: {
          data: {
            errorMessage: 'Invalid phone number',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(
        service.initiatePayment({
          contributionId: 'contrib-123',
          memberId: 'member-123',
          chamaId: 'chama-123',
          amount: 1000,
          phoneNumber: '0712345678',
          accountReference: 'CONTRIB-123',
          transactionDesc: 'Contribution',
        })
      ).rejects.toThrow('M-Pesa API error');
    });
  });

  describe('Callback Handling', () => {
    it('should handle successful payment callback', async () => {
      const service = new MpesaService();
      
      const mockTransaction = {
        id: 'trans-123',
        chamaId: 'chama-123',
        organizationId: 'org-123',
        amount: 1000,
        fromMemberId: 'member-123',
        status: 'PENDING',
        metadata: {
          contributionId: 'contrib-123',
          merchantRequestId: 'merchant-123',
          checkoutRequestId: 'checkout-456',
          phoneNumber: '254712345678',
          organizationId: 'org-123',
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.transaction.upsert as jest.Mock).mockResolvedValue({});
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: 'COMPLETED',
      });

      const mockContribution = {
        id: 'contrib-123',
        chamaId: 'chama-123',
        memberId: 'member-123',
          organizationId: 'org-123',
        amount: 1000,
        chama: { currency: 'KES' },
          member: { id: 'member-123', phone: '254712345678', firstName: 'John', lastName: 'Doe' },
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (ContributionService.recordPayment as jest.Mock).mockResolvedValue(mockContribution);

      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'QGH1234567' },
                { Name: 'Amount', Value: 1000 },
                { Name: 'TransactionDate', Value: '20231215120000' },
                { Name: 'PhoneNumber', Value: '254712345678' },
              ],
            },
          },
        },
      };

      await service.handleCallback(callbackData);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'trans-123' }),
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
      expect(ContributionService.recordPayment).toHaveBeenCalled();
    });

    it('should handle failed payment callback', async () => {
      const service = new MpesaService();
      
      const mockTransaction = {
        id: 'trans-123',
        chamaId: 'chama-123',
        amount: 1000,
        fromMemberId: 'member-123',
        status: 'PENDING',
        metadata: {
          contributionId: 'contrib-123',
          phoneNumber: '254712345678',
          retryCount: 0,
          maxRetries: 3,
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: 'FAILED',
      });
      (prisma.backgroundJob.create as jest.Mock).mockResolvedValue({});

      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user',
          },
        },
      };

      await service.handleCallback(callbackData);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'trans-123' }),
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
      expect(prisma.backgroundJob.create).not.toHaveBeenCalled();
    });

    it('should not retry after max retries', async () => {
      const service = new MpesaService();
      
      const mockTransaction = {
        id: 'trans-123',
        chamaId: 'chama-123',
        amount: 1000,
        fromMemberId: 'member-123',
        status: 'PENDING',
        metadata: {
          contributionId: 'contrib-123',
          phoneNumber: '254712345678',
          retryCount: 3,
          maxRetries: 3,
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: 'FAILED',
      });

      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user',
          },
        },
      };

      await service.handleCallback(callbackData);

      expect(prisma.transaction.updateMany).toHaveBeenCalled();
      expect(prisma.backgroundJob.create).not.toHaveBeenCalled();
    });
  });

  describe('Payment Status Query', () => {
    it('classifies result codes before deciding whether to retry', () => {
      expect(classifyMpesaResultCode(1001)).toBe('RETRYABLE');
      expect(classifyMpesaResultCode(1037)).toBe('TIMEOUT');
      expect(classifyMpesaResultCode(1032)).toBe('USER_CANCELLED');
      expect(classifyMpesaResultCode(1)).toBe('INSUFFICIENT_FUNDS');
      expect(classifyMpesaResultCode(400)).toBe('INVALID_REQUEST');
    });

    it('should query payment status successfully', async () => {
      const service = new MpesaService();
      
      const mockTransaction = {
        id: 'trans-123',
        status: 'COMPLETED',
        metadata: {
          resultCode: 0,
          resultDescription: 'Success',
          mpesaReceiptNumber: 'QGH1234567',
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await service.queryPaymentStatus('checkout-456');

      expect(result.status).toBe('COMPLETED');
      expect(result.resultCode).toBe(0);
      expect(result.mpesaReceiptNumber).toBe('QGH1234567');
    });

    it('should return NOT_FOUND for non-existent payment', async () => {
      const service = new MpesaService();
      
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.queryPaymentStatus('checkout-456');

      expect(result.status).toBe('NOT_FOUND');
    });
  });

  describe('Pending Payments Processing', () => {
    it('should process pending payments', async () => {
      const service = new MpesaService();
      
      const mockPendingTransactions = [
        {
          id: 'trans-1',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          metadata: { paymentMethod: 'MPESA' },
        },
      ];

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockPendingTransactions);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({});

      const result = await service.processPendingPayments();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(prisma.transaction.update).toHaveBeenCalled();
    });
  });
});



