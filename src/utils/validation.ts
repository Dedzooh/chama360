import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email format');

export const phoneSchema = z.string().regex(
  /^\+254[0-9]{9}$/,
  'Phone number must be in format +254XXXXXXXXX'
);

export const nationalIdSchema = z.string().regex(
  /^[0-9]{8}$/,
  'National ID must be 8 digits'
);

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const positiveNumberSchema = z.number().positive('Must be a positive number');

export const nonNegativeNumberSchema = z.number().min(0, 'Must be non-negative');

export const currencyAmountSchema = z.number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date validation schemas
export const dateStringSchema = z.string().datetime('Invalid date format');

export const futureDateSchema = z.date().refine(
  (date) => date > new Date(),
  'Date must be in the future'
);

export const pastDateSchema = z.date().refine(
  (date) => date < new Date(),
  'Date must be in the past'
);

// File validation schemas
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimetype: z.string().min(1, 'File type is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
});

export const imageFileSchema = fileUploadSchema.extend({
  mimetype: z.string().regex(
    /^image\/(jpeg|jpg|png|gif|webp)$/,
    'File must be a valid image format (JPEG, PNG, GIF, WebP)'
  ),
});

export const documentFileSchema = fileUploadSchema.extend({
  mimetype: z.string().regex(
    /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/,
    'File must be a valid document format (PDF, DOC, DOCX, TXT)'
  ),
});

// Chama-specific validation schemas
export const contributionAmountSchema = z.number()
  .positive('Contribution amount must be positive')
  .max(1000000, 'Contribution amount cannot exceed 1,000,000')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

export const loanAmountSchema = z.number()
  .positive('Loan amount must be positive')
  .max(10000000, 'Loan amount cannot exceed 10,000,000')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

export const interestRateSchema = z.number()
  .min(0, 'Interest rate cannot be negative')
  .max(1, 'Interest rate cannot exceed 100%')
  .multipleOf(0.0001, 'Interest rate can have at most 4 decimal places');

export const chamaNameSchema = z.string()
  .min(3, 'Chama name must be at least 3 characters')
  .max(100, 'Chama name cannot exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Chama name can only contain letters, numbers, spaces, hyphens, and underscores');

// Validation helper functions
export const validateEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const validatePhone = (phone: string): boolean => {
  return phoneSchema.safeParse(phone).success;
};

export const validateNationalId = (nationalId: string): boolean => {
  return nationalIdSchema.safeParse(nationalId).success;
};

export const validatePassword = (password: string): boolean => {
  return passwordSchema.safeParse(password).success;
};

export const validateUuid = (uuid: string): boolean => {
  return uuidSchema.safeParse(uuid).success;
};

// Custom validation functions
export const validateKenyanPhoneNumber = (phone: string): boolean => {
  // Accept both +254 and 07/01 formats
  const kenyanPhoneRegex = /^(\+254|0)[17][0-9]{8}$/;
  return kenyanPhoneRegex.test(phone);
};

export const normalizeKenyanPhoneNumber = (phone: string): string => {
  // Convert 07XXXXXXXX or 01XXXXXXXX to +254XXXXXXXXX
  if (phone.startsWith('0')) {
    return '+254' + phone.substring(1);
  }
  return phone;
};

export const validateMpesaTransactionId = (transactionId: string): boolean => {
  // M-Pesa transaction IDs are typically 10 characters alphanumeric
  const mpesaTransactionRegex = /^[A-Z0-9]{10}$/;
  return mpesaTransactionRegex.test(transactionId);
};

export const validateKenyanNationalId = (nationalId: string): boolean => {
  // Kenyan national IDs are 8 digits
  const kenyanIdRegex = /^[0-9]{8}$/;
  return kenyanIdRegex.test(nationalId);
};

// Business rule validation functions
export const validateContributionDate = (dueDate: Date, frequency: 'WEEKLY' | 'MONTHLY'): boolean => {
  const now = new Date();
  const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (frequency === 'WEEKLY') {
    return daysDiff >= 1 && daysDiff <= 7;
  } else if (frequency === 'MONTHLY') {
    return daysDiff >= 1 && daysDiff <= 31;
  }
  
  return false;
};

export const validateLoanTerm = (disbursementDate: Date, dueDate: Date): boolean => {
  const daysDiff = Math.ceil((dueDate.getTime() - disbursementDate.getTime()) / (1000 * 60 * 60 * 24));
  // Loan terms should be between 1 day and 2 years
  return daysDiff >= 1 && daysDiff <= 730;
};

export const validateGuarantorAmount = (loanAmount: number, guarantorAmount: number): boolean => {
  // Guarantor amount should not exceed the loan amount
  return guarantorAmount > 0 && guarantorAmount <= loanAmount;
};

// Error formatting helper
export const formatValidationErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return errors;
};