import { ContributionService } from '../services/contributionService';
import { prisma } from '../config/database';
import { ContributionStatus, PaymentMethod, MemberRole, MemberStatus, ChamaType } from '@prisma/client';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../middleware/errorHandler';

// Mock the dependencies
jest.mock('../config/database', () => ({
  prisma: {
    chama: {
      findUnique: jest.fn(),
    },
    chamaMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    contribution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../services/notificationService');
jest.mock('../services/backgroundJobService');

describe('ContributionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContributionCycle', () => {
    it('should create contribution cycle for all active members', async () => {
      const chamaId = 'chama-123';
      const createdBy = 'user-treasurer';
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const mockChama = {
        id: chamaId,
        name: 'Test Chama',
        type: ChamaType.ROSCA,
        contributionAmount: 1000,
        currency: 'KES',
        status: 'ACTIVE',
        memberships: [
          { userId: createdBy, role: MemberRole.TREASURER, status: MemberStatus.ACTIVE },
          { userId: 'user-1', role: MemberRole.MEMBER, status: MemberStatus.ACTIVE },
          { userId: 'user-2', role: MemberRole.MEMBER, status: MemberStatus.ACTIVE },
        ],
      };

      const mockContributions = [
        { id: 'contrib-1', chamaId, memberId: createdBy, amount: 1000, dueDate: new Date(dueDate), status: ContributionStatus.PENDING },
        { id: 'contrib-2', chamaId, memberId: 'user-1', amount: 1000, dueDate: new Date(dueDate), status: ContributionStatus.PENDING },
        { id: 'contrib-3', chamaId, memberId: 'user-2', amount: 1000, dueDate: new Date(dueDate), status: ContributionStatus.PENDING },
      ];

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.$transaction as jest.Mock).mockResolvedValue(mockContributions);

      const result = await ContributionService.createContributionCycle(
        { chamaId, dueDate },
        createdBy
      );

      expect(result).toHaveLength(3);
      expect(prisma.chama.findUnique).toHaveBeenCalledWith({
        where: { id: chamaId },
        include: { memberships: { where: { status: MemberStatus.ACTIVE } } },
      });
    });

    it('should throw ForbiddenError if user lacks permission', async () => {
      const chamaId = 'chama-123';
      const createdBy = 'user-member';
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const mockChama = {
        id: chamaId,
        memberships: [
          { userId: createdBy, role: MemberRole.MEMBER, status: MemberStatus.ACTIVE },
        ],
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);

      await expect(
        ContributionService.createContributionCycle({ chamaId, dueDate }, createdBy)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError if chama does not exist', async () => {
      const chamaId = 'nonexistent-chama';
      const createdBy = 'user-treasurer';
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ContributionService.createContributionCycle({ chamaId, dueDate }, createdBy)
      ).rejects.toThrow(NotFoundError);
    });

    it('should use custom amount if provided', async () => {
      const chamaId = 'chama-123';
      const createdBy = 'user-treasurer';
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const customAmount = 2000;

      const mockChama = {
        id: chamaId,
        status: 'ACTIVE',
        contributionAmount: 1000,
        currency: 'KES',
        memberships: [
          { userId: createdBy, role: MemberRole.TREASURER, status: MemberStatus.ACTIVE },
          { userId: 'user-1', role: MemberRole.MEMBER, status: MemberStatus.ACTIVE },
        ],
      };

      const mockContributions = [
        { id: 'contrib-1', chamaId, memberId: createdBy, amount: customAmount, dueDate: new Date(dueDate), status: ContributionStatus.PENDING },
        { id: 'contrib-2', chamaId, memberId: 'user-1', amount: customAmount, dueDate: new Date(dueDate), status: ContributionStatus.PENDING },
      ];

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.$transaction as jest.Mock).mockResolvedValue(mockContributions);

      const result = await ContributionService.createContributionCycle(
        { chamaId, dueDate, amount: customAmount },
        createdBy
      );

      expect(result).toHaveLength(2);
      if (result[0]) {
        expect(result[0].amount).toBe(customAmount);
      }
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update contribution status to PAID', async () => {
      const contributionId = 'contrib-123';
      const recordedBy = 'user-treasurer';
      const amount = 1000;

      const mockContribution = {
        id: contributionId,
        chamaId: 'chama-123',
        memberId: recordedBy,
        amount: 1000,
        penalties: 0,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: ContributionStatus.PENDING,
        chama: { id: 'chama-123', currency: 'KES', name: 'Test Chama' },
        member: { firstName: 'John', lastName: 'Doe' },
      };

      const mockUpdatedContribution = {
        ...mockContribution,
        status: ContributionStatus.PAID,
        paidDate: new Date(),
        paymentMethod: PaymentMethod.MPESA,
      };

      const mockTransaction = {
        id: 'txn-123',
        chamaId: 'chama-123',
        amount,
        status: 'COMPLETED',
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue({
        userId: recordedBy,
        role: MemberRole.TREASURER,
      });
      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue([]); // No treasurers to notify
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue([mockUpdatedContribution, mockTransaction]);

      const result = await ContributionService.recordPayment(
        {
          contributionId,
          amount,
          paymentMethod: PaymentMethod.MPESA,
          transactionRef: 'MPESA-123',
        },
        recordedBy
      );

      expect(result.status).toBe(ContributionStatus.PAID);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle partial payment correctly', async () => {
      const contributionId = 'contrib-123';
      const recordedBy = 'user-treasurer';
      const partialAmount = 500;

      const mockContribution = {
        id: contributionId,
        chamaId: 'chama-123',
        memberId: recordedBy,
        amount: 1000,
        penalties: 0,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: ContributionStatus.PENDING,
        chama: { id: 'chama-123', currency: 'KES', name: 'Test Chama' },
        member: { firstName: 'John', lastName: 'Doe' },
      };

      const mockUpdatedContribution = {
        ...mockContribution,
        status: ContributionStatus.PARTIAL,
        paidDate: new Date(),
        paymentMethod: PaymentMethod.CASH,
      };

      const mockTransaction = {
        id: 'txn-123',
        chamaId: 'chama-123',
        amount: partialAmount,
        status: 'COMPLETED',
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue({
        userId: recordedBy,
        role: MemberRole.TREASURER,
      });
      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue([]); // No treasurers to notify
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue([mockUpdatedContribution, mockTransaction]);

      const result = await ContributionService.recordPayment(
        {
          contributionId,
          amount: partialAmount,
          paymentMethod: PaymentMethod.CASH,
        },
        recordedBy
      );

      expect(result.status).toBe(ContributionStatus.PARTIAL);
    });

    it('should throw ConflictError for duplicate transaction reference', async () => {
      const contributionId = 'contrib-123';
      const recordedBy = 'user-treasurer';
      const transactionRef = 'MPESA-123';

      const mockContribution = {
        id: contributionId,
        chamaId: 'chama-123',
        memberId: recordedBy,
        amount: 1000,
        penalties: 0,
        dueDate: new Date(),
        chama: { id: 'chama-123', currency: 'KES' },
        member: { firstName: 'John', lastName: 'Doe' },
      };

      const mockExistingTransaction = {
        id: 'txn-existing',
        idempotencyKey: transactionRef,
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue({
        userId: recordedBy,
        role: MemberRole.TREASURER,
      });
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockExistingTransaction);

      await expect(
        ContributionService.recordPayment(
          {
            contributionId,
            amount: 1000,
            paymentMethod: PaymentMethod.MPESA,
            transactionRef,
          },
          recordedBy
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should handle multi-currency conversion', async () => {
      const contributionId = 'contrib-123';
      const recordedBy = 'user-treasurer';
      const amount = 100; // USD
      const exchangeRate = 130; // 1 USD = 130 KES

      const mockContribution = {
        id: contributionId,
        chamaId: 'chama-123',
        memberId: recordedBy,
        amount: 13000, // KES
        penalties: 0,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: ContributionStatus.PENDING,
        chama: { id: 'chama-123', currency: 'KES', name: 'Test Chama' },
        member: { firstName: 'John', lastName: 'Doe' },
      };

      const mockUpdatedContribution = {
        ...mockContribution,
        status: ContributionStatus.PAID,
        paidDate: new Date(),
        paymentMethod: PaymentMethod.BANK,
      };

      const mockTransaction = {
        id: 'txn-123',
        chamaId: 'chama-123',
        amount: 13000,
        status: 'COMPLETED',
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue({
        userId: recordedBy,
        role: MemberRole.TREASURER,
      });
      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue([]); // No treasurers to notify
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue([mockUpdatedContribution, mockTransaction]);

      const result = await ContributionService.recordPayment(
        {
          contributionId,
          amount,
          paymentMethod: PaymentMethod.BANK,
          currency: 'USD',
          exchangeRate,
        },
        recordedBy
      );

      expect(result.status).toBe(ContributionStatus.PAID);
    });

    it('should throw BadRequestError if exchange rate missing for currency conversion', async () => {
      const contributionId = 'contrib-123';
      const recordedBy = 'user-treasurer';

      const mockContribution = {
        id: contributionId,
        chamaId: 'chama-123',
        memberId: recordedBy,
        amount: 1000,
        penalties: 0,
        dueDate: new Date(),
        chama: { id: 'chama-123', currency: 'KES' },
        member: { firstName: 'John', lastName: 'Doe' },
      };

      (prisma.contribution.findUnique as jest.Mock).mockResolvedValue(mockContribution);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue({
        userId: recordedBy,
        role: MemberRole.TREASURER,
      });

      await expect(
        ContributionService.recordPayment(
          {
            contributionId,
            amount: 100,
            paymentMethod: PaymentMethod.BANK,
            currency: 'USD',
            // exchangeRate missing
          },
          recordedBy
        )
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getContributions', () => {
    it('should return contributions with pagination', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-123';

      const mockMembership = {
        userId,
        chamaId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      };

      const mockContributions = [
        {
          id: 'contrib-1',
          chamaId,
          memberId: userId,
          amount: 1000,
          status: ContributionStatus.PAID,
          chama: { id: chamaId, name: 'Test Chama', currency: 'KES' },
          member: { id: userId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        },
        {
          id: 'contrib-2',
          chamaId,
          memberId: userId,
          amount: 1000,
          status: ContributionStatus.PENDING,
          chama: { id: chamaId, name: 'Test Chama', currency: 'KES' },
          member: { id: userId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        },
      ];

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (prisma.contribution.count as jest.Mock).mockResolvedValue(2);

      const result = await ContributionService.getContributions(
        { chamaId, page: 1, limit: 50 },
        userId
      );

      expect(result.contributions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should throw ForbiddenError if user not a member', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-123';

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ContributionService.getContributions({ chamaId, page: 1, limit: 50 }, userId)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getContributionSummary', () => {
    it('should return contribution summary for a member', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-123';

      const mockMembership = {
        userId,
        chamaId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.contribution.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // paid
        .mockResolvedValueOnce(2)  // pending
        .mockResolvedValueOnce(1); // overdue
      (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 10000, penalties: 100 },
      });

      const result = await ContributionService.getContributionSummary(
        { chamaId, memberId: userId },
        userId
      );

      expect(result.totalContributions).toBe(10);
      expect(result.totalPaid).toBe(7);
      expect(result.totalPending).toBe(2);
      expect(result.totalOverdue).toBe(1);
      expect(result.totalPenalties).toBe(100);
      expect(result.contributionRate).toBe(70);
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency with provided exchange rate', async () => {
      const result = await ContributionService.convertCurrency({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'KES',
        exchangeRate: 130,
      });

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedAmount).toBe(13000);
      expect(result.convertedCurrency).toBe('KES');
      expect(result.exchangeRate).toBe(130);
    });

    it('should throw BadRequestError if exchange rate not provided', async () => {
      await expect(
        ContributionService.convertCurrency({
          amount: 100,
          fromCurrency: 'USD',
          toCurrency: 'KES',
        })
      ).rejects.toThrow(BadRequestError);
    });
  });
});


