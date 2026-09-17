// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../config/logger';
import { IdentityProtectionService } from '../services/identityProtectionService';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Create test users
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12);

    const founder = await prisma.user.upsert({
      where: { email: 'founder@example.com' },
      update: {},
      create: {
        email: 'founder@example.com',
        phone: '+254700000001',
        ...IdentityProtectionService.protect('12345001'),
        firstName: 'John',
        lastName: 'Founder',
        passwordHash: hashedPassword,
        kycStatus: 'VERIFIED',
      },
    });

    const treasurer = await prisma.user.upsert({
      where: { email: 'treasurer@example.com' },
      update: {},
      create: {
        email: 'treasurer@example.com',
        phone: '+254700000002',
        ...IdentityProtectionService.protect('12345002'),
        firstName: 'Jane',
        lastName: 'Treasurer',
        passwordHash: hashedPassword,
        kycStatus: 'VERIFIED',
      },
    });

    const member1 = await prisma.user.upsert({
      where: { email: 'member1@example.com' },
      update: {},
      create: {
        email: 'member1@example.com',
        phone: '+254700000003',
        ...IdentityProtectionService.protect('12345003'),
        firstName: 'Alice',
        lastName: 'Member',
        passwordHash: hashedPassword,
        kycStatus: 'VERIFIED',
      },
    });

    const member2 = await prisma.user.upsert({
      where: { email: 'member2@example.com' },
      update: {},
      create: {
        email: 'member2@example.com',
        phone: '+254700000004',
        ...IdentityProtectionService.protect('12345004'),
        firstName: 'Bob',
        lastName: 'Member',
        passwordHash: hashedPassword,
        kycStatus: 'VERIFIED',
      },
    });

    logger.info('Created test users');

    // Create test Chamas
    const roscaChama = await prisma.chama.upsert({
      where: { shareableLink: 'rosca-test-chama' },
      update: {},
      create: {
        name: 'ROSCA Test Chama',
        type: 'ROSCA',
        description: 'A test ROSCA chama for development',
        maxMembers: 10,
        contributionAmount: 5000,
        contributionFrequency: 'MONTHLY',
        shareableLink: 'rosca-test-chama',
        qrCode: 'rosca-qr-code',
        settings: {
          roscaSettings: {
            payoutSchedule: [
              { memberId: founder.id, month: 1, completed: false },
              { memberId: treasurer.id, month: 2, completed: false },
              { memberId: member1.id, month: 3, completed: false },
              { memberId: member2.id, month: 4, completed: false },
            ],
            currentPayoutIndex: 0,
          },
        },
      },
    });

    const ascaChama = await prisma.chama.upsert({
      where: { shareableLink: 'asca-test-chama' },
      update: {},
      create: {
        name: 'ASCA Test Chama',
        type: 'ASCA',
        description: 'A test ASCA chama for development',
        maxMembers: 15,
        contributionAmount: 3000,
        contributionFrequency: 'MONTHLY',
        shareableLink: 'asca-test-chama',
        qrCode: 'asca-qr-code',
        settings: {
          ascaSettings: {
            shareOutDate: new Date('2024-12-31'),
            loanInterestRate: 0.05, // 5% monthly
            maxLoanAmount: 50000,
          },
        },
      },
    });

    logger.info('Created test Chamas');

    // Create memberships
    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: roscaChama.id,
          userId: founder.id,
        },
      },
      update: {},
      create: {
        chamaId: roscaChama.id,
        userId: founder.id,
        role: 'FOUNDER',
        status: 'ACTIVE',
        reliabilityScore: 1.0,
      },
    });

    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: roscaChama.id,
          userId: treasurer.id,
        },
      },
      update: {},
      create: {
        chamaId: roscaChama.id,
        userId: treasurer.id,
        role: 'TREASURER',
        status: 'ACTIVE',
        reliabilityScore: 0.95,
      },
    });

    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: roscaChama.id,
          userId: member1.id,
        },
      },
      update: {},
      create: {
        chamaId: roscaChama.id,
        userId: member1.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        reliabilityScore: 0.88,
      },
    });

    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: roscaChama.id,
          userId: member2.id,
        },
      },
      update: {},
      create: {
        chamaId: roscaChama.id,
        userId: member2.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        reliabilityScore: 0.92,
      },
    });

    // Add memberships to ASCA chama
    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: ascaChama.id,
          userId: founder.id,
        },
      },
      update: {},
      create: {
        chamaId: ascaChama.id,
        userId: founder.id,
        role: 'CHAIR',
        status: 'ACTIVE',
        reliabilityScore: 1.0,
      },
    });

    await prisma.chamaMembership.upsert({
      where: {
        chamaId_userId: {
          chamaId: ascaChama.id,
          userId: treasurer.id,
        },
      },
      update: {},
      create: {
        chamaId: ascaChama.id,
        userId: treasurer.id,
        role: 'TREASURER',
        status: 'ACTIVE',
        reliabilityScore: 0.95,
      },
    });

    logger.info('Created test memberships');

    // Create some test contributions
    const currentDate = new Date();
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    await prisma.contribution.create({
      data: {
        chamaId: roscaChama.id,
        memberId: founder.id,
        amount: 5000,
        dueDate: lastMonth,
        paidDate: lastMonth,
        status: 'PAID',
        paymentMethod: 'MPESA',
        transactionRef: 'MP001TEST',
      },
    });

    await prisma.contribution.create({
      data: {
        chamaId: roscaChama.id,
        memberId: treasurer.id,
        amount: 5000,
        dueDate: lastMonth,
        paidDate: lastMonth,
        status: 'PAID',
        paymentMethod: 'MPESA',
        transactionRef: 'MP002TEST',
      },
    });

    logger.info('Created test contributions');

    // Create a test transaction
    await prisma.transaction.create({
      data: {
        chamaId: roscaChama.id,
        type: 'CONTRIBUTION',
        amount: 5000,
        fromMemberId: founder.id,
        reference: 'TXN001TEST',
        idempotencyKey: 'IDEM001TEST',
        status: 'COMPLETED',
        metadata: {
          contributionMonth: lastMonth.toISOString(),
          paymentMethod: 'MPESA',
        },
      },
    });

    logger.info('Created test transaction');

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    logger.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
