import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { config } from '../src/config/environment';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is required. Tests will never fall back to the application database.');
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL.');
}

// Test database setup
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});

// Test Redis setup
export const testRedis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: 15, // Use a different database for tests
  lazyConnect: true,
});

// Global test setup
beforeAll(async () => {
  // Connect to test database
  await testPrisma.$connect();
  
  // Connect to test Redis
  await testRedis.connect();
  
  // Clear test database
  await clearDatabase();
  
  // Clear test Redis
  await testRedis.flushdb();
});

// Global test teardown
afterAll(async () => {
  // Clear test data
  await clearDatabase();
  await testRedis.flushdb();
  
  // Disconnect from services
  await testPrisma.$disconnect();
  await testRedis.quit();
});

// Clear database between tests
beforeEach(async () => {
  await clearDatabase();
  await testRedis.flushdb();
});

// Helper function to clear database
async function clearDatabase() {
  const tablenames = await testPrisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  try {
    await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }
}

// Test utilities
export const createTestUser = async (overrides: any = {}) => {
  return await testPrisma.user.create({
    data: {
      email: 'test@example.com',
      phone: '+254700000000',
      nationalId: '12345678',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hashedpassword',
      kycStatus: 'VERIFIED',
      ...overrides,
    },
  });
};

export const createTestChama = async (overrides: any = {}) => {
  return await testPrisma.chama.create({
    data: {
      name: 'Test Chama',
      type: 'ROSCA',
      description: 'A test chama for unit testing',
      maxMembers: 10,
      contributionAmount: 1000,
      contributionFrequency: 'MONTHLY',
      shareableLink: 'test-chama-link',
      qrCode: 'test-qr-code',
      settings: {},
      ...overrides,
    },
  });
};

export const createTestMembership = async (userId: string, chamaId: string, overrides: any = {}) => {
  return await testPrisma.chamaMembership.create({
    data: {
      userId,
      chamaId,
      role: 'MEMBER',
      status: 'ACTIVE',
      ...overrides,
    },
  });
};

// Mock external services for testing
export const mockMpesaService = {
  processPayment: jest.fn(),
  verifyPayment: jest.fn(),
  getTransactionStatus: jest.fn(),
};

export const mockSmsService = {
  sendSms: jest.fn(),
  sendBulkSms: jest.fn(),
};

export const mockEmailService = {
  sendEmail: jest.fn(),
  sendBulkEmail: jest.fn(),
};

export const mockKycService = {
  verifyIdentity: jest.fn(),
  getVerificationStatus: jest.fn(),
};

// Property-based testing utilities
export const generateValidUser = () => ({
  email: `test${Math.random().toString(36).substr(2, 9)}@example.com`,
  phone: `+25470${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
  nationalId: Math.floor(Math.random() * 100000000).toString(),
  firstName: 'Test',
  lastName: 'User',
  passwordHash: 'hashedpassword',
});

export const generateValidChama = () => ({
  name: `Test Chama ${Math.random().toString(36).substr(2, 9)}`,
  type: ['ROSCA', 'ASCA', 'NORMAL'][Math.floor(Math.random() * 3)] as any,
  description: 'A test chama',
  maxMembers: Math.floor(Math.random() * 50) + 5,
  contributionAmount: Math.floor(Math.random() * 10000) + 100,
  contributionFrequency: ['WEEKLY', 'MONTHLY'][Math.floor(Math.random() * 2)] as any,
  shareableLink: `test-link-${Math.random().toString(36).substr(2, 9)}`,
  qrCode: `test-qr-${Math.random().toString(36).substr(2, 9)}`,
  settings: {},
});

// Jest configuration for property-based tests
export const propertyTestConfig = {
  numRuns: 100, // Minimum 100 iterations as specified in design
  timeout: 30000, // 30 second timeout for property tests
  verbose: true,
};
