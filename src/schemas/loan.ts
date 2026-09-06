import { z } from 'zod';

export const applyLoanSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID'),
  amount: z.number().positive('Amount must be positive'),
  durationMonths: z.number().int().min(1).max(24).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  purpose: z.string().max(500).optional(),
});

export const loanListSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID').optional(),
  status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'DEFAULTED', 'PAID']).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
