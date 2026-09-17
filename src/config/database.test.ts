import { prisma } from './database';

describe('Database Configuration', () => {
  it('should connect to the database successfully', async () => {
    // Test database connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should have proper Prisma client configuration', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
    expect(typeof prisma.$queryRaw).toBe('function');
  });
});

describe('Database Models', () => {
  it('should have all required models available', () => {
    // Check that all main models are available
    expect(prisma.user).toBeDefined();
    expect(prisma.chama).toBeDefined();
    expect(prisma.chamaMembership).toBeDefined();
    expect(prisma.contribution).toBeDefined();
    expect(prisma.loan).toBeDefined();
    expect(prisma.transaction).toBeDefined();
    expect(prisma.dispute).toBeDefined();
    expect(prisma.vote).toBeDefined();
    expect(prisma.notification).toBeDefined();
  });
});