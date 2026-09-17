import axios from 'axios';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { ContributionService } from './contributionService';
import { PaymentMethod, TransactionStatus } from '@prisma/client';
import type { MpesaC2BConfirmationInput } from '../schemas/mpesa';
import { allocatePaidContribution } from './contributionAllocationService';

// Define AxiosInstance type locally if not available
type AxiosInstance = ReturnType<typeof axios.create>;

/**
 * M-Pesa Payment Service
 * 
 * Handles M-Pesa payment integration including:
 * - STK Push (Lipa Na M-Pesa Online) for payment initiation
 * - Payment confirmation and callback handling
 * - Automatic payment reconciliation with member accounts
 * - Payment retry mechanisms
 * 
 * Requirements: 8.5, 15.1, 15.2, 15.3, 15.4, 15.5
 */

interface MpesaAuthResponse {
  access_token: string;
  expires_in: string;
}

interface StkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: string;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

interface PaymentRecord {
  id: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  contributionId: string;
  memberId: string;
  chamaId: string;
  amount: number;
  phoneNumber: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  resultCode?: number;
  resultDescription?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MpesaService {
  private apiClient: AxiosInstance;
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private shortcode: string;
  private passkey: string;
  private callbackUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    // Validate M-Pesa configuration (skip in test and development environment)
    if (config.server.nodeEnv !== 'test' && config.server.nodeEnv !== 'development' && (!config.mpesa.consumerKey || !config.mpesa.consumerSecret)) {
      throw new Error('M-Pesa credentials not configured');
    }

    this.consumerKey = config.mpesa.consumerKey || 'test_key';
    this.consumerSecret = config.mpesa.consumerSecret || 'test_secret';
    this.shortcode = config.mpesa.shortcode || '174379';
    this.passkey = config.mpesa.passkey || 'test_passkey';
    this.callbackUrl = config.mpesa.callbackUrl || 'https://example.com/callback';

    // Set base URL based on environment
    this.baseUrl = config.mpesa.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    // Initialize axios client
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('M-Pesa service initialized', {
      environment: config.mpesa.environment,
      shortcode: this.shortcode,
    });
  }

  /**
   * Get OAuth access token from M-Pesa API
   * Requirements: 15.1
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await axios.get<MpesaAuthResponse>(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      const expiresIn = parseInt(response.data.expires_in) - 300;
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      logger.info('M-Pesa access token obtained', {
        expiresIn: response.data.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get M-Pesa access token', { error });
      throw new Error('Failed to authenticate with M-Pesa API');
    }
  }

  /**
   * Generate M-Pesa password for STK Push
   */
  private generatePassword(timestamp: string): string {
    const data = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Generate timestamp in M-Pesa format (YYYYMMDDHHmmss)
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Normalize phone number to M-Pesa format (254XXXXXXXXX)
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let normalized = phone.replace(/\D/g, '');

    // Handle different formats
    if (normalized.startsWith('0')) {
      normalized = '254' + normalized.substring(1);
    } else if (normalized.startsWith('+254')) {
      normalized = normalized.substring(1);
    } else if (normalized.startsWith('254')) {
      // Already in correct format
    } else if (normalized.length === 9) {
      normalized = '254' + normalized;
    }

    return normalized;
  }

