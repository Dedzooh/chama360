import { z } from 'zod';

export const contributionCreateSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive(),
  contributionType: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be a valid YYYY-MM month').optional(),
  paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']),
  reference: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'PAID']).default('PAID'),
  paidAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const markContributionPaidSchema = z.object({ paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']), reference: z.string().trim().max(120).optional(), paidAt: z.string().datetime().optional() });
export const reverseContributionSchema = z.object({ reason: z.string().min(1) });

export const loanApplySchema = z.object({ memberId: z.string().cuid().optional(), amountRequested: z.number().positive(), purpose: z.string().max(500).optional(), interestRate: z.number().min(0).max(100).default(0), repaymentPeriodMonths: z.number().int().min(1).max(60).default(6), guarantors: z.array(z.string().cuid()).default([]) });
export const guaranteeDecisionSchema = z.object({ guaranteedAmount: z.number().positive().optional() });
export const loanRepaySchema = z.object({ amount: z.number().positive(), paymentMethod: z.enum(['CASH', 'MPESA', 'BANK']).default('CASH'), reference: z.string().min(1).optional(), idempotencyKey: z.string().trim().min(8).max(120).optional() });

export const investmentAssetSchema = z.object({ name: z.string().trim().min(2).max(120), category: z.enum(['TREASURY_BOND', 'MONEY_MARKET', 'REAL_ESTATE', 'SHARES', 'BUSINESS', 'OTHER']), purchaseDate: z.string().date(), purchaseCost: z.number().positive(), currentValue: z.number().min(0), units: z.number().positive().default(1), status: z.enum(['ACTIVE', 'MATURED', 'SOLD']).default('ACTIVE'), notes: z.string().trim().max(500).optional() });

export const welfareCreateSchema = z.object({ memberId: z.string().cuid(), claimType: z.string().min(1), reason: z.string().min(1), amountRequested: z.number().positive(), documents: z.array(z.string()).default([]) });
export const welfareTransitionSchema = z.object({ comment: z.string().trim().max(500).optional() }).default({});

export const meetingCreateSchema = z.object({ title: z.string().min(3), dateTime: z.string().datetime(), venue: z.string().min(1).optional(), agenda: z.array(z.string()).default([]) });
export const meetingUpdateSchema = z.object({ title: z.string().min(3).optional(), dateTime: z.string().datetime().optional(), venue: z.string().min(1).optional(), agenda: z.array(z.string()).optional(), status: z.enum(['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional() });
export const attendanceSchema = z.object({ memberId: z.string().cuid(), status: z.enum(['PRESENT', 'ABSENT', 'APOLOGY']).default('PRESENT'), notes: z.string().optional() });

export const voteCreateSchema = z.object({ title: z.string().min(3), description: z.string().min(3), options: z.array(z.string().min(1)).min(2), closesAt: z.string().datetime().optional(), quorumRequired: z.number().int().min(0).default(0), isAnonymous: z.boolean().default(false) });
export const voteResponseSchema = z.object({ selectedOption: z.string().min(1) });
