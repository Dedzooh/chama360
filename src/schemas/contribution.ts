import { z } from 'zod';
import { PaymentMethod, ContributionStatus } from '@prisma/client';

/**
 * Contribution validation schemas
 * 
 * This file defines Zod validation schemas for contribution tracking and management
 * as specified in the design document for the Chama Management System.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

// Create contribution cycle schema
export const createContributionCycleSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID'),
  dueDate: z.string().datetime('Invalid due date'),
  amount: z.number()
    .positive('Contribution amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places')
    .optional(), // If not provided, use Chama's default contribution amount
  memberIds: z.array(z.string().cuid('Invalid member ID')).optional(), // If not provided, create for all active members
});

// Record payment schema
export const recordPaymentSchema = z.object({
  contributionId: z.string().cuid('Invalid contribution ID'),
  amount: z.number()
    .positive('Payment amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  transactionRef: z.string()
    .min(1, 'Transaction reference is required')
    .max(100, 'Transaction reference too long')
    .optional(),
  paidDate: z.string().datetime('Invalid payment date').optional(), // Defaults to now
  currency: z.string()
    .length(3, 'Currency must be 3 characters (ISO 4217 code)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code')
    .optional(), // For multi-currency support
  exchangeRate: z.number()
    .positive('Exchange rate must be positive')
    .optional(), // For currency conversion tracking
});

// Update contribution schema
export const updateContributionSchema = z.object({
  status: z.nativeEnum(ContributionStatus).optional(),
  amount: z.number()
    .positive('Contribution amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places')
    .optional(),
  dueDate: z.string().datetime('Invalid due date').optional(),
  penalties: z.number()
    .min(0, 'Penalties cannot be negative')
    .multipleOf(0.01, 'Penalties can have at most 2 decimal places')
    .optional(),
});

// Get contributions query schema
export const getContributionsSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID').optional(),
  memberId: z.string().cuid('Invalid member ID').optional(),
  status: z.nativeEnum(ContributionStatus).optional(),
  fromDate: z.string().datetime('Invalid from date').optional(),
  toDate: z.string().datetime('Invalid to date').optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// Calculate penalties schema
export const calculatePenaltiesSchema = z.object({
  contributionId: z.string().cuid('Invalid contribution ID').optional(),
  chamaId: z.string().cuid('Invalid Chama ID').optional(), // Calculate for all overdue contributions in a Chama
  dryRun: z.boolean().default(false), // If true, only calculate without applying
});

// Multi-currency conversion schema
export const currencyConversionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  fromCurrency: z.string()
    .length(3, 'Currency must be 3 characters (ISO 4217 code)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code'),
  toCurrency: z.string()
    .length(3, 'Currency must be 3 characters (ISO 4217 code)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code'),
  exchangeRate: z.number()
    .positive('Exchange rate must be positive')
    .optional(), // If not provided, fetch from external API
});

// Contribution summary schema
export const contributionSummarySchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID'),
  memberId: z.string().cuid('Invalid member ID').optional(),
  fromDate: z.string().datetime('Invalid from date').optional(),
  toDate: z.string().datetime('Invalid to date').optional(),
});

// Bulk payment recording schema (for M-Pesa reconciliation)
export const bulkRecordPaymentSchema = z.object({
  payments: z.array(z.object({
    contributionId: z.string().cuid('Invalid contribution ID'),
    amount: z.number().positive('Payment amount must be positive'),
    paymentMethod: z.nativeEnum(PaymentMethod),
    transactionRef: z.string().min(1, 'Transaction reference is required'),
    paidDate: z.string().datetime('Invalid payment date').optional(),
  })).min(1, 'At least one payment is required').max(100, 'Cannot process more than 100 payments at once'),
});

// Type exports for use in services
export type CreateContributionCycleInput = z.infer<typeof createContributionCycleSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type UpdateContributionInput = z.infer<typeof updateContributionSchema>;
export type GetContributionsInput = z.infer<typeof getContributionsSchema>;
export type CalculatePenaltiesInput = z.infer<typeof calculatePenaltiesSchema>;
export type CurrencyConversionInput = z.infer<typeof currencyConversionSchema>;
export type ContributionSummaryInput = z.infer<typeof contributionSummarySchema>;
export type BulkRecordPaymentInput = z.infer<typeof bulkRecordPaymentSchema>;
