/**
 * Unit tests for Chama Discovery and Public Directory
 * Task 5.2: Implement Chama discovery and public directory
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { ChamaService } from '../services/chamaService';
import { prisma } from '../config/database';
import { ChamaType, Frequency, Visibility } from '@prisma/client';

// Mock Prisma client
jest.mock('../config/database', () => ({
  prisma: {
    chama: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    chamaMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    contribution: {
      count: jest.fn(),
    },
    loan: {
      count: jest.fn(),
    },
  },
}));

// Mock notification service
jest.mock('../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock background job service
jest.mock('../services/backgroundJobService', () => ({
  BackgroundJobService: jest.fn().mockImplementation(() => ({
    createJob: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ChamaService - Discovery and Public Directory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublicChamas - Advanced Filtering', () => {
    it('should return public chamas with basic pagination', async () => {
      const mockChamas = [
        {
          id: 'chama_1',
          name: 'Test Chama 1',
          type: ChamaType.ROSCA,
          description: 'Test description',
          maxMembers: 20,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link1',
          qrCode: 'qr1',
          createdAt: new Date(),
          _count: { memberships: 10, contributions: 50 },
          memberships: [],
        },
      ];

      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockChamas);
      (prisma.chama.count as jest.Mock).mockResolvedValue(1);
      
      // Mock success metrics calculation
      (prisma.contribution.count as jest.Mock).mockResolvedValue(50);
      (prisma.loan.count as jest.Mock).mockResolvedValue(5);
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(10);
      (prisma.chamaMembership.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reliabilityScore: 75 },
      });

      const result = await ChamaService.getPublicChamas(1, 20);

      expect(result.chamas).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter chamas by type', async () => {
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chama.count as jest.Mock).mockResolvedValue(0);

      await ChamaService.getPublicChamas(1, 20, {
        type: ChamaType.ASCA,
      });

      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: ChamaType.ASCA,
          }),
        })
      );
    });

    it('should filter chamas by contribution amount range', async () => {
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chama.count as jest.Mock).mockResolvedValue(0);

      await ChamaService.getPublicChamas(1, 20, {
        minContribution: 500,
        maxContribution: 2000,
      });

      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contributionAmount: {
              gte: 500,
              lte: 2000,
            },
          }),
        })
      );
    });

    it('should filter chamas by frequency', async () => {
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chama.count as jest.Mock).mockResolvedValue(0);

      await ChamaService.getPublicChamas(1, 20, {
        frequency: Frequency.WEEKLY,
      });

      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contributionFrequency: Frequency.WEEKLY,
          }),
        })
      );
    });

    it('should search chamas by name or description', async () => {
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chama.count as jest.Mock).mockResolvedValue(0);

      await ChamaService.getPublicChamas(1, 20, {
        search: 'savings',
      });

      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'savings', mode: 'insensitive' } },
              { description: { contains: 'savings', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should include success metrics for each chama', async () => {
      const mockChamas = [
        {
          id: 'chama_1',
          name: 'Test Chama',
          type: ChamaType.ROSCA,
          description: 'Test',
          maxMembers: 20,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link1',
          qrCode: 'qr1',
          createdAt: new Date(),
          _count: { memberships: 10, contributions: 50 },
          memberships: [],
        },
      ];

      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockChamas);
      (prisma.chama.count as jest.Mock).mockResolvedValue(1);
      (prisma.contribution.count as jest.Mock)
        .mockResolvedValueOnce(50) // total contributions
        .mockResolvedValueOnce(45); // on-time contributions
      (prisma.loan.count as jest.Mock)
        .mockResolvedValueOnce(2) // active loans
        .mockResolvedValueOnce(8); // completed loans
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(10);
      (prisma.chamaMembership.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reliabilityScore: 80 },
      });

      const result = await ChamaService.getPublicChamas(1, 20);

      expect(result.chamas).toHaveLength(1);
      expect(result.chamas.length).toBeGreaterThan(0);
      if (result.chamas[0]) {
        expect(result.chamas[0].successMetrics).toBeDefined();
        expect(result.chamas[0].successMetrics.memberCount).toBe(10);
        expect(result.chamas[0].successMetrics.contributionSuccessRate).toBeGreaterThan(0);
        expect(result.chamas[0].availableSlots).toBe(10); // 20 max - 10 current
      }
    });
  });

  describe('calculateChamaSuccessMetrics', () => {
    it('should calculate success metrics correctly', async () => {
      (prisma.contribution.count as jest.Mock)
        .mockResolvedValueOnce(100) // total contributions
        .mockResolvedValueOnce(90); // on-time contributions
      (prisma.loan.count as jest.Mock)
        .mockResolvedValueOnce(5) // active loans
        .mockResolvedValueOnce(15); // completed loans
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(20);
      (prisma.chamaMembership.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reliabilityScore: 85.5 },
      });

      const metrics = await ChamaService.calculateChamaSuccessMetrics('chama_1');

      expect(metrics.memberCount).toBe(20);
      expect(metrics.contributionSuccessRate).toBe(90); // 90/100 * 100
      expect(metrics.loanRepaymentRate).toBe(75); // 15/(5+15) * 100
      expect(metrics.avgReliabilityScore).toBe(85.5);
      expect(metrics.totalContributions).toBe(100);
      expect(metrics.activeLoans).toBe(5);
    });

    it('should handle zero contributions gracefully', async () => {
      (prisma.contribution.count as jest.Mock).mockResolvedValue(0);
      (prisma.loan.count as jest.Mock).mockResolvedValue(0);
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(5);
      (prisma.chamaMembership.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reliabilityScore: null },
      });

      const metrics = await ChamaService.calculateChamaSuccessMetrics('chama_1');

      expect(metrics.contributionSuccessRate).toBe(0);
      expect(metrics.loanRepaymentRate).toBe(0);
      expect(metrics.avgReliabilityScore).toBe(0);
    });
  });

  describe('getRecommendedChamas', () => {
    it('should return recommendations based on user preferences', async () => {
      const mockUserMemberships = [
        {
          chamaId: 'chama_1',
          userId: 'user_1',
          chama: {
            id: 'chama_1',
            type: ChamaType.ROSCA,
            contributionAmount: 1000,
            contributionFrequency: Frequency.MONTHLY,
          },
        },
      ];

      const mockRecommendedChamas = [
        {
          id: 'chama_2',
          name: 'Recommended Chama',
          type: ChamaType.ROSCA,
          description: 'Similar to your groups',
          maxMembers: 20,
          contributionAmount: 1200,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link2',
          qrCode: 'qr2',
          createdAt: new Date(),
          _count: { memberships: 8, contributions: 40 },
          memberships: [],
        },
      ];

      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue(mockUserMemberships);
      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockRecommendedChamas);
      (prisma.contribution.count as jest.Mock).mockResolvedValue(40);
      (prisma.loan.count as jest.Mock).mockResolvedValue(3);
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(8);
      (prisma.chamaMembership.aggregate as jest.Mock).mockResolvedValue({
        _avg: { reliabilityScore: 75 },
      });

      const recommendations = await ChamaService.getRecommendedChamas('user_1', 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations.length).toBeGreaterThan(0);
      if (recommendations[0]) {
        expect(recommendations[0].matchScore).toBeGreaterThan(0);
        expect(recommendations[0].recommendationReason).toBeDefined();
      }
      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [ChamaType.ROSCA] },
            id: { notIn: ['chama_1'] }, // Exclude existing memberships
          }),
        })
      );
    });

    it('should filter by similar contribution amounts', async () => {
      const mockUserMemberships = [
        {
          chamaId: 'chama_1',
          userId: 'user_1',
          chama: {
            id: 'chama_1',
            type: ChamaType.ASCA,
            contributionAmount: 2000,
            contributionFrequency: Frequency.WEEKLY,
          },
        },
      ];

      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue(mockUserMemberships);
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);

      await ChamaService.getRecommendedChamas('user_1', 10);

      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contributionAmount: {
              gte: 1000, // 2000 * 0.5
              lte: 3000, // 2000 * 1.5
            },
          }),
        })
      );
    });

    it('should handle users with no existing memberships', async () => {
      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.chama.findMany as jest.Mock).mockResolvedValue([]);

      const recommendations = await ChamaService.getRecommendedChamas('user_1', 10);

      expect(recommendations).toHaveLength(0);
      expect(prisma.chama.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  describe('getFeaturedChamas', () => {
    it('should return top performing chamas', async () => {
      const mockChamas = [
        {
          id: 'chama_1',
          name: 'High Performer',
          type: ChamaType.ROSCA,
          description: 'Best chama',
          maxMembers: 20,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link1',
          qrCode: 'qr1',
          createdAt: new Date(),
          _count: { memberships: 18, contributions: 200 },
          memberships: [],
        },
        {
          id: 'chama_2',
          name: 'Average Performer',
          type: ChamaType.ASCA,
          description: 'Good chama',
          maxMembers: 15,
          contributionAmount: 1500,
          contributionFrequency: Frequency.WEEKLY,
          currency: 'KES',
          shareableLink: 'link2',
          qrCode: 'qr2',
          createdAt: new Date(),
          _count: { memberships: 10, contributions: 80 },
          memberships: [],
        },
      ];

      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockChamas);
      
      // Mock high success metrics for chama_1
      (prisma.contribution.count as jest.Mock)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(190)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(60);
      (prisma.loan.count as jest.Mock)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7);
      (prisma.chamaMembership.count as jest.Mock)
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(10);
      (prisma.chamaMembership.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _avg: { reliabilityScore: 90 } })
        .mockResolvedValueOnce({ _avg: { reliabilityScore: 70 } });

      const featured = await ChamaService.getFeaturedChamas(5);

      expect(featured).toHaveLength(2);
      expect(featured.length).toBeGreaterThanOrEqual(2);
      if (featured[0] && featured[1]) {
        expect(featured[0].successScore).toBeGreaterThan(featured[1].successScore);
        expect(featured[0].successMetrics).toBeDefined();
      }
    });
  });

  describe('bookmarkChama', () => {
    it('should bookmark a public chama successfully', async () => {
      const mockChama = {
        id: 'chama_1',
        name: 'Test Chama',
        visibility: Visibility.PUBLIC,
        status: 'ACTIVE',
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await ChamaService.bookmarkChama('user_1', 'chama_1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('bookmarked successfully');
    });

    it('should throw error when bookmarking non-existent chama', async () => {
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ChamaService.bookmarkChama('user_1', 'invalid_chama')
      ).rejects.toThrow('Chama not found');
    });

    it('should throw error when bookmarking private chama', async () => {
      const mockChama = {
        id: 'chama_1',
        name: 'Private Chama',
        visibility: Visibility.PRIVATE,
        status: 'ACTIVE',
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);

      await expect(
        ChamaService.bookmarkChama('user_1', 'chama_1')
      ).rejects.toThrow('Cannot bookmark private chamas');
    });

    it('should throw error when user is already a member', async () => {
      const mockChama = {
        id: 'chama_1',
        name: 'Test Chama',
        visibility: Visibility.PUBLIC,
        status: 'ACTIVE',
      };

      const mockMembership = {
        chamaId: 'chama_1',
        userId: 'user_1',
        status: 'ACTIVE',
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await expect(
        ChamaService.bookmarkChama('user_1', 'chama_1')
      ).rejects.toThrow('Already a member of this chama');
    });
  });
});
