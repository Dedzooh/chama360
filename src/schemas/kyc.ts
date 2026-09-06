/**
 * KYC (Know Your Customer) Validation Schemas
 * 
 * This file defines comprehensive KYC validation schemas for user registration
 * and profile management, ensuring regulatory compliance and data integrity.
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { z } from 'zod';

// Country-specific validation patterns
const COUNTRY_PATTERNS = {
  KE: {
    nationalId: /^\d{8}$/, // Kenyan National ID (8 digits)
    phone: /^\+254[17]\d{8}$/, // Kenyan mobile numbers
  },
  UG: {
    nationalId: /^[A-Z]{2}\d{8}[A-Z]$/, // Ugandan National ID
    phone: /^\+256[37]\d{8}$/, // Ugandan mobile numbers
  },
  TZ: {
    nationalId: /^\d{8}-\d{5}-\d{5}$/, // Tanzanian National ID
    phone: /^\+255[67]\d{8}$/, // Tanzanian mobile numbers
  },
  RW: {
    nationalId: /^\d{16}$/, // Rwandan National ID (16 digits)
    phone: /^\+250[78]\d{8}$/, // Rwandan mobile numbers
  },
} as const;

// Document types for KYC verification
export const documentTypeSchema = z.enum([
  'NATIONAL_ID',
  'PASSPORT',
  'DRIVING_LICENSE',
  'VOTER_ID',
  'BIRTH_CERTIFICATE',
  'UTILITY_BILL',
  'BANK_STATEMENT',
  'EMPLOYMENT_LETTER',
]);

// Gender validation
export const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

// Marital status validation
export const maritalStatusSchema = z.enum([
  'SINGLE',
  'MARRIED',
  'DIVORCED',
  'WIDOWED',
  'SEPARATED',
  'PREFER_NOT_TO_SAY',
]);

// Employment status validation
export const employmentStatusSchema = z.enum([
  'EMPLOYED',
  'SELF_EMPLOYED',
  'UNEMPLOYED',
  'STUDENT',
  'RETIRED',
  'HOMEMAKER',
  'OTHER',
]);

// Income range validation (in local currency)
export const incomeRangeSchema = z.enum([
  'BELOW_10K',
  '10K_25K',
  '25K_50K',
  '50K_100K',
  '100K_250K',
  '250K_500K',
  'ABOVE_500K',
  'PREFER_NOT_TO_SAY',
]);

// Country code validation
export const countryCodeSchema = z.enum(['KE', 'UG', 'TZ', 'RW']);

// Address validation schema
export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required').max(100, 'Street address too long'),
  city: z.string().min(1, 'City is required').max(50, 'City name too long'),
  state: z.string().min(1, 'State/Province is required').max(50, 'State name too long'),
  postalCode: z.string().min(3, 'Postal code is required').max(10, 'Postal code too long'),
  country: countryCodeSchema,
});

// Next of kin validation schema
export const nextOfKinSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  relationship: z.string().min(1, 'Relationship is required').max(30, 'Relationship too long'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  email: z.string().email('Invalid email format').optional(),
  address: addressSchema.optional(),
});

// Document upload validation schema
export const documentUploadSchema = z.object({
  type: documentTypeSchema,
  frontImage: z.string().min(1, 'Front image is required'), // Base64 or file path
  backImage: z.string().optional(), // For documents with back side
  documentNumber: z.string().min(1, 'Document number is required').max(50, 'Document number too long'),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
  issuingAuthority: z.string().max(100, 'Issuing authority name too long').optional(),
}).refine((data) => {
  // Validate expiry date is in the future for documents that expire
  if (data.expiryDate && data.expiryDate <= new Date()) {
    return false;
  }
  return true;
}, {
  message: 'Document expiry date must be in the future',
  path: ['expiryDate'],
});

// Phone verification schema
export const phoneVerificationSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  verificationCode: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

// Email verification schema
export const emailVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
  verificationCode: z.string().regex(/^[A-Za-z0-9]{6,8}$/, 'Invalid verification code format'),
});

// Comprehensive KYC data collection schema
export const kycDataSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  middleName: z.string().max(50, 'Middle name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  dateOfBirth: z.date().refine((date) => {
    const age = new Date().getFullYear() - date.getFullYear();
    return age >= 18 && age <= 120;
  }, {
    message: 'Must be between 18 and 120 years old',
  }),
  gender: genderSchema,
  maritalStatus: maritalStatusSchema,
  nationality: countryCodeSchema,
  
  // Contact Information
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  alternativePhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  
  // Address Information
  currentAddress: addressSchema,
  permanentAddress: addressSchema.optional(),
  sameAsCurrent: z.boolean().default(false),
  
  // Identity Documents
  nationalId: z.string().min(5, 'National ID is required').max(20, 'National ID too long'),
  passportNumber: z.string().max(20, 'Passport number too long').optional(),
  
  // Employment and Financial Information
  employmentStatus: employmentStatusSchema,
  employer: z.string().max(100, 'Employer name too long').optional(),
  occupation: z.string().max(50, 'Occupation too long').optional(),
  monthlyIncome: incomeRangeSchema,
  sourceOfIncome: z.string().max(100, 'Source of income too long').optional(),
  
  // Emergency Contact
  nextOfKin: nextOfKinSchema,
  
  // Document Uploads
  documents: z.array(documentUploadSchema).min(1, 'At least one identity document is required'),
  
  // Compliance and Consent
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
  consentDataProcessing: z.boolean().refine(val => val === true, {
    message: 'You must consent to data processing',
  }),
  consentCreditCheck: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
}).refine((data) => {
  // If permanent address is not provided, use current address
  if (!data.permanentAddress && data.sameAsCurrent) {
    return true;
  }
  return true;
}, {
  message: 'Address information is required',
});

// KYC update schema (for profile updates)
export const kycUpdateSchema = z.object({
  // Personal Information (limited updates allowed)
  middleName: z.string().max(50, 'Middle name too long').optional(),
  maritalStatus: maritalStatusSchema.optional(),
  
  // Contact Information
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  alternativePhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  
  // Address Information
  currentAddress: addressSchema.optional(),
  permanentAddress: addressSchema.optional(),
  
  // Employment and Financial Information
  employmentStatus: employmentStatusSchema.optional(),
  employer: z.string().max(100, 'Employer name too long').optional(),
  occupation: z.string().max(50, 'Occupation too long').optional(),
  monthlyIncome: incomeRangeSchema.optional(),
  sourceOfIncome: z.string().max(100, 'Source of income too long').optional(),
  
  // Emergency Contact
  nextOfKin: nextOfKinSchema.optional(),
  
  // Additional Documents (for re-verification)
  additionalDocuments: z.array(documentUploadSchema).optional(),
  
  // Consent Updates
  consentCreditCheck: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
}).refine((data) => {
  // At least one field must be provided for update
  return Object.keys(data).length > 0;
}, {
  message: 'At least one field must be provided for update',
});

// KYC verification status schema
export const kycVerificationSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']),
  verifiedAt: z.date().optional(),
  verifiedBy: z.string().cuid().optional(),
  rejectionReason: z.string().max(500, 'Rejection reason too long').optional(),
  requiredDocuments: z.array(documentTypeSchema).optional(),
  expiryDate: z.date().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  complianceNotes: z.string().max(1000, 'Compliance notes too long').optional(),
});

// Country-specific validation function
export const validateCountrySpecificData = (data: {
  nationalId: string;
  phone: string;
  country: string;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const countryCode = data.country as keyof typeof COUNTRY_PATTERNS;
  
  if (!COUNTRY_PATTERNS[countryCode]) {
    errors.push(`Unsupported country: ${data.country}`);
    return { isValid: false, errors };
  }
  
  const patterns = COUNTRY_PATTERNS[countryCode];
  
  // Validate National ID format
  if (!patterns.nationalId.test(data.nationalId)) {
    errors.push(`Invalid National ID format for ${data.country}`);
  }
  
  // Validate phone number format
  if (!patterns.phone.test(data.phone)) {
    errors.push(`Invalid phone number format for ${data.country}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Document validation helper
export const validateDocumentRequirements = (
  documents: Array<{ type: string }>,
  country: string
): { isValid: boolean; missingDocuments: string[] } => {
  const requiredDocs = ['NATIONAL_ID']; // Minimum requirement
  const providedTypes = documents.map(doc => doc.type);
  const missingDocuments = requiredDocs.filter(req => !providedTypes.includes(req));
  
  // Country-specific requirements
  if (country === 'KE' && !providedTypes.includes('NATIONAL_ID')) {
    missingDocuments.push('NATIONAL_ID');
  }
  
  return {
    isValid: missingDocuments.length === 0,
    missingDocuments,
  };
};

// Risk assessment helper
export const assessKycRisk = (data: any): 'LOW' | 'MEDIUM' | 'HIGH' => {
  let riskScore = 0;
  
  // Age-based risk
  const age = new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear();
  if (age < 21 || age > 65) riskScore += 1;
  
  // Employment status risk
  if (['UNEMPLOYED', 'OTHER'].includes(data.employmentStatus)) riskScore += 2;
  
  // Income risk
  if (['BELOW_10K', 'PREFER_NOT_TO_SAY'].includes(data.monthlyIncome)) riskScore += 1;
  
  // Document completeness
  if (data.documents.length < 2) riskScore += 1;
  
  // Return risk level
  if (riskScore >= 4) return 'HIGH';
  if (riskScore >= 2) return 'MEDIUM';
  return 'LOW';
};

// Export type definitions
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Gender = z.infer<typeof genderSchema>;
export type MaritalStatus = z.infer<typeof maritalStatusSchema>;
export type EmploymentStatus = z.infer<typeof employmentStatusSchema>;
export type IncomeRange = z.infer<typeof incomeRangeSchema>;
export type CountryCode = z.infer<typeof countryCodeSchema>;
export type Address = z.infer<typeof addressSchema>;
export type NextOfKin = z.infer<typeof nextOfKinSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type PhoneVerification = z.infer<typeof phoneVerificationSchema>;
export type EmailVerification = z.infer<typeof emailVerificationSchema>;
export type KycData = z.infer<typeof kycDataSchema>;
export type KycUpdate = z.infer<typeof kycUpdateSchema>;
export type KycVerification = z.infer<typeof kycVerificationSchema>;

// Export all schemas
export const kycSchemas = {
  documentType: documentTypeSchema,
  gender: genderSchema,
  maritalStatus: maritalStatusSchema,
  employmentStatus: employmentStatusSchema,
  incomeRange: incomeRangeSchema,
  countryCode: countryCodeSchema,
  address: addressSchema,
  nextOfKin: nextOfKinSchema,
  documentUpload: documentUploadSchema,
  phoneVerification: phoneVerificationSchema,
  emailVerification: emailVerificationSchema,
  kycData: kycDataSchema,
  kycUpdate: kycUpdateSchema,
  kycVerification: kycVerificationSchema,
};