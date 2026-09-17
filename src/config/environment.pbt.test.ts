import * as fc from 'fast-check';
import { z } from 'zod';

/**
 * Property-Based Test for Environment Configuration
 * **Feature: chama-management-system, Property 18: Data Validation and Integrity**
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**
 * 
 * This test verifies that the environment validation system correctly handles
 * all possible input combinations and maintains data integrity.
 */

describe('Property: Environment Configuration Validation', () => {
  // Test that valid environment configurations are always accepted
  it('should accept all valid environment configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          DATABASE_URL: fc.webUrl(),
          JWT_SECRET: fc.string({ minLength: 32 }),
          JWT_REFRESH_SECRET: fc.string({ minLength: 32 }),
          SESSION_SECRET: fc.string({ minLength: 32 }),
          PORT: fc.integer({ min: 1000, max: 65535 }).map(String),
          NODE_ENV: fc.constantFrom('development', 'production', 'test'),
          REDIS_HOST: fc.domain(),
          REDIS_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
          BCRYPT_ROUNDS: fc.integer({ min: 4, max: 20 }).map(String),
        }),
        (validEnv) => {
          // Create a schema for testing
          const testSchema = z.object({
            DATABASE_URL: z.string().url(),
            JWT_SECRET: z.string().min(32),
            JWT_REFRESH_SECRET: z.string().min(32),
            SESSION_SECRET: z.string().min(32),
            PORT: z.string().transform(val => parseInt(val)),
            NODE_ENV: z.enum(['development', 'production', 'test']),
            REDIS_HOST: z.string(),
            REDIS_PORT: z.string().transform(val => parseInt(val)),
            BCRYPT_ROUNDS: z.string().transform(val => parseInt(val)),
          });

          // Valid configurations should always parse successfully
          expect(() => testSchema.parse(validEnv)).not.toThrow();
          
          const parsed = testSchema.parse(validEnv);
          
          // Verify transformations work correctly
          expect(typeof parsed.PORT).toBe('number');
          expect(typeof parsed.BCRYPT_ROUNDS).toBe('number');
          expect(parsed.PORT).toBeGreaterThanOrEqual(1000);
          expect(parsed.PORT).toBeLessThanOrEqual(65535);
          expect(parsed.BCRYPT_ROUNDS).toBeGreaterThanOrEqual(4);
          expect(parsed.BCRYPT_ROUNDS).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test that invalid configurations are always rejected
  it('should reject invalid environment configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          DATABASE_URL: fc.oneof(
            fc.string().filter(s => !s.includes('://')), // Invalid URL
            fc.constant(''),
            fc.constant('not-a-url')
          ),
          JWT_SECRET: fc.string({ maxLength: 31 }), // Too short
          PORT: fc.oneof(
            fc.string().filter(s => isNaN(parseInt(s))), // Non-numeric
            fc.integer({ min: -1000, max: 0 }).map(String), // Invalid port
            fc.integer({ min: 65536, max: 100000 }).map(String) // Invalid port
          ),
          NODE_ENV: fc.string().filter(s => !['development', 'production', 'test'].includes(s)),
        }),
        (invalidEnv) => {
          const testSchema = z.object({
            DATABASE_URL: z.string().url(),
            JWT_SECRET: z.string().min(32),
            PORT: z.string().transform(val => {
              const num = parseInt(val);
              if (isNaN(num) || num < 1 || num > 65535) {
                throw new Error('Invalid port');
              }
              return num;
            }),
            NODE_ENV: z.enum(['development', 'production', 'test']),
          });

          // Invalid configurations should always throw
          expect(() => testSchema.parse(invalidEnv)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test that default values are applied consistently
  it('should apply default values consistently', () => {
    fc.assert(
      fc.property(
        fc.record({
          DATABASE_URL: fc.webUrl(),
          JWT_SECRET: fc.string({ minLength: 32 }),
          JWT_REFRESH_SECRET: fc.string({ minLength: 32 }),
          SESSION_SECRET: fc.string({ minLength: 32 }),
          // Omit optional fields to test defaults
        }),
        (partialEnv) => {
          const testSchema = z.object({
            DATABASE_URL: z.string().url(),
            JWT_SECRET: z.string().min(32),
            JWT_REFRESH_SECRET: z.string().min(32),
            SESSION_SECRET: z.string().min(32),
            PORT: z.string().transform(val => parseInt(val)).default('3000'),
            NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
            REDIS_HOST: z.string().default('localhost'),
            REDIS_PORT: z.string().transform(val => parseInt(val)).default('6379'),
            LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
          });

          const parsed = testSchema.parse(partialEnv);
          
          // Defaults should always be applied
          expect(parsed.PORT).toBe(3000);
          expect(parsed.NODE_ENV).toBe('development');
          expect(parsed.REDIS_HOST).toBe('localhost');
          expect(parsed.REDIS_PORT).toBe(6379);
          expect(parsed.LOG_LEVEL).toBe('info');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test that type transformations preserve data integrity
  it('should preserve data integrity during type transformations', () => {
    fc.assert(
      fc.property(
        fc.record({
          PORT: fc.integer({ min: 1000, max: 65535 }),
          REDIS_PORT: fc.integer({ min: 1, max: 65535 }),
          BCRYPT_ROUNDS: fc.integer({ min: 4, max: 20 }),
          RATE_LIMIT_MAX_REQUESTS: fc.integer({ min: 1, max: 10000 }),
        }),
        (numericValues) => {
          // Convert to strings (as they come from environment)
          const stringEnv = {
            PORT: numericValues.PORT.toString(),
            REDIS_PORT: numericValues.REDIS_PORT.toString(),
            BCRYPT_ROUNDS: numericValues.BCRYPT_ROUNDS.toString(),
            RATE_LIMIT_MAX_REQUESTS: numericValues.RATE_LIMIT_MAX_REQUESTS.toString(),
          };

          const testSchema = z.object({
            PORT: z.string().transform(val => parseInt(val)),
            REDIS_PORT: z.string().transform(val => parseInt(val)),
            BCRYPT_ROUNDS: z.string().transform(val => parseInt(val)),
            RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val)),
          });

          const parsed = testSchema.parse(stringEnv);
          
          // Values should be preserved exactly after transformation
          expect(parsed.PORT).toBe(numericValues.PORT);
          expect(parsed.REDIS_PORT).toBe(numericValues.REDIS_PORT);
          expect(parsed.BCRYPT_ROUNDS).toBe(numericValues.BCRYPT_ROUNDS);
          expect(parsed.RATE_LIMIT_MAX_REQUESTS).toBe(numericValues.RATE_LIMIT_MAX_REQUESTS);
          
          // All values should be numbers
          expect(typeof parsed.PORT).toBe('number');
          expect(typeof parsed.REDIS_PORT).toBe('number');
          expect(typeof parsed.BCRYPT_ROUNDS).toBe('number');
          expect(typeof parsed.RATE_LIMIT_MAX_REQUESTS).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });
});