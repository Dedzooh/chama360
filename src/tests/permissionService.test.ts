import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PermissionService, Permission } from '../services/permissionService';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { MemberRole } from '@prisma/client';

// Mock dependencies
jest.mock('../config/database', () => ({
  prisma: {
    chamaMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    dispute: {
      count: jest.fn(),
    },
    vote: {
      count: jest.fn(),
    },
  },
}));
jest.mock('../config/redis');
jest.mock('../config/logger');

const mockPrisma = prisma as any;
const mockRedis = RedisService as jest.Mocked<typeof RedisService>;

describe('PermissionService', () => {
  const mockUserId = 'user_123';
  const mockChamaId = 'chama_456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hasPermission', () => {
    it('should grant permission for valid role and active membership', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.VIEW_FINANCIAL_REPORTS
      );

      expect(result.granted).toBe(true);
      expect(mockPrisma.chamaMembership.findUnique).toHaveBeenCalledWith({
        where: {
          chamaId_userId: {
            chamaId: mockChamaId,
            userId: mockUserId,
          },
        },
        select: {
          role: true,
          status: true,
          chama: {
            select: {
              id: true,
              status: true,
              type: true,
            },
          },
        },
      });
    });

    it('should deny permission for inactive membership', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with inactive membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'SUSPENDED',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.VIEW_FINANCIAL_REPORTS
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Member status is SUSPENDED');
    });

    it('should deny permission for inactive Chama', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with inactive Chama
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'SUSPENDED',
          type: 'ROSCA',
        },
      } as any);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.VIEW_FINANCIAL_REPORTS
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Chama status is SUSPENDED');
    });

    it('should deny permission for insufficient role', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with member role
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.APPROVE_LOANS
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Role MEMBER does not have permission APPROVE_LOANS');
      expect(result.requiredRole).toEqual(['FOUNDER', 'CHAIR', 'TREASURER']);
    });

    it('should use cached permission context', async () => {
      // Mock Redis cache hit
      const cachedContext = {
        chamaId: mockChamaId,
        userId: mockUserId,
        role: 'TREASURER' as MemberRole,
        memberStatus: 'ACTIVE',
        chamaStatus: 'ACTIVE',
        chamaType: 'ROSCA',
      };
      mockRedis.get.mockResolvedValue(cachedContext);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.VIEW_FINANCIAL_REPORTS
      );

      expect(result.granted).toBe(true);
      expect(mockPrisma.chamaMembership.findUnique).not.toHaveBeenCalled();
    });

    it('should deny financial permissions during active disputes', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole, // Member role to test dispute restriction
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock active financial disputes
      mockPrisma.dispute.count.mockResolvedValue(1);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.PROCESS_PAYMENTS
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Role MEMBER does not have permission PROCESS_PAYMENTS');
    });

    it('should allow founders to override dispute restrictions', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with founder role
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'FOUNDER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock active financial disputes
      mockPrisma.dispute.count.mockResolvedValue(1);

      const result = await PermissionService.hasPermission(
        mockUserId,
        mockChamaId,
        Permission.PROCESS_PAYMENTS
      );

      expect(result.granted).toBe(true);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for founder role', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with founder role
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'FOUNDER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const permissions = await PermissionService.getUserPermissions(mockUserId, mockChamaId);

      expect(permissions).toEqual(Object.values(Permission));
    });

    it('should return limited permissions for member role', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with member role
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const permissions = await PermissionService.getUserPermissions(mockUserId, mockChamaId);

      const expectedMemberPermissions = [
        Permission.VIEW_CHAMA_INFO,
        Permission.VIEW_OWN_CONTRIBUTIONS,
        Permission.MAKE_CONTRIBUTIONS,
        Permission.REQUEST_LOANS,
        Permission.VIEW_OWN_LOANS,
        Permission.ATTEND_MEETINGS,
        Permission.CAST_VOTES,
        Permission.RAISE_DISPUTES,
        Permission.VIEW_OWN_PROFILE,
        Permission.UPDATE_OWN_PROFILE,
      ];

      expect(permissions).toEqual(expectedMemberPermissions);
    });

    it('should return empty array for inactive membership', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with inactive membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'SUSPENDED',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      const permissions = await PermissionService.getUserPermissions(mockUserId, mockChamaId);

      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermissions', () => {
    it('should check multiple permissions correctly', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response with treasurer role
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const permissions = [
        Permission.VIEW_FINANCIAL_REPORTS,
        Permission.APPROVE_LOANS,
        Permission.MANAGE_MEMBERS, // Treasurer doesn't have this
      ];

      const results = await PermissionService.hasPermissions(
        mockUserId,
        mockChamaId,
        permissions
      );

      expect(results[Permission.VIEW_FINANCIAL_REPORTS].granted).toBe(true);
      expect(results[Permission.APPROVE_LOANS].granted).toBe(true);
      expect(results[Permission.MANAGE_MEMBERS].granted).toBe(false);
    });
  });

  describe('invalidateUserPermissionCache', () => {
    it('should invalidate specific Chama cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await PermissionService.invalidateUserPermissionCache(mockUserId, mockChamaId);

      expect(mockRedis.del).toHaveBeenCalledWith(`permissions:${mockUserId}:${mockChamaId}`);
    });

    it('should log when invalidating all user caches', async () => {
      await PermissionService.invalidateUserPermissionCache(mockUserId);

      // Should not call Redis del for specific key
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('bulkPermissionCheck', () => {
    it('should check permissions for multiple users', async () => {
      const userIds = ['user1', 'user2'];
      
      // Mock Redis cache miss for both users
      mockRedis.get.mockResolvedValue(null);

      // Mock database responses
      mockPrisma.chamaMembership.findUnique
        .mockResolvedValueOnce({
          role: 'TREASURER' as MemberRole,
          status: 'ACTIVE',
          chama: { id: mockChamaId, status: 'ACTIVE', type: 'ROSCA' },
        } as any)
        .mockResolvedValueOnce({
          role: 'MEMBER' as MemberRole,
          status: 'ACTIVE',
          chama: { id: mockChamaId, status: 'ACTIVE', type: 'ROSCA' },
        } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const results = await PermissionService.bulkPermissionCheck(
        userIds,
        mockChamaId,
        Permission.APPROVE_LOANS
      );

      expect(results['user1']?.granted).toBe(true); // Treasurer can approve loans
      expect(results['user2']?.granted).toBe(false); // Member cannot approve loans
    });
  });

  describe('getPermissionSummary', () => {
    it('should return comprehensive permission summary', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          status: 'ACTIVE',
          type: 'ROSCA',
        },
      } as any);

      // Mock Redis set for caching
      mockRedis.set.mockResolvedValue(undefined);

      // Mock contextual checks
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockPrisma.vote.count.mockResolvedValue(0);

      const summary = await PermissionService.getPermissionSummary(mockUserId, mockChamaId);

      expect(summary.context).toBeDefined();
      expect(summary.context?.role).toBe('TREASURER');
      expect(summary.permissions.length).toBeGreaterThan(0);
      expect(summary.deniedPermissions.length).toBeGreaterThan(0);
      
      // Treasurer should have financial permissions
      expect(summary.permissions).toContain(Permission.VIEW_FINANCIAL_REPORTS);
      
      // Treasurer should not have member management permissions
      const deniedPermission = summary.deniedPermissions.find(
        p => p.permission === Permission.MANAGE_MEMBERS
      );
      expect(deniedPermission).toBeDefined();
    });

    it('should return null context for non-member', async () => {
      // Mock Redis cache miss
      mockRedis.get.mockResolvedValue(null);

      // Mock database response - no membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue(null);

      const summary = await PermissionService.getPermissionSummary(mockUserId, mockChamaId);

      expect(summary.context).toBeNull();
      expect(summary.permissions).toEqual([]);
      expect(summary.deniedPermissions).toEqual([]);
    });
  });
});




