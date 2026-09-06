import {
  validateEmail,
  validateKenyanPhoneNumber,
  normalizeKenyanPhoneNumber,
  validateMpesaTransactionId,
  validateKenyanNationalId,
  formatValidationErrors,
} from './validation';
import { z } from 'zod';

describe('Validation Utilities', () => {
  describe('Email validation', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.ke')).toBe(true);
      expect(validateEmail('admin@chama.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('Phone number validation', () => {
    it('should validate Kenyan phone numbers', () => {
      expect(validateKenyanPhoneNumber('+254700123456')).toBe(true);
      expect(validateKenyanPhoneNumber('+254710123456')).toBe(true);
      expect(validateKenyanPhoneNumber('0700123456')).toBe(true);
      expect(validateKenyanPhoneNumber('0110123456')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validateKenyanPhoneNumber('+254800123456')).toBe(false); // Invalid prefix
      expect(validateKenyanPhoneNumber('0800123456')).toBe(false); // Invalid prefix
      expect(validateKenyanPhoneNumber('+25470012345')).toBe(false); // Too short
      expect(validateKenyanPhoneNumber('+2547001234567')).toBe(false); // Too long
    });

    it('should normalize phone numbers correctly', () => {
      expect(normalizeKenyanPhoneNumber('0700123456')).toBe('+254700123456');
      expect(normalizeKenyanPhoneNumber('0110123456')).toBe('+254110123456');
      expect(normalizeKenyanPhoneNumber('+254700123456')).toBe('+254700123456');
    });
  });

  describe('National ID validation', () => {
    it('should validate Kenyan national IDs', () => {
      expect(validateKenyanNationalId('12345678')).toBe(true);
      expect(validateKenyanNationalId('87654321')).toBe(true);
    });

    it('should reject invalid national IDs', () => {
      expect(validateKenyanNationalId('1234567')).toBe(false); // Too short
      expect(validateKenyanNationalId('123456789')).toBe(false); // Too long
      expect(validateKenyanNationalId('1234567a')).toBe(false); // Contains letters
      expect(validateKenyanNationalId('')).toBe(false); // Empty
    });
  });

  describe('M-Pesa transaction ID validation', () => {
    it('should validate M-Pesa transaction IDs', () => {
      expect(validateMpesaTransactionId('QGH1234567')).toBe(true);
      expect(validateMpesaTransactionId('ABC1234567')).toBe(true);
      expect(validateMpesaTransactionId('1234567890')).toBe(true);
    });

    it('should reject invalid M-Pesa transaction IDs', () => {
      expect(validateMpesaTransactionId('QGH123456')).toBe(false); // Too short
      expect(validateMpesaTransactionId('QGH12345678')).toBe(false); // Too long
      expect(validateMpesaTransactionId('qgh1234567')).toBe(false); // Lowercase
      expect(validateMpesaTransactionId('QGH123456!')).toBe(false); // Special chars
    });
  });

  describe('Error formatting', () => {
    it('should format Zod validation errors correctly', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      try {
        schema.parse({ email: 'invalid', age: 15 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatValidationErrors(error);
          expect(formatted).toHaveProperty('email');
          expect(formatted).toHaveProperty('age');
          expect(formatted.email).toContain('email');
          expect(formatted.age).toContain('18');
        }
      }
    });
  });
});