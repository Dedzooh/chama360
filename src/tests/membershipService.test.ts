/**
 * Unit tests for MembershipService
 * 
 * Tests multi-Chama membership management functionality including:
 * - Unified dashboard generation
 * - Role assignment and status tracking
 * - Membership history
 * - Reliability scoring
 */

import { MembershipService } from '../services/membershipService';
import { prisma } from '../config/database';
import { MemberRole, MemberStatus, ChamaType } from '@prisma/client';

// Mock the prisma client
jest.mock('../config/database', () => ({
  prisma: {
    chamaMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    contribution: {
      findMany: jest.fn(),
    },
    loan: {
      findMany: jest.fn(),
    },
    vote: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    voteCast: {
      count: jest.fn(),
    },
    notification: {
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

// Mock the notification service
jest.mock('../services/notificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock the logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  auditLog: jest.fn(),
}));

describe('MembershipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnifiedDashboard', () => {
    it('should return unified dashboard with all Chama participations', async () => {
      const userId = 'user-123';
      const mockMemberships = [
        {
          userId,
          chamaId: 'chama-1',
          role: 'MEMBER' as MemberRole,
          status: 'ACTIVE' as MemberStatus,
          reliabilityScore: 0.85,
          joinedAt: new Date('2024-01-01'),
          chama: {
            id: 'chama-1',
            name: 'Test Chama 1',
            type: 'ROSCA' as ChamaType,
            status: 'ACTIVE',
            contributionAmount: 1000,
            contributionFrequency: 'MONTHLY',
          },
        },
        {
          userId,
          chamaId: 'chama-2',
          role: 'TREASURER' as MemberRole,
          status: 'ACTIVE' as MemberStatus,
          reliabilityScore: 0.92,
          joinedAt: new Date('2024-02-01'),
          chama: {
            id: 'chama-2',
            name: 'Test Chama 2',
            type: 'ASCA' as ChamaType,
            status: 'ACTIVE',
            contributionAmount: 2000,
            contributionFrequency: 'WEEKLY',
          },
        },
      ];

      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);
      (prisma.chamaMembership.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        const lookup = where?.chamaId_userId ?? where;
        return mockMemberships.find((membership) => membership.chamaId === lookup.chamaId && membership.userId === lookup.userId) ?? null;
      });
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        { amount: 1000, status: 'PAID', dueDate: new Date(), chama: { id: 'chama-1', name: 'Test Chama 1' } },
        { amount: 1000, status: 'PENDING', dueDate: new Date(Date.now() + 86400000), chama: { id: 'chama-2', name: 'Test Chama 2' } },
      ]);
      (prisma.loan.findMany as jest.Mock).mockResolvedValue([
        { status: 'ACTIVE', balance: 5000 },
      ]);
      (prisma.vote.count as jest.Mock).mockResolvedValue(0);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.count as jest.Mock).mockResolvedValue(2);

      const dashboard = await MembershipService.getUnifiedDashboard(userId);

      expect(dashboard).toBeDefined();
      expect(dashboard.userId).toBe(userId);
      expect(dashboard.totalChamas).toBe(2);
      expect(dashboard.activeChamas).toBe(2);
      expect(dashboard.chamas).toHaveLength(2);
      expect(dashboard.aggregatedMetrics).toBeDefined();
      expect(dashboard.aggregatedMetrics.averageReliabilityScore).toBeGreaterThan(0);
    });

    it('should handle user with no Chama memberships', async () => {
      const userId = 'user-no-chamas';

      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.loan.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.voteCast.count as jest.Mock).mockResolvedValue(0);

      const dashboard = await MembershipService.getUnifiedDashboard(userId);

      expect(dashboard).toBeDefined();
      expect(dashboard.userId).toBe(userId);
      expect(dashboard.totalChamas).toBe(0);
      expect(dashboard.activeChamas).toBe(0);
      expect(dashboard.chamas).toHaveLength(0);
    });
  });

  describe('getChamaDashboardSummary', () => {
    it('should return dashboard summary for a specific Chama', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-1';

      const mockMembership = {
        userId,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
        reliabilityScore: 0.85,
        joinedAt: new Date('2024-01-01'),
        chama: {
          id: chamaId,
          name: 'Test Chama',
          type: 'ROSCA' as ChamaType,
          status: 'ACTIVE',
        },
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([
        { amount: 1000, status: 'PAID', dueDate: new Date(), paidDate: new Date() },
        { amount: 1000, status: 'PENDING', dueDate: new Date(Date.now() + 86400000) },
      ]);
      (prisma.loan.findMany as jest.Mock).mockResolvedValue([
        { status: 'ACTIVE', balance: 5000 },
      ]);
      (prisma.vote.count as jest.Mock).mockResolvedValue(1);
      (prisma.notification.count as jest.Mock).mockResolvedValue(3);

      const summary = await MembershipService.getChamaDashboardSummary(userId, chamaId);

      expect(summary).toBeDefined();
      expect(summary.chamaId).toBe(chamaId);
      expect(summary.chamaName).toBe('Test Chama');
      expect(summary.role).toBe('MEMBER');
      expect(summary.status).toBe('ACTIVE');
      expect(summary.reliabilityScore).toBe(0.85);
      expect(summary.totalContributions).toBe(1000);
      expect(summary.pendingContributions).toBe(1);
      expect(summary.activeLoans).toBe(1);
      expect(summary.totalLoanBalance).toBe(5000);
    });

    it('should throw error for non-existent membership', async () => {
      const userId = 'user-123';
      const chamaId = 'non-existent';

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        MembershipService.getChamaDashboardSummary(userId, chamaId)
      ).rejects.toThrow('Membership not found');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      const chamaId = 'chama-1';
      const userId = 'user-123';
      const updatedBy = 'founder-123';
      const newRole = 'TREASURER' as MemberRole;

      const mockUpdaterMembership = {
        userId: updatedBy,
        chamaId,
        role: 'FOUNDER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
      };

      const mockTargetMembership = {
        userId,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
        chama: { id: chamaId, name: 'Test Chama' },
        user: { id: userId, firstName: 'John', lastName: 'Doe' },
      };

      (prisma.chamaMembership.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUpdaterMembership)
        .mockResolvedValueOnce(mockTargetMembership);
      (prisma.chamaMembership.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.chamaMembership.update as jest.Mock).mockResolvedValue({
        ...mockTargetMembership,
        role: newRole,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await MembershipService.updateMemberRole(chamaId, userId, newRole, updatedBy);

      expect(prisma.chamaMembership.update).toHaveBeenCalledWith({
        where: { chamaId_userId: { chamaId, userId } },
        data: { role: newRole, updatedAt: expect.any(Date) },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should prevent non-authorized users from updating roles', async () => {
      const chamaId = 'chama-1';
      const userId = 'user-123';
      const updatedBy = 'unauthorized-user';
      const newRole = 'TREASURER' as MemberRole;

      const mockUpdaterMembership = {
        userId: updatedBy,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockUpdaterMembership);

      await expect(
        MembershipService.updateMemberRole(chamaId, userId, newRole, updatedBy)
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should prevent changing founder role', async () => {
      const chamaId = 'chama-1';
      const userId = 'founder-123';
      const updatedBy = 'chair-123';
      const newRole = 'MEMBER' as MemberRole;

      const mockUpdaterMembership = {
        userId: updatedBy,
        chamaId,
        role: 'CHAIR' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
      };

      const mockTargetMembership = {
        userId,
        chamaId,
        role: 'FOUNDER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
        chama: { id: chamaId, name: 'Test Chama' },
        user: { id: userId, firstName: 'Founder', lastName: 'User' },
      };

      (prisma.chamaMembership.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUpdaterMembership)
        .mockResolvedValueOnce(mockTargetMembership);

      await expect(
        MembershipService.updateMemberRole(chamaId, userId, newRole, updatedBy)
      ).rejects.toThrow('Cannot change founder role');
    });
  });

  describe('calculateReliabilityScore', () => {
    it('should calculate reliability score with all components', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-1';

      const mockMembership = {
        userId,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
        reliabilityScore: 0.75,
      };

      const mockContributions = [
        { status: 'PAID', paidDate: new Date('2024-01-05'), dueDate: new Date('2024-01-10') },
        { status: 'PAID', paidDate: new Date('2024-02-05'), dueDate: new Date('2024-02-10') },
        { status: 'PAID', paidDate: new Date('2024-03-15'), dueDate: new Date('2024-03-10') }, // Late
      ];

      const mockLoans = [
        { status: 'PAID' },
        { status: 'ACTIVE', balance: 5000 },
      ];

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue(mockContributions);
      (prisma.loan.findMany as jest.Mock).mockResolvedValue(mockLoans);
      (prisma.vote.count as jest.Mock).mockResolvedValue(10);
      (prisma.voteCast.count as jest.Mock).mockResolvedValue(8);
      (prisma.chamaMembership.update as jest.Mock).mockResolvedValue({
        ...mockMembership,
        reliabilityScore: 0.85,
      });

      const scoreBreakdown = await MembershipService.calculateReliabilityScore(userId, chamaId);

      expect(scoreBreakdown).toBeDefined();
      expect(scoreBreakdown.userId).toBe(userId);
      expect(scoreBreakdown.chamaId).toBe(chamaId);
      expect(scoreBreakdown.currentScore).toBeGreaterThan(0);
      expect(scoreBreakdown.currentScore).toBeLessThanOrEqual(100);
      expect(scoreBreakdown.components.contributionConsistency).toBeDefined();
      expect(scoreBreakdown.components.loanPerformance).toBeDefined();
      expect(scoreBreakdown.components.meetingAttendance).toBeDefined();
      expect(scoreBreakdown.components.governanceParticipation).toBeDefined();
    });

    it('should handle member with no activity', async () => {
      const userId = 'new-user';
      const chamaId = 'chama-1';

      const mockMembership = {
        userId,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
        reliabilityScore: 0.5,
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.loan.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.vote.count as jest.Mock).mockResolvedValue(0);
      (prisma.voteCast.count as jest.Mock).mockResolvedValue(0);
      (prisma.chamaMembership.update as jest.Mock).mockResolvedValue(mockMembership);

      const scoreBreakdown = await MembershipService.calculateReliabilityScore(userId, chamaId);

      expect(scoreBreakdown).toBeDefined();
      expect(scoreBreakdown.currentScore).toBeGreaterThan(0);
      expect(scoreBreakdown.components.contributionConsistency.details.totalContributions).toBe(0);
      expect(scoreBreakdown.components.loanPerformance.details.totalLoans).toBe(0);
    });
  });

  describe('getMembershipHistory', () => {
    it('should return membership history with events', async () => {
      const userId = 'user-123';
      const chamaId = 'chama-1';

      const mockMembership = {
        userId,
        chamaId,
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE' as MemberStatus,
      };

      const mockAuditLogs = [
        {
          id: 'log-1',
          action: 'CREATE',
          entityType: 'ChamaMembership',
          entityId: `${chamaId}:${userId}`,
          userId,
          chamaId,
          oldValues: null,
          newValues: { role: 'MEMBER', status: 'ACTIVE' },
          metadata: {},
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'log-2',
          action: 'CREATE',
          entityType: 'Contribution',
          entityId: 'contrib-1',
          userId,
          chamaId,
          oldValues: null,
          newValues: { amount: 1000, status: 'PAID' },
          metadata: {},
          createdAt: new Date('2024-01-15'),
        },
      ];

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditLogs);

      const history = await MembershipService.getMembershipHistory(userId, chamaId);

      expect(history).toBeDefined();
      expect(history.userId).toBe(userId);
      expect(history.chamaId).toBe(chamaId);
      expect(history.events).toHaveLength(2);
      expect(history.events[0]?.eventType).toBe('JOINED');
      expect(history.events[1]?.eventType).toBe('CONTRIBUTION_MADE');
    });
  });

  describe('getUserMemberships', () => {
    it('should return paginated memberships with filters', async () => {
      const userId = 'user-123';
      const mockMemberships = [
        {
          userId,
          chamaId: 'chama-1',
          role: 'MEMBER' as MemberRole,
          status: 'ACTIVE' as MemberStatus,
          reliabilityScore: 0.85,
          joinedAt: new Date('2024-01-01'),
          chama: {
            id: 'chama-1',
            name: 'Test Chama 1',
            type: 'ROSCA' as ChamaType,
            status: 'ACTIVE',
            contributionAmount: 1000,
            contributionFrequency: 'MONTHLY',
            currency: 'KES',
          },
        },
      ];

      (prisma.chamaMembership.findMany as jest.Mock).mockResolvedValue(mockMemberships);
      (prisma.chamaMembership.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        const lookup = where?.chamaId_userId ?? where;
        return mockMemberships.find((membership) => membership.chamaId === lookup.chamaId && membership.userId === lookup.userId) ?? null;
      });
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(1);

      const result = await MembershipService.getUserMemberships(
        userId,
        { status: ['ACTIVE'] },
        1,
        20
      );

      expect(result).toBeDefined();
      expect(result.memberships).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });
  });
});




