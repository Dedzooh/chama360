// @ts-nocheck
import { z } from 'zod';
import { Visibility, Frequency } from '@prisma/client';

/**
 * Chama validation schemas
 *
 * This file defines Zod validation schemas for Chama creation and configuration
 * as specified in the design document for the Chama Management System.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

// ROSCA-specific settings schema
export const roscaSettingsSchema = z.object({
  payoutSchedule: z.array(
    z.object({
      memberId: z.string().cuid('Invalid member ID'),
      payoutDate: z.string().datetime('Invalid payout date'),
      amount: z.number().positive('Payout amount must be positive'),
      status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']).default('PENDING'),
    })
  ).min(1, 'ROSCA requires at least one payout schedule entry'),
  currentPayoutIndex: z.number().int().min(0).default(0),
  rotationType: z.enum(['SEQUENTIAL', 'RANDOM', 'BIDDING']).default('SEQUENTIAL'),
  allowSkipping: z.boolean().default(false),
});

// ASCA-specific settings schema
export const ascaSettingsSchema = z.object({
  shareOutDate: z.string().datetime('Invalid share-out date'),
  loanInterestRate: z.number()
    .min(0, 'Interest rate cannot be negative')
    .max(100, 'Interest rate cannot exceed 100%')
    .multipleOf(0.01, 'Interest rate can have at most 2 decimal places'),
  maxLoanAmount: z.number().positive('Maximum loan amount must be positive'),
  minLoanAmount: z.number().positive('Minimum loan amount must be positive').optional(),
  loanDurationMonths: z.number().int().min(1).max(24).default(6),
  requireGuarantors: z.boolean().default(true),
  minGuarantors: z.number().int().min(1).max(5).default(2),
});

// NORMAL Chama settings schema
export const normalSettingsSchema = z.object({
  allowInvestments: z.boolean().default(false),
  investmentTypes: z.array(z.string()).optional(),
  votingQuorum: z.number().min(0).max(100).default(50),
  meetingFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).default('MONTHLY'),
  requireMeetingAttendance: z.boolean().default(true),
  minAttendancePercentage: z.number().min(0).max(100).default(75),
});

// Governance rules schema
export const governanceRulesSchema = z.object({
  votingRules: z.object({
    defaultVoteType: z.enum(['SIMPLE_MAJORITY', 'WEIGHTED_CONTRIBUTION', 'ROLE_RESTRICTED']).default('SIMPLE_MAJORITY'),
    quorumPercentage: z.number().min(0).max(100).default(50),
    votingPeriodDays: z.number().int().min(1).max(30).default(7),
  }),
  decisionThreshold: z.number().min(0).max(100).default(50),
  allowProposals: z.boolean().default(true),
  proposalApprovalRequired: z.boolean().default(true),
});

// Penalty rules schema
export const penaltyRulesSchema = z.object({
  lateContributionPenalty: z.number().min(0).default(0),
  penaltyType: z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
  gracePeriodDays: z.number().int().min(0).max(30).default(0),
  maxPenaltyAmount: z.number().min(0).optional(),
  compoundPenalties: z.boolean().default(false),
});

// Chama payment settings schema
const kenyanPhoneSchema = z.string().regex(
  /^(\+?254|0)?[17]\d{8}$/,
  'Invalid Kenyan phone number. Use 0712345678, 254712345678, or +254712345678'
);

export const organizationKindSchema = z.enum([
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

export const chamaTypeSchema = z.enum([
  'SAVINGS',
  'MERRY_GO_ROUND',
  'ROSCA',
  'INVESTMENT',
  'WELFARE',
  'BUSINESS',
  'HOUSING',
  'FAMILY',
  'CHURCH',
  'YOUTH',
  'STAFF',
  'FARMERS',
  'WOMEN',
  'MEN',
  'COMMUNITY',
  'HYBRID',
  'ASCA',
  'NORMAL',
]);

export const chamaModuleSchema = z.enum([
  'SAVINGS',
  'CONTRIBUTIONS',
  'LOANS',
  'SHARES',
  'INVESTMENTS',
  'WELFARE',
  'MEETINGS',
  'VOTING',
  'FINES',
  'ASSET_REGISTER',
  'PROJECTS',
  'MPESA',
  'REPORTS',
  'DOCUMENTS',
]);

export const chamaEnabledModulesSchema = z.object({
  savings: z.boolean().default(false),
  contributions: z.boolean().default(false),
  loans: z.boolean().default(false),
  welfare: z.boolean().default(false),
  investments: z.boolean().default(false),
  meetings: z.boolean().default(false),
  voting: z.boolean().default(false),
  fines: z.boolean().default(false),
  reports: z.boolean().default(false),
  documents: z.boolean().default(false),
  mpesa: z.boolean().default(false),
});

export const contributionRulesSchema = z.object({
  amount: z.number().positive(),
  frequency: z.enum(['WEEKLY', 'MONTHLY']),
  gracePeriodDays: z.number().int().min(0).default(0),
  lateFeeAmount: z.number().min(0).default(0),
  allowPartialPayments: z.boolean().default(false),
  collectionDay: z.number().int().min(1).max(31).default(1),
});

export const loanRulesSchema = z.object({
  enabled: z.boolean().default(false),
  maxLoanAmount: z.number().min(0).default(0),
  interestRate: z.number().min(0).max(100).default(0),
  repaymentMonths: z.number().int().min(1).max(60).default(6),
  guarantorsRequired: z.number().int().min(0).default(1),
  maxActiveLoans: z.number().int().min(1).default(1),
});

export const welfareRulesSchema = z.object({
  enabled: z.boolean().default(false),
  maxClaimAmount: z.number().min(0).default(0),
  approvalThreshold: z.number().min(0).max(100).default(50),
  categories: z.array(z.string()).default([]),
});

export const committeeRoleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(255),
  permissions: z.array(z.string()).default([]),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(100).optional(),
});

export const paymentSettingsSchema = z.object({
  mode: z.enum(['MPESA_NUMBER', 'PAYBILL']).default('MPESA_NUMBER'),
  mpesaNumber: kenyanPhoneSchema.optional(),
  paybillNumber: z.string().regex(/^\d{5,7}$/, 'Paybill number must be 5 to 7 digits').optional(),
  accountNumber: z.string().min(2).max(20).optional(),
  accountReference: z.string().min(1).max(12).optional(),
  transactionDesc: z.string().min(1).max(13).optional(),
  isEnabled: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.mode === 'MPESA_NUMBER' && !data.mpesaNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mpesaNumber'],
      message: 'M-Pesa number is required when mode is MPESA_NUMBER',
    });
  }

  if (data.mode === 'PAYBILL') {
    if (!data.paybillNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paybillNumber'],
        message: 'Paybill number is required when mode is PAYBILL',
      });
    }
    if (!data.accountNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountNumber'],
        message: 'Account number is required when mode is PAYBILL',
      });
    }
  }
});

export const chamaSettingsSchema = z.object({
  enabledModules: chamaEnabledModulesSchema.optional(),
  contributionRules: contributionRulesSchema.optional(),
  loanRules: loanRulesSchema.optional(),
  welfareRules: welfareRulesSchema.optional(),
  committeeRoles: z.array(committeeRoleSchema).optional(),
  inviteMembers: z.array(inviteMemberSchema).optional(),
  roscaSettings: roscaSettingsSchema.optional(),
  ascaSettings: ascaSettingsSchema.optional(),
  normalSettings: normalSettingsSchema.optional(),
  governanceRules: governanceRulesSchema.optional(),
  penaltyRules: penaltyRulesSchema.optional(),
  paymentSettings: paymentSettingsSchema.optional(),
  organizationLabel: z.string().min(1).max(100).optional(),
}).refine((data) => {
  const hasLegacySettings = !!(data.roscaSettings || data.ascaSettings || data.normalSettings);
  const hasAnyModule = !!data.enabledModules && Object.values(data.enabledModules).some(Boolean);
  return hasLegacySettings || hasAnyModule;
}, {
  message: 'Enable at least one module or provide legacy type-specific settings',
});

export const createChamaSchema = z.object({
  name: z.string()
    .min(3, 'Chama name must be at least 3 characters')
    .max(100, 'Chama name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Chama name can only contain letters, numbers, spaces, hyphens, and underscores'),
  type: chamaTypeSchema,
  organizationKind: organizationKindSchema.default('CHAMA'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  maxMembers: z.number()
    .int('Maximum members must be an integer')
    .min(2, 'Minimum 2 members required')
    .max(1000, 'Maximum 1000 members allowed'),
  contributionAmount: z.number()
    .positive('Contribution amount must be positive')
    .multipleOf(0.01, 'Contribution amount can have at most 2 decimal places'),
  contributionFrequency: z.nativeEnum(Frequency),
  currency: z.string()
    .length(3, 'Currency must be 3 characters (ISO 4217 code)')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code')
    .default('KES'),
  visibility: z.nativeEnum(Visibility).default(Visibility.PUBLIC),
  settings: chamaSettingsSchema,
}).refine((data) => {
  const type = data.type === 'MERRY_GO_ROUND' ? 'ROSCA' : data.type;
  const legacyTypes = ['ROSCA', 'ASCA', 'NORMAL'] as const;
  if (!legacyTypes.includes(type as (typeof legacyTypes)[number])) {
    return !!data.settings.enabledModules && Object.values(data.settings.enabledModules).some(Boolean);
  }

  if (type === 'ROSCA' && !data.settings.roscaSettings) {
    return false;
  }
  if (type === 'ASCA' && !data.settings.ascaSettings) {
    return false;
  }
  if (type === 'NORMAL' && !data.settings.normalSettings) {
    return false;
  }
  return true;
}, {
  message: 'Settings must include the required module configuration for this Chama type',
  path: ['settings'],
});

export const updateChamaSchema = z.object({
  name: z.string()
    .min(3, 'Chama name must be at least 3 characters')
    .max(100, 'Chama name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Chama name can only contain letters, numbers, spaces, hyphens, and underscores')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  maxMembers: z.number()
    .int('Maximum members must be an integer')
    .min(2, 'Minimum 2 members required')
    .max(1000, 'Maximum 1000 members allowed')
    .optional(),
  contributionAmount: z.number()
    .positive('Contribution amount must be positive')
    .multipleOf(0.01, 'Contribution amount can have at most 2 decimal places')
    .optional(),
  contributionFrequency: z.nativeEnum(Frequency).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  settings: z.object({
    enabledModules: chamaEnabledModulesSchema.optional(),
    contributionRules: contributionRulesSchema.optional(),
    loanRules: loanRulesSchema.optional(),
    welfareRules: welfareRulesSchema.optional(),
    committeeRoles: z.array(committeeRoleSchema).optional(),
    inviteMembers: z.array(inviteMemberSchema).optional(),
    roscaSettings: roscaSettingsSchema.optional(),
    ascaSettings: ascaSettingsSchema.optional(),
    normalSettings: normalSettingsSchema.optional(),
    governanceRules: governanceRulesSchema.optional(),
    penaltyRules: penaltyRulesSchema.optional(),
    paymentSettings: paymentSettingsSchema.optional(),
    organizationLabel: z.string().min(1).max(100).optional(),
  }).optional(),
});

export const joinChamaSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID'),
  shareableLink: z.string().uuid('Invalid shareable link').optional(),
  termsAgreed: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions to join',
  }),
  applicationMessage: z.string()
    .max(500, 'Application message cannot exceed 500 characters')
    .optional(),
});

export const approveMembershipSchema = z.object({
  applicantId: z.string().cuid('Invalid applicant ID'),
  approvalNotes: z.string()
    .max(500, 'Approval notes cannot exceed 500 characters')
    .optional(),
});

export const rejectMembershipSchema = z.object({
  applicantId: z.string().cuid('Invalid applicant ID'),
  rejectionReason: z.string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason cannot exceed 500 characters'),
});

export const inviteMembersSchema = z.object({
  emails: z.array(z.string().email('Invalid email address'))
    .min(1, 'At least one email is required')
    .max(50, 'Cannot invite more than 50 members at once'),
  message: z.string()
    .max(500, 'Message cannot exceed 500 characters')
    .optional(),
});

export const chamaSearchSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  type: chamaTypeSchema.optional(),
  minContribution: z.number().positive().optional(),
  maxContribution: z.number().positive().optional(),
  frequency: z.nativeEnum(Frequency).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
});

// Use the schema's input type so fields with defaults remain optional for
// callers. Parsing produces the fully-populated output type.
export type CreateChamaInput = z.input<typeof createChamaSchema>;
export type UpdateChamaInput = z.infer<typeof updateChamaSchema>;
export type JoinChamaInput = z.infer<typeof joinChamaSchema>;
export type InviteMembersInput = z.infer<typeof inviteMembersSchema>;
export type ChamaSearchInput = z.infer<typeof chamaSearchSchema>;
export type ApproveMembershipInput = z.infer<typeof approveMembershipSchema>;
export type RejectMembershipInput = z.infer<typeof rejectMembershipSchema>;
export type ROSCASettings = z.infer<typeof roscaSettingsSchema>;
export type ASCASettings = z.infer<typeof ascaSettingsSchema>;
export type NormalSettings = z.infer<typeof normalSettingsSchema>;
export type GovernanceRules = z.infer<typeof governanceRulesSchema>;
export type PenaltyRules = z.infer<typeof penaltyRulesSchema>;
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;
export type ChamaType = z.infer<typeof chamaTypeSchema>;
export type OrganizationKind = z.infer<typeof organizationKindSchema>;

