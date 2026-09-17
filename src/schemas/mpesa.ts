import { z } from 'zod';

/**
 * M-Pesa validation schemas
 * 
 * This file defines Zod validation schemas for M-Pesa payment integration
 * as specified in the design document for the Chama Management System.
 * 
 * Requirements: 8.5, 15.1, 15.2, 15.3, 15.4, 15.5
 */

// Kenyan phone number validation
const kenyanPhoneSchema = z.string()
  .regex(
    /^(\+?254|0)?[17]\d{8}$/,
    'Invalid Kenyan phone number. Must be in format 0712345678, 254712345678, or +254712345678'
  );

// Initiate M-Pesa payment schema
export const initiateMpesaPaymentSchema = z.object({
  contributionId: z.string().cuid('Invalid contribution ID'),
  phoneNumber: kenyanPhoneSchema,
  accountReference: z.string()
    .min(1, 'Account reference is required')
    .max(12, 'Account reference must be at most 12 characters')
    .default('CHAMA360'),
  transactionDesc: z.string()
    .min(1, 'Transaction description is required')
    .max(13, 'Transaction description must be at most 13 characters')
    .default('Contribution'),
});

// M-Pesa callback schema (from Safaricom)
export const mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(
          z.object({
            Name: z.string(),
            Value: z.union([z.string(), z.number()]),
          })
        ),
      }).optional(),
    }),
  }),
});

export const mpesaC2BConfirmationSchema = z.object({
  TransID: z.string().trim().min(8).max(20),
  TransTime: z.string().trim().min(8).max(20),
  TransAmount: z.coerce.number().positive(),
  BusinessShortCode: z.coerce.string().trim().min(5).max(12),
  BillRefNumber: z.string().trim().min(1).max(20),
  MSISDN: z.coerce.string().trim().min(9).max(15),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
}).passthrough();

// Query payment status schema
export const queryPaymentStatusSchema = z.object({
  checkoutRequestId: z.string().min(1, 'Checkout request ID is required'),
});

// Manual reconciliation schema
export const manualReconciliationSchema = z.object({
  mpesaReceiptNumber: z.string()
    .min(10, 'M-Pesa receipt number must be at least 10 characters')
    .max(10, 'M-Pesa receipt number must be at most 10 characters')
    .regex(/^[A-Z0-9]{10}$/, 'Invalid M-Pesa receipt number format'),
  contributionId: z.string().cuid('Invalid contribution ID'),
  amount: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  phoneNumber: kenyanPhoneSchema,
  transactionDate: z.string().datetime('Invalid transaction date'),
});

// Bulk reconciliation schema
export const bulkReconciliationSchema = z.object({
  payments: z.array(
    z.object({
      mpesaReceiptNumber: z.string()
        .regex(/^[A-Z0-9]{10}$/, 'Invalid M-Pesa receipt number format'),
      contributionId: z.string().cuid('Invalid contribution ID'),
      amount: z.number().positive('Amount must be positive'),
      phoneNumber: kenyanPhoneSchema,
      transactionDate: z.string().datetime('Invalid transaction date'),
    })
  ).min(1, 'At least one payment is required').max(100, 'Cannot process more than 100 payments at once'),
});

// Retry payment schema
export const retryPaymentSchema = z.object({
  contributionId: z.string().cuid('Invalid contribution ID'),
  phoneNumber: kenyanPhoneSchema.optional(), // Optional - use existing if not provided
});

// Get payment history schema
export const getPaymentHistorySchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID').optional(),
  memberId: z.string().cuid('Invalid member ID').optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  fromDate: z.string().datetime('Invalid from date').optional(),
  toDate: z.string().datetime('Invalid to date').optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// Type exports for use in services
export type InitiateMpesaPaymentInput = z.infer<typeof initiateMpesaPaymentSchema>;
export type MpesaCallbackInput = z.infer<typeof mpesaCallbackSchema>;
export type MpesaC2BConfirmationInput = z.infer<typeof mpesaC2BConfirmationSchema>;
export type QueryPaymentStatusInput = z.infer<typeof queryPaymentStatusSchema>;
export type ManualReconciliationInput = z.infer<typeof manualReconciliationSchema>;
export type BulkReconciliationInput = z.infer<typeof bulkReconciliationSchema>;
export type RetryPaymentInput = z.infer<typeof retryPaymentSchema>;
export type GetPaymentHistoryInput = z.infer<typeof getPaymentHistorySchema>;