  /**
   * Initiate STK Push payment
   * Requirements: 15.1, 15.2
   */
  async initiatePayment(data: {
    contributionId: string;
    memberId: string;
    chamaId: string;
    amount: number;
    phoneNumber: string;
    accountReference: string;
    transactionDesc: string;
  }): Promise<{
    merchantRequestId: string;
    checkoutRequestId: string;
    responseCode: string;
    responseDescription: string;
    customerMessage: string;
  }> {
    try {
      // Get access token
      const accessToken = await this.getAccessToken();

      // Generate timestamp and password
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      // Normalize phone number
      const phoneNumber = this.normalizePhoneNumber(data.phoneNumber);

      // Prepare STK Push request
      const stkPushRequest: StkPushRequest = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(data.amount).toString(),
        PartyA: phoneNumber,
        PartyB: this.shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.callbackUrl,
        AccountReference: data.accountReference,
        TransactionDesc: data.transactionDesc,
      };

      // Make STK Push request
      const response = await this.apiClient.post<StkPushResponse>(
        '/mpesa/stkpush/v1/processrequest',
        stkPushRequest,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Store payment record in database
      await this.createPaymentRecord({
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        contributionId: data.contributionId,
        memberId: data.memberId,
        chamaId: data.chamaId,
        amount: data.amount,
        phoneNumber: phoneNumber,
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
      });

      logger.info('M-Pesa STK Push initiated', {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        contributionId: data.contributionId,
        amount: data.amount,
      });

      return {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      };
    } catch (error) {
      logger.error('Failed to initiate M-Pesa payment', {
        error,
        contributionId: data.contributionId,
      });

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        throw new Error(
          `M-Pesa API error: ${axiosError.response?.data?.errorMessage || axiosError.message || 'Unknown error'}`
        );
      }

      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  /**
   * Create payment record in database
   */
  private async createPaymentRecord(data: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await prisma.transaction.create({
      data: {
        chamaId: data.chamaId,
        type: 'CONTRIBUTION',
        amount: data.amount,
        fromMemberId: data.memberId,
        reference: `MPESA-${data.checkoutRequestId}`,
        idempotencyKey: data.checkoutRequestId,
        status: TransactionStatus.PENDING,
        metadata: {
          merchantRequestId: data.merchantRequestId,
          checkoutRequestId: data.checkoutRequestId,
          contributionId: data.contributionId,
          phoneNumber: data.phoneNumber,
          paymentMethod: 'MPESA',
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
        },
      },
    });
  }

  /**
   * Handle M-Pesa callback
   * Requirements: 15.2, 15.3, 15.5
   */
  async handleCallback(callbackData: MpesaCallback): Promise<void> {
    const callback = callbackData.Body.stkCallback;
    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    try {
      // Find the payment record
      const transaction = await prisma.transaction.findUnique({
        where: { idempotencyKey: CheckoutRequestID },
      });

      if (!transaction) {
        logger.warn('Payment record not found for callback', {
          checkoutRequestId: CheckoutRequestID,
        });
        return;
      }

      if (transaction.status === TransactionStatus.COMPLETED) {
        logger.info('Ignoring duplicate completed M-Pesa callback', { checkoutRequestId: CheckoutRequestID });
        return;
      }

      const metadata = transaction.metadata as any;

      // Check if payment was successful
      if (ResultCode === 0) {
        // Extract payment details from callback
        const callbackMetadata = callback.CallbackMetadata?.Item || [];
        const mpesaReceiptNumber = callbackMetadata.find(
          item => item.Name === 'MpesaReceiptNumber'
        )?.Value as string;
        const transactionDate = callbackMetadata.find(
          item => item.Name === 'TransactionDate'
        )?.Value as string;
        const phoneNumber = callbackMetadata.find(
          item => item.Name === 'PhoneNumber'
        )?.Value as string;

        // Update transaction status
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.COMPLETED,
            metadata: {
              ...metadata,
              mpesaReceiptNumber,
              transactionDate,
              phoneNumber,
              resultCode: ResultCode,
              resultDescription: ResultDesc,
              completedAt: new Date(),
            },
          },
        });

        // Automatically reconcile payment with contribution
        await this.reconcilePayment({
          contributionId: metadata.contributionId,
          amount: Number(transaction.amount),
          transactionRef: mpesaReceiptNumber,
          phoneNumber: phoneNumber,
        });

        logger.info('M-Pesa payment successful and reconciled', {
          checkoutRequestId: CheckoutRequestID,
          mpesaReceiptNumber,
          contributionId: metadata.contributionId,
          amount: transaction.amount,
        });
      } else {
        // Payment failed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.FAILED,
            metadata: {
              ...metadata,
              resultCode: ResultCode,
              resultDescription: ResultDesc,
              failedAt: new Date(),
            },
          },
        });

        // Check if we should retry
        const retryCount = metadata.retryCount || 0;
        const maxRetries = metadata.maxRetries || 3;

        if (retryCount < maxRetries) {
          // Schedule retry
          await this.scheduleRetry({
            contributionId: metadata.contributionId,
            memberId: transaction.fromMemberId!,
            chamaId: transaction.chamaId,
            amount: Number(transaction.amount),
            phoneNumber: metadata.phoneNumber,
            retryCount: retryCount + 1,
          });

          logger.info('M-Pesa payment failed, retry scheduled', {
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
            resultDescription: ResultDesc,
            retryCount: retryCount + 1,
          });
        } else {
          logger.error('M-Pesa payment failed after max retries', {
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
            resultDescription: ResultDesc,
            contributionId: metadata.contributionId,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to handle M-Pesa callback', {
        error,
        checkoutRequestId: CheckoutRequestID,
      });
      throw error;
    }
  }

  async handleC2BConfirmation(data: MpesaC2BConfirmationInput): Promise<{ matched: boolean; duplicate?: boolean; message: string }> {
    const receipt = data.TransID.toUpperCase();
    const idempotencyKey = `C2B:${receipt}`;
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return { matched: true, duplicate: true, message: 'Already processed' };

    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      include: {
        chama: { select: { id: true } },
        settings: { select: { contributionRules: true } },
        members: { where: { status: 'ACTIVE' }, include: { user: { select: { id: true, phone: true, firstName: true, lastName: true } } } },
      },
    });
    const normalizedReference = data.BillRefNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    let matchedOrganization: (typeof organizations)[number] | null = null;
    let matchedMember: (typeof organizations)[number]['members'][number] | null = null;
    let paybillOrganization: (typeof organizations)[number] | null = null;

    for (const organization of organizations) {
      const paymentSettings = ((organization.metadata ?? {}) as any).paymentSettings ?? {};
      if (paymentSettings.mode !== 'PAYBILL' || String(paymentSettings.paybillNumber ?? '') !== data.BusinessShortCode) continue;
      paybillOrganization = organization;
      const prefix = String(paymentSettings.accountNumber ?? paymentSettings.accountReference ?? 'CHAMA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      const member = organization.members.find((candidate) => {
        const suffix = String(candidate.user.phone ?? candidate.user.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
        return `${prefix}${suffix}`.slice(0, 12) === normalizedReference;
      });
      if (member) { matchedOrganization = organization; matchedMember = member; break; }
    }

    if (!matchedOrganization || !matchedMember || !matchedOrganization.chama?.id) {
      if (paybillOrganization?.chama?.id) {
        try {
          await prisma.transaction.create({ data: { chamaId: paybillOrganization.chama.id, organizationId: paybillOrganization.id, type: 'CONTRIBUTION', amount: data.TransAmount, reference: `MPESA-C2B-${receipt}`, idempotencyKey, status: 'PENDING', metadata: { paymentMethod: 'MPESA', mpesaReceiptNumber: receipt, billRefNumber: data.BillRefNumber, phoneNumber: data.MSISDN, transactionDate: data.TransTime, source: 'C2B_PAYBILL', reconciliationRequired: true, reason: 'MEMBER_REFERENCE_NOT_MATCHED' } } });
        } catch (error: any) {
          if (error?.code === 'P2002') return { matched: false, duplicate: true, message: 'Already received for manual reconciliation' };
          throw error;
        }
      }
      logger.warn('PayBill confirmation has an unmatched member reference', { receipt, paybill: data.BusinessShortCode, billRefNumber: data.BillRefNumber });
      return { matched: false, message: 'Accepted for manual reconciliation' };
    }

    const contribution = await prisma.contribution.findFirst({
      where: { organizationId: matchedOrganization.id, memberId: matchedMember.userId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    if (!contribution) {
      logger.warn('PayBill member matched but has no outstanding contribution', { receipt, organizationId: matchedOrganization.id, memberId: matchedMember.userId });
      return { matched: false, message: 'Accepted for manual reconciliation' };
    }

    const paidAt = new Date();
    const priorPayments = await prisma.transaction.aggregate({
      where: { organizationId: matchedOrganization.id, fromMemberId: matchedMember.userId, type: 'CONTRIBUTION', status: 'COMPLETED', metadata: { path: ['contributionId'], equals: contribution.id } },
      _sum: { amount: true },
    });
    const totalReceived = Number(priorPayments._sum.amount ?? 0) + Number(data.TransAmount);
    const amountRequired = Number(contribution.amount) + Number(contribution.penalties ?? 0);
    const fullyPaid = totalReceived >= amountRequired;
    const contributionAmount = fullyPaid && totalReceived > Number(contribution.amount) ? totalReceived : Number(contribution.amount);
    try {
      await prisma.$transaction(async (tx) => {
        const reservation = await tx.transaction.create({ data: { chamaId: matchedOrganization!.chama!.id, organizationId: matchedOrganization!.id, type: 'CONTRIBUTION', amount: data.TransAmount, fromMemberId: matchedMember!.userId, reference: `MPESA-C2B-${receipt}`, idempotencyKey, status: 'PENDING', metadata: { contributionId: contribution.id, paymentMethod: 'MPESA', mpesaReceiptNumber: receipt, billRefNumber: data.BillRefNumber, phoneNumber: data.MSISDN, transactionDate: data.TransTime, source: 'C2B_PAYBILL' } } });
        const updated = await tx.contribution.update({ where: { id: contribution.id }, data: { amount: contributionAmount, status: fullyPaid ? 'PAID' : 'PARTIAL', paymentMethod: 'MPESA', reference: receipt, transactionRef: receipt, paidAt: fullyPaid ? paidAt : null, paidDate: paidAt, recordedById: matchedMember!.userId } });
        await allocatePaidContribution(tx, updated);
        await tx.organizationWallet.upsert({ where: { organizationId: matchedOrganization!.id }, create: { organizationId: matchedOrganization!.id, balance: data.TransAmount, currency: 'KES' }, update: { balance: { increment: data.TransAmount } } });
        await tx.transaction.update({ where: { id: reservation.id }, data: { status: 'COMPLETED', metadata: { contributionId: contribution.id, paymentMethod: 'MPESA', mpesaReceiptNumber: receipt, billRefNumber: data.BillRefNumber, phoneNumber: data.MSISDN, transactionDate: data.TransTime, source: 'C2B_PAYBILL', reconciliationRequired: false, reconciledAt: paidAt } } });
        await tx.organizationAuditLog.create({ data: { organizationId: matchedOrganization!.id, userId: matchedMember!.userId, action: 'UPDATE', entityType: 'Contribution', entityId: contribution.id, oldValues: contribution as any, newValues: updated as any, metadata: { operation: 'AUTOMATIC_PAYBILL_RECONCILIATION', receipt, accountReference: data.BillRefNumber } } });
        await tx.notification.create({ data: { dedupeKey: `paybill-confirmation:${receipt}`, recipientId: matchedMember!.userId, organizationId: matchedOrganization!.id, chamaId: matchedOrganization!.chama!.id, type: 'GENERAL_UPDATE', priority: 'INFO', title: fullyPaid ? 'PayBill contribution received' : 'Partial PayBill contribution received', message: fullyPaid ? `Your M-Pesa payment of KES ${Number(data.TransAmount).toLocaleString()} was received and allocated. Receipt: ${receipt}.` : `KES ${Number(data.TransAmount).toLocaleString()} was received. Your contribution remains partially paid. Receipt: ${receipt}.`, status: 'DELIVERED', sentAt: paidAt, channels: { create: [{ type: 'IN_APP', address: matchedMember!.userId, status: 'DELIVERED', deliveredAt: paidAt }] } } });
      });
    } catch (error: any) {
      if (error?.code === 'P2002') return { matched: true, duplicate: true, message: 'Already processed' };
      throw error;
    }
    logger.info('PayBill payment automatically reconciled', { receipt, organizationId: matchedOrganization.id, memberId: matchedMember.userId, contributionId: contribution.id, amount: data.TransAmount });
    return { matched: true, message: 'Accepted and reconciled' };
  }

  /**
   * Reconcile M-Pesa payment with contribution
   * Requirements: 15.5
   */
  private async reconcilePayment(data: {
    contributionId: string;
    amount: number;
    transactionRef: string;
    phoneNumber: string;
  }): Promise<void> {
    try {
      // Get contribution details
      const contribution = await prisma.contribution.findUnique({
        where: { id: data.contributionId },
        include: {
          chama: true,
          member: true,
        },
      });

      if (!contribution) {
        throw new Error('Contribution not found');
      }

      // Record payment using ContributionService
      await ContributionService.recordPayment(
        {
          contributionId: data.contributionId,
          amount: data.amount,
          paymentMethod: PaymentMethod.MPESA,
          transactionRef: data.transactionRef,
          paidDate: new Date().toISOString(),
        },
        contribution.memberId // System reconciliation uses member's ID
      );

      logger.info('Payment reconciled with contribution', {
        contributionId: data.contributionId,
        amount: data.amount,
        transactionRef: data.transactionRef,
      });
    } catch (error) {
      logger.error('Failed to reconcile payment', {
        error,
        contributionId: data.contributionId,
      });
      throw error;
    }
  }

  /**
   * Schedule payment retry
   * Requirements: 15.3
   */
  private async scheduleRetry(data: {
    contributionId: string;
    memberId: string;
    chamaId: string;
    amount: number;
    phoneNumber: string;
    retryCount: number;
  }): Promise<void> {
    // Calculate exponential backoff delay (1 hour, 3 hours, 6 hours)
    const delayHours = Math.pow(2, data.retryCount - 1);
    const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    // Create background job for retry
    await prisma.backgroundJob.create({
      data: {
        type: 'NOTIFICATION_DELIVERY', // Reuse notification job type for retry
        status: 'PENDING',
        payload: {
          type: 'MPESA_PAYMENT_RETRY',
          contributionId: data.contributionId,
          memberId: data.memberId,
          chamaId: data.chamaId,
          amount: data.amount,
          phoneNumber: data.phoneNumber,
          retryCount: data.retryCount,
        },
        scheduledAt,
        maxRetries: 1, // Don't retry the retry job itself
      },
    });

    logger.info('Payment retry scheduled', {
      contributionId: data.contributionId,
      retryCount: data.retryCount,
      scheduledAt,
    });
  }

  /**
   * Query payment status
   * Requirements: 15.2
   */
  async queryPaymentStatus(checkoutRequestId: string): Promise<{
    status: string;
    resultCode?: number;
    resultDescription?: string;
    mpesaReceiptNumber?: string;
  }> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { idempotencyKey: checkoutRequestId },
      });

      if (!transaction) {
        return {
          status: 'NOT_FOUND',
        };
      }

      const metadata = transaction.metadata as any;

      return {
        status: transaction.status,
        resultCode: metadata?.resultCode,
        resultDescription: metadata?.resultDescription,
        mpesaReceiptNumber: metadata?.mpesaReceiptNumber,
      };
    } catch (error) {
      logger.error('Failed to query payment status', {
        error,
        checkoutRequestId,
      });
      throw error;
    }
  }

  /**
   * Process pending payments (for reconciliation jobs)
   * Requirements: 15.5
   */
  async processPendingPayments(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    try {
      // Find pending M-Pesa transactions older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: TransactionStatus.PENDING,
          createdAt: { lt: fiveMinutesAgo },
          metadata: {
            path: ['paymentMethod'],
            equals: 'MPESA',
          },
        },
        take: 100, // Process in batches
      });

      let successful = 0;
      let failed = 0;

      for (const transaction of pendingTransactions) {
        const metadata = transaction.metadata as any;

        // Query M-Pesa API for status (in production, use STK Query API)
        // For now, mark as failed if too old (> 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        if (transaction.createdAt < tenMinutesAgo) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.FAILED,
              metadata: {
                ...metadata,
                resultDescription: 'Payment timeout - no callback received',
                failedAt: new Date(),
              },
            },
          });
          failed++;
        }
      }

      logger.info('Pending payments processed', {
        processed: pendingTransactions.length,
        successful,
        failed,
      });

      return {
        processed: pendingTransactions.length,
        successful,
        failed,
      };
    } catch (error) {
      logger.error('Failed to process pending payments', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const mpesaService = new MpesaService();
