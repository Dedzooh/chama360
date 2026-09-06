import { z } from 'zod';

// Password validation schema with security requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

// Email validation schema
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase();

// Phone number validation schema (international format)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .transform(phone => phone.startsWith('+') ? phone : `+${phone}`);

// National ID validation schema (flexible for different countries)
export const nationalIdSchema = z
  .string()
  .min(5, 'National ID must be at least 5 characters')
  .max(20, 'National ID must not exceed 20 characters')
  .regex(/^[A-Za-z0-9]+$/, 'National ID must contain only letters and numbers');

// Name validation schema
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must not exceed 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name must contain only letters, spaces, hyphens, and apostrophes')
  .transform(name => name.trim());

// User registration schema
export const userRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  nationalId: nationalIdSchema,
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

// User login schema
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// Token refresh schema
export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

// Password reset schema
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// MFA setup schema
export const mfaSetupSchema = z.object({
  enable: z.boolean(),
  mfaCode: z.string().regex(/^\d{6}$/, 'MFA code must be exactly 6 digits').optional(),
}).refine(data => data.enable || Boolean(data.mfaCode), {
  message: 'A valid current MFA code is required when disabling MFA',
  path: ['mfaCode'],
});

// MFA verification schema
export const mfaVerificationSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  mfaCode: z.string().regex(/^(?:\d{6}|[a-fA-F0-9]{4}(?:-[a-fA-F0-9]{4}){3})$/, 'Enter a 6-digit code or recovery code'),
});

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Session management schema
export const sessionRevokeSchema = z.object({
  sessionId: z.string().optional(),
  revokeAll: z.boolean().optional().default(false),
});

// Account verification schema
export const accountVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Role switch schema (for multi-Chama users)
export const roleSwitchSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID format'),
  newRole: z.enum(['FOUNDER', 'CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR', 'MEMBER']),
});

// JWT payload validation schema
export const jwtPayloadSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
  email: emailSchema,
  sessionId: z.string().min(1, 'Session ID is required'),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

// Authentication response schema
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  user: z.object({
    id: z.string().cuid(),
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  }).optional(),
});

// MFA response schema
export const mfaResponseSchema = z.object({
  requiresMfa: z.boolean(),
  tempToken: z.string().optional(),
  qrCode: z.string().optional(), // Base64 encoded QR code for MFA setup
  secret: z.string().optional(), // MFA secret for manual entry
  recoveryCodes: z.array(z.string()).optional(),
});

// User session schema
export const userSessionSchema = z.object({
  userId: z.string().cuid(),
  email: emailSchema,
  sessionId: z.string(),
  createdAt: z.date(),
  lastActivity: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  mfaVerified: z.boolean(),
});

// Account lockout schema
export const accountLockoutSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  attempts: z.number().min(0),
  lockedUntil: z.date().optional(),
});

// Security event schema for audit logging
export const securityEventSchema = z.object({
  userId: z.string().cuid().optional(),
  event: z.enum([
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_CHANGE',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'MFA_VERIFIED',
    'TOKEN_REFRESH',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'SESSION_REVOKED',
  ]),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),
});

// Export type definitions for TypeScript
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type TokenRefresh = z.infer<typeof tokenRefreshSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type MfaSetup = z.infer<typeof mfaSetupSchema>;
export type MfaVerification = z.infer<typeof mfaVerificationSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type SessionRevoke = z.infer<typeof sessionRevokeSchema>;
export type AccountVerification = z.infer<typeof accountVerificationSchema>;
export type RoleSwitch = z.infer<typeof roleSwitchSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type MfaResponse = z.infer<typeof mfaResponseSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type AccountLockout = z.infer<typeof accountLockoutSchema>;
export type SecurityEvent = z.infer<typeof securityEventSchema>;

// Validation helper functions
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  try {
    passwordSchema.parse(password);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message),
      };
    }
    return { isValid: false, errors: ['Invalid password'] };
  }
};

export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  try {
    emailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message };
    }
    return { isValid: false, error: 'Invalid email' };
  }
};

export const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
  try {
    phoneSchema.parse(phone);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message };
    }
    return { isValid: false, error: 'Invalid phone number' };
  }
};
