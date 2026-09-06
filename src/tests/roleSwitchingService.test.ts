import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RoleSwitchingService } from '../services/roleSwitchingService';
import { PermissionService } from '../services/permissionService';
import { RedisService } from '../config/redis';
import { MemberRole } from '@prisma/client';

jest.mock('../config/database', () => ({
  prisma: {
    chamaMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../config/redis');
jest.mock('../config/logger');
jest.mock('../services/permissionService');

const mockPrisma = jest.requireMock<{ prisma: any }>('../config/database').prisma;
const mockRedis = RedisService as jest.Mocked<typeof RedisService>;
const mockPermissionService = PermissionService as jest.Mocked<typeof PermissionService>;

describe('RoleSwitchingService', () => {
  const mockUserId = 'user_123';
  const mockChamaId = 'chama_456';
  const mockSessionId = 'session_789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('switchChamaContext', () => {
    it('should successfully switch Chama context for valid membership', async () => {
      // Mock database response
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          name: 'Test Chama',
          status: 'ACTIVE',
        },
      } as any);

      // Mock permission service
      mockPermissionService.getUserPermissions.mockResolvedValue(['VIEW_CHAMA_INFO'] as any);

      // Mock Redis operations
      mockRedis.set.mockResolvedValue(undefined);

      const context = {
        userId: mockUserId,
        toChamaId: mockChamaId,
        sessionId: mockSessionId,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      const result = await RoleSwitchingService.switchChamaContext(context);

      expect(result.userId).toBe(mockUserId);
      expect(result.chamaId).toBe(mockChamaId);
      expect(result.role).toBe('TREASURER');
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.permissions).toEqual(['VIEW_CHAMA_INFO']);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `active_chama:${mockUserId}:${mockSessionId}`,
        expect.objectContaining({
          userId: mockUserId,
          chamaId: mockChamaId,
          role: 'TREASURER',
        }),
        24 * 60 * 60
      );
    });

    it('should throw error for non-existent membership', async () => {
      // Mock database response - no membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue(null);

      const context = {
        userId: mockUserId,
        toChamaId: mockChamaId,
        sessionId: mockSessionId,
      };

      await expect(RoleSwitchingService.switchChamaContext(context))
        .rejects
        .toThrow('User is not a member of the target Chama');
    });

    it('should throw error for inactive membership', async () => {
      // Mock database response with inactive membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'SUSPENDED',
        chama: {
          id: mockChamaId,
          name: 'Test Chama',
          status: 'ACTIVE',
        },
      } as any);

      const context = {
        userId: mockUserId,
        toChamaId: mockChamaId,
        sessionId: mockSessionId,
      };

      await expect(RoleSwitchingService.switchChamaContext(context))
        .rejects
        .toThrow('Membership status is SUSPENDED');
    });

    it('should throw error for inactive Chama', async () => {
      // Mock database response with inactive Chama
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          name: 'Test Chama',
          status: 'SUSPENDED',
        },
      } as any);

      const context = {
        userId: mockUserId,
        toChamaId: mockChamaId,
        sessionId: mockSessionId,
      };

      await expect(RoleSwitchingService.switchChamaContext(context))
        .rejects
        .toThrow('Chama status is SUSPENDED');
    });
  });

  describe('getActiveChamaContext', () => {
    it('should return active context from Redis', async () => {
      const mockContext = {
        userId: mockUserId,
        chamaId: mockChamaId,
        role: 'TREASURER' as MemberRole,
        switchedAt: new Date(),
        sessionId: mockSessionId,
        permissions: ['VIEW_CHAMA_INFO'],
      };

      mockRedis.get.mockResolvedValue(mockContext);

      const result = await RoleSwitchingService.getActiveChamaContext(mockUserId, mockSessionId);

      expect(result).toEqual(mockContext);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `active_chama:${mockUserId}:${mockSessionId}`,
        true
      );
    });

    it('should return null when no active context exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await RoleSwitchingService.getActiveChamaContext(mockUserId, mockSessionId);

      expect(result).toBeNull();
    });
  });

  describe('getAvailableChamas', () => {
    it('should return list of available Chamas for user', async () => {
      const mockMemberships = [
        {
          role: 'TREASURER' as MemberRole,
          status: 'ACTIVE',
          chama: {
            id: 'chama1',
            name: 'Chama One',
            type: 'ROSCA',
            status: 'ACTIVE',
            _count: { memberships: 10 },
          },
        },
        {
          role: 'MEMBER' as MemberRole,
          status: 'ACTIVE',
          chama: {
            id: 'chama2',
            name: 'Chama Two',
            type: 'ASCA',
            status: 'SUSPENDED',
            _count: { memberships: 5 },
          },
        },
      ];

      mockPrisma.chamaMembership.findMany.mockResolvedValue(mockMemberships as any);

      const result = await RoleSwitchingService.getAvailableChamas(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        chamaId: 'chama1',
        name: 'Chama One',
        type: 'ROSCA',
        role: 'TREASURER',
        status: 'ACTIVE',
        memberCount: 10,
        canSwitch: true,
        switchReason: undefined,
      });
      expect(result[1]).toEqual({
        chamaId: 'chama2',
        name: 'Chama Two',
        type: 'ASCA',
        role: 'MEMBER',
        status: 'SUSPENDED',
        memberCount: 5,
        canSwitch: false,
        switchReason: 'Chama is SUSPENDED',
      });
    });
  });

  describe('requestRoleChange', () => {
    it('should create role change request for valid member', async () => {
      // Mock current membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
      } as any);

      // Mock no existing member with requested role
      mockPrisma.chamaMembership.findFirst.mockResolvedValue(null);

      // Mock Redis operations
      mockRedis.set.mockResolvedValue(undefined);

      const result = await RoleSwitchingService.requestRoleChange(
        mockUserId,
        mockChamaId,
        'TREASURER',
        'I have financial experience and want to help manage the Chama finances'
      );

      expect(result.userId).toBe(mockUserId);
      expect(result.chamaId).toBe(mockChamaId);
      expect(result.currentRole).toBe('MEMBER');
      expect(result.requestedRole).toBe('TREASURER');
      expect(result.status).toBe('PENDING');
      expect(result.reason).toBe('I have financial experience and want to help manage the Chama finances');
    });

    it('should throw error when requesting same role', async () => {
      // Mock current membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
      } as any);

      await expect(RoleSwitchingService.requestRoleChange(
        mockUserId,
        mockChamaId,
        'TREASURER',
        'Test reason'
      )).rejects.toThrow('Requested role is the same as current role');
    });

    it('should throw error when requesting founder role', async () => {
      // Mock current membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
      } as any);

      await expect(RoleSwitchingService.requestRoleChange(
        mockUserId,
        mockChamaId,
        'FOUNDER',
        'Test reason'
      )).rejects.toThrow('Cannot request to become founder');
    });

    it('should throw error when role is already taken', async () => {
      // Mock current membership
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
      } as any);

      // Mock existing member with requested role
      mockPrisma.chamaMembership.findFirst.mockResolvedValue({
        userId: 'other_user',
        role: 'TREASURER',
      } as any);

      await expect(RoleSwitchingService.requestRoleChange(
        mockUserId,
        mockChamaId,
        'TREASURER',
        'Test reason'
      )).rejects.toThrow('Role TREASURER is already assigned to another member');
    });

    it('should throw error for founder trying to change role', async () => {
      // Mock current membership as founder
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'FOUNDER' as MemberRole,
        status: 'ACTIVE',
      } as any);

      await expect(RoleSwitchingService.requestRoleChange(
        mockUserId,
        mockChamaId,
        'CHAIR',
        'Test reason'
      )).rejects.toThrow('Founders cannot change their role');
    });
  });

  describe('reviewRoleChangeRequest', () => {
    it('should approve role change request with proper permissions', async () => {
      const mockRequest = {
        id: 'req_123',
        userId: mockUserId,
        chamaId: mockChamaId,
        currentRole: 'MEMBER' as MemberRole,
        requestedRole: 'TREASURER' as MemberRole,
        reason: 'Test reason',
        status: 'PENDING' as const,
        requestedAt: new Date(),
      };

      // Mock Redis get for request
      mockRedis.get.mockResolvedValue(mockRequest);

      // Mock permission check
      mockPermissionService.hasPermission.mockResolvedValue({ granted: true });

      // Mock database update
      mockPrisma.chamaMembership.update.mockResolvedValue({} as any);

      // Mock permission cache invalidation
      mockPermissionService.invalidateUserPermissionCache.mockResolvedValue();

      // Mock Redis set for updated request
      mockRedis.set.mockResolvedValue(undefined);

      const reviewerId = 'reviewer_123';
      const result = await RoleSwitchingService.reviewRoleChangeRequest(
        'req_123',
        reviewerId,
        true,
        'Approved due to good qualifications'
      );

      expect(result.status).toBe('APPROVED');
      expect(result.reviewedBy).toBe(reviewerId);
      expect(result.reviewNotes).toBe('Approved due to good qualifications');

      expect(mockPrisma.chamaMembership.update).toHaveBeenCalledWith({
        where: {
          chamaId_userId: {
            chamaId: mockChamaId,
            userId: mockUserId,
          },
        },
        data: {
          role: 'TREASURER',
        },
      });
    });

    it('should reject role change request', async () => {
      const mockRequest = {
        id: 'req_123',
        userId: mockUserId,
        chamaId: mockChamaId,
        currentRole: 'MEMBER' as MemberRole,
        requestedRole: 'TREASURER' as MemberRole,
        reason: 'Test reason',
        status: 'PENDING' as const,
        requestedAt: new Date(),
      };

      // Mock Redis get for request
      mockRedis.get.mockResolvedValue(mockRequest);

      // Mock permission check
      mockPermissionService.hasPermission.mockResolvedValue({ granted: true });

      // Mock Redis set for updated request
      mockRedis.set.mockResolvedValue(undefined);

      const reviewerId = 'reviewer_123';
      const result = await RoleSwitchingService.reviewRoleChangeRequest(
        'req_123',
        reviewerId,
        false,
        'Insufficient experience'
      );

      expect(result.status).toBe('REJECTED');
      expect(result.reviewedBy).toBe(reviewerId);
      expect(result.reviewNotes).toBe('Insufficient experience');

      // Should not update membership for rejection
      expect(mockPrisma.chamaMembership.update).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent request', async () => {
      // Mock Redis get returning null
      mockRedis.get.mockResolvedValue(null);

      await expect(RoleSwitchingService.reviewRoleChangeRequest(
        'req_123',
        'reviewer_123',
        true
      )).rejects.toThrow('Role change request not found');
    });

    it('should throw error for insufficient permissions', async () => {
      const mockRequest = {
        id: 'req_123',
        userId: mockUserId,
        chamaId: mockChamaId,
        status: 'PENDING' as const,
      };

      // Mock Redis get for request
      mockRedis.get.mockResolvedValue(mockRequest);

      // Mock permission check - denied
      mockPermissionService.hasPermission.mockResolvedValue({ 
        granted: false,
        reason: 'Insufficient permissions'
      });

      await expect(RoleSwitchingService.reviewRoleChangeRequest(
        'req_123',
        'reviewer_123',
        true
      )).rejects.toThrow('Insufficient permissions to review role change requests');
    });
  });

  describe('clearActiveChamaContext', () => {
    it('should clear active context from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await RoleSwitchingService.clearActiveChamaContext(mockUserId, mockSessionId);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `active_chama:${mockUserId}:${mockSessionId}`
      );
    });
  });

  describe('validateAndRefreshContext', () => {
    it('should return existing active context when Chama matches', async () => {
      const mockContext = {
        userId: mockUserId,
        chamaId: mockChamaId,
        role: 'TREASURER' as MemberRole,
        switchedAt: new Date(),
        sessionId: mockSessionId,
        permissions: ['VIEW_CHAMA_INFO'],
      };

      mockRedis.get.mockResolvedValue(mockContext);

      const result = await RoleSwitchingService.validateAndRefreshContext(
        mockUserId,
        mockSessionId,
        mockChamaId
      );

      expect(result).toEqual(mockContext);
    });

    it('should create new context when no active context exists', async () => {
      // Mock no existing context
      mockRedis.get.mockResolvedValue(null);

      // Mock successful context creation
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'MEMBER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          name: 'Test Chama',
          status: 'ACTIVE',
        },
      } as any);

      mockPermissionService.getUserPermissions.mockResolvedValue(['VIEW_CHAMA_INFO'] as any);
      mockRedis.set.mockResolvedValue(undefined);

      const result = await RoleSwitchingService.validateAndRefreshContext(
        mockUserId,
        mockSessionId,
        mockChamaId
      );

      expect(result).toBeDefined();
      expect(result?.chamaId).toBe(mockChamaId);
      expect(result?.role).toBe('MEMBER');
    });

    it('should switch context when active context is for different Chama', async () => {
      const existingContext = {
        userId: mockUserId,
        chamaId: 'different_chama',
        role: 'MEMBER' as MemberRole,
        switchedAt: new Date(),
        sessionId: mockSessionId,
        permissions: ['VIEW_CHAMA_INFO'],
      };

      // Mock existing context for different Chama
      mockRedis.get.mockResolvedValue(existingContext);

      // Mock successful context switch
      mockPrisma.chamaMembership.findUnique.mockResolvedValue({
        role: 'TREASURER' as MemberRole,
        status: 'ACTIVE',
        chama: {
          id: mockChamaId,
          name: 'Test Chama',
          status: 'ACTIVE',
        },
      } as any);

      mockPermissionService.getUserPermissions.mockResolvedValue(['VIEW_FINANCIAL_REPORTS'] as any);
      mockRedis.set.mockResolvedValue(undefined);

      const result = await RoleSwitchingService.validateAndRefreshContext(
        mockUserId,
        mockSessionId,
        mockChamaId
      );

      expect(result).toBeDefined();
      expect(result?.chamaId).toBe(mockChamaId);
      expect(result?.role).toBe('TREASURER');
    });
  });
});
