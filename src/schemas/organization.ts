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
