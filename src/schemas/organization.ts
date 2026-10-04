import { z } from 'zod';

export const organizationTypeSchema = z.enum([
  'CHAMA',
  'WELFARE',
  'SACCO',
  'INVESTMENT_CLUB',
  'FAMILY_GROUP',
  'CHURCH_GROUP',
  'YOUTH_GROUP',
  'STAFF_WELFARE',
  'ESTATE_ASSOCIATION',
]);

export const organizationCreateSchema = z.object({
  name: z.string().min(3).max(120),
  organizationType: organizationTypeSchema,
  chamaType: z.string().min(1).max(50).optional(),
  enabledModules: z.record(z.boolean()).optional(),
  slug: z.string().min(3).max(120).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
  referralCode: z.string().trim().min(4).max(40).optional(),
});

export const organizationUpdateSchema = organizationCreateSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED']).optional(),
});

// Treasurer/owner-updatable payment profile for contributions and "I have
// paid" proofs. Validated on the org settings update path so enabled methods
// and bank details actually persist (the UI already sends this full shape).
export const paymentSettingsUpdateSchema = z.object({
  mode: z.enum(['MPESA_NUMBER', 'PAYBILL']).default('MPESA_NUMBER'),
  mpesaNumber: z.string().trim().optional(),
  paybillNumber: z.string().trim().optional(),
  accountNumber: z.string().trim().max(20).optional(),
  accountReference: z.string().trim().max(12).optional(),
  transactionDesc: z.string().trim().max(13).optional(),
  isEnabled: z.boolean().default(true),
  acceptedMethods: z.array(z.enum(['MPESA', 'BANK', 'CASH'])).min(1).default(['MPESA', 'BANK', 'CASH']),
  bankName: z.string().trim().max(80).optional(),
  bankAccountName: z.string().trim().max(80).optional(),
  bankAccountNumber: z.string().trim().max(30).optional(),
  paymentInstructions: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.isEnabled) {
    if (data.acceptedMethods.includes('BANK') && (!data.bankName || !data.bankAccountNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankAccountNumber'], message: 'Bank name and account number are required when bank transfer is enabled' });
    }
    if (data.mode === 'MPESA_NUMBER' && !data.mpesaNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mpesaNumber'], message: 'M-Pesa number is required when mode is MPESA_NUMBER' });
    }
    if (data.mode === 'PAYBILL' && (!data.paybillNumber || !data.accountNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paybillNumber'], message: 'Paybill number and account number are required when mode is PAYBILL' });
    }
  }
});

export const memberCreateSchema = z.object({
  userId: z.string().cuid().optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).default('MEMBER'),
  status: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']).default('PENDING_APPROVAL'),
});

export const memberUpdateSchema = z.object({
  roleId: z.string().cuid().optional(),
  status: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']).optional(),
});
