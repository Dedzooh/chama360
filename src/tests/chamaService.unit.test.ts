/**
 * Unit tests for ChamaService
 * 
 * Tests Chama creation, configuration, and management functionality
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { ChamaService } from '../services/chamaService';
import { prisma } from '../config/database';
import { ChamaType, Visibility, Frequency, MemberRole, MemberStatus } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  BadRequestError
} from '../middleware/errorHandler';
import * as QRCode from 'qrcode';
import { sendTransactionalEmail } from '../services/notificationDeliveryService';

// Mock dependencies
jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    chama: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
      update: jest.fn(),
    },
    chamaMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _avg: { reliabilityScore: null } }),
    },
    contribution: {
      count: jest.fn().mockResolvedValue(0),
    },
    loan: {
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_123' }),
    },
  },
}));

jest.mock('qrcode');
jest.mock('../services/notificationService');
jest.mock('../services/backgroundJobService');
jest.mock('../services/notificationDeliveryService', () => ({
  sendTransactionalEmail: jest.fn(),
}));
jest.mock('../utils/publicWebUrl', () => ({
  createPublicHashUrl: (path: string) => `https://chamaz360.co.ke/#${path.startsWith('/') ? path : `/${path}`}`,
}));

describe('ChamaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChama', () => {
    const founderId = 'user_123';
    const validROSCAData = {
      name: 'Test ROSCA Chama',
      type: ChamaType.ROSCA,
      description: 'A test ROSCA chama for unit testing',
      maxMembers: 10,
      contributionAmount: 1000,
      contributionFrequency: Frequency.MONTHLY,
      currency: 'KES',
      visibility: Visibility.PUBLIC,
      settings: {
        roscaSettings: {
          payoutSchedule: [
            {
              memberId: founderId,
              payoutDate: new Date().toISOString(),
              amount: 10000,
              status: 'PENDING' as const,
            },
          ],
          currentPayoutIndex: 0,
          rotationType: 'SEQUENTIAL' as const,
          allowSkipping: false,
        },
        governanceRules: {
          votingRules: {
            defaultVoteType: 'SIMPLE_MAJORITY' as const,
            quorumPercentage: 50,
            votingPeriodDays: 7,
          },
          decisionThreshold: 50,
          allowProposals: true,
          proposalApprovalRequired: true,
        },
        penaltyRules: {
          lateContributionPenalty: 100,
          penaltyType: 'FIXED' as const,
          gracePeriodDays: 3,
          compoundPenalties: false,
        },
      },
    };

    it('should create a ROSCA chama successfully', async () => {
      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: true,
      };

      const mockChama = {
        id: 'chama_123',
        ...validROSCAData,
        shareableLink: 'mock-uuid',
        qrCode: 'mock-qr-code',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            chamaId: 'chama_123',
            userId: founderId,
            role: MemberRole.FOUNDER,
            status: MemberStatus.ACTIVE,
            reliabilityScore: 100,
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('mock-qr-code');
      (prisma.chama.create as jest.Mock).mockResolvedValue(mockChama);

      const result = await ChamaService.createChama(founderId, validROSCAData);

      expect(result).toBeDefined();
      expect(result.id).toBe('chama_123');
      expect(result.type).toBe(ChamaType.ROSCA);
      expect(result.name).toBe('Test ROSCA Chama');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: founderId } });
      expect(prisma.chama.create).toHaveBeenCalled();
    });

    it('should create an ASCA chama successfully', async () => {
      const ascaData = {
        name: 'Test ASCA Chama',
        type: ChamaType.ASCA,
        description: 'A test ASCA chama for unit testing',
        maxMembers: 15,
        contributionAmount: 2000,
        contributionFrequency: Frequency.MONTHLY,
        currency: 'KES',
        visibility: Visibility.PUBLIC,
        settings: {
          ascaSettings: {
            shareOutDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            loanInterestRate: 10,
            maxLoanAmount: 50000,
            minLoanAmount: 5000,
            loanDurationMonths: 6,
            requireGuarantors: true,
            minGuarantors: 2,
          },
          governanceRules: {
            votingRules: {
              defaultVoteType: 'SIMPLE_MAJORITY' as const,
              quorumPercentage: 50,
              votingPeriodDays: 7,
            },
            decisionThreshold: 50,
            allowProposals: true,
            proposalApprovalRequired: true,
          },
          penaltyRules: {
            lateContributionPenalty: 5,
            penaltyType: 'PERCENTAGE' as const,
            gracePeriodDays: 5,
            compoundPenalties: false,
          },
        },
      };

      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: true,
      };

      const mockChama = {
        id: 'chama_456',
        ...ascaData,
        shareableLink: 'mock-uuid-2',
        qrCode: 'mock-qr-code-2',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('mock-qr-code-2');
      (prisma.chama.create as jest.Mock).mockResolvedValue(mockChama);

      const result = await ChamaService.createChama(founderId, ascaData);

      expect(result).toBeDefined();
      expect(result.type).toBe(ChamaType.ASCA);
      expect(result.name).toBe('Test ASCA Chama');
    });

    it('should create a NORMAL chama successfully', async () => {
      const normalData = {
        name: 'Test NORMAL Chama',
        type: ChamaType.NORMAL,
        description: 'A test NORMAL chama for unit testing',
        maxMembers: 20,
        contributionAmount: 1500,
        contributionFrequency: Frequency.WEEKLY,
        currency: 'KES',
        visibility: Visibility.PRIVATE,
        settings: {
          normalSettings: {
            allowInvestments: true,
            investmentTypes: ['Real Estate', 'Stocks'],
            votingQuorum: 60,
            meetingFrequency: 'MONTHLY' as const,
            requireMeetingAttendance: true,
            minAttendancePercentage: 80,
          },
          governanceRules: {
            votingRules: {
              defaultVoteType: 'WEIGHTED_CONTRIBUTION' as const,
              quorumPercentage: 60,
              votingPeriodDays: 10,
            },
            decisionThreshold: 60,
            allowProposals: true,
            proposalApprovalRequired: true,
          },
          penaltyRules: {
            lateContributionPenalty: 200,
            penaltyType: 'FIXED' as const,
            gracePeriodDays: 0,
            compoundPenalties: true,
          },
        },
      };

      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: true,
      };

      const mockChama = {
        id: 'chama_789',
        ...normalData,
        shareableLink: 'mock-uuid-3',
        qrCode: 'mock-qr-code-3',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('mock-qr-code-3');
      (prisma.chama.create as jest.Mock).mockResolvedValue(mockChama);

      const result = await ChamaService.createChama(founderId, normalData);

      expect(result).toBeDefined();
      expect(result.type).toBe(ChamaType.NORMAL);
      expect(result.visibility).toBe(Visibility.PRIVATE);
    });

    it('should throw error if founder is inactive', async () => {
      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: false,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);

      await expect(
        ChamaService.createChama(founderId, validROSCAData)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw error if founder does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ChamaService.createChama(founderId, validROSCAData)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw error if ROSCA chama missing roscaSettings', async () => {
      const invalidData = {
        ...validROSCAData,
        settings: {
          governanceRules: validROSCAData.settings.governanceRules,
          penaltyRules: validROSCAData.settings.penaltyRules,
        },
      };

      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);

      await expect(
        ChamaService.createChama(founderId, invalidData)
      ).rejects.toThrow(BadRequestError);
    });

    it('should generate unique shareable link and QR code', async () => {
      const mockFounder = {
        id: founderId,
        email: 'founder@test.com',
        isActive: true,
      };

      const mockChama = {
        id: 'chama_123',
        ...validROSCAData,
        shareableLink: 'unique-uuid',
        qrCode: 'qr-code-data',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockFounder);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('qr-code-data');
      (prisma.chama.create as jest.Mock).mockResolvedValue(mockChama);

      const result = await ChamaService.createChama(founderId, validROSCAData);

      expect(result.shareableLink).toBeDefined();
      expect(result.qrCode).toBe('qr-code-data');
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });
  });

  describe('getPublicChamas', () => {
    it('should return public chamas with pagination', async () => {
      const mockChamas = [
        {
          id: 'chama_1',
          name: 'Public Chama 1',
          type: ChamaType.ROSCA,
          description: 'Test chama 1',
          maxMembers: 10,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link-1',
          qrCode: 'qr-1',
          createdAt: new Date(),
          _count: { memberships: 5 },
        },
        {
          id: 'chama_2',
          name: 'Public Chama 2',
          type: ChamaType.ASCA,
          description: 'Test chama 2',
          maxMembers: 15,
          contributionAmount: 2000,
          contributionFrequency: Frequency.WEEKLY,
          currency: 'KES',
          shareableLink: 'link-2',
          qrCode: 'qr-2',
          createdAt: new Date(),
          _count: { memberships: 8 },
        },
      ];

      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockChamas);
      (prisma.chama.count as jest.Mock).mockResolvedValue(2);

      const result = await ChamaService.getPublicChamas(1, 20);

      expect(result.chamas).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should filter chamas by search term', async () => {
      const mockChamas = [
        {
          id: 'chama_1',
          name: 'Savings Group',
          type: ChamaType.ROSCA,
          description: 'A savings group',
          maxMembers: 10,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link-1',
          qrCode: 'qr-1',
          createdAt: new Date(),
          _count: { memberships: 5 },
        },
      ];

      (prisma.chama.findMany as jest.Mock).mockResolvedValue(mockChamas);
      (prisma.chama.count as jest.Mock).mockResolvedValue(1);

      const result = await ChamaService.getPublicChamas(1, 20, { search: 'Savings' });

      expect(result.chamas).toHaveLength(1);
      expect(result.chamas[0]?.name).toContain('Savings');
    });
  });

  describe('getChamaDetails', () => {
    const chamaId = 'chama_123';
    const userId = 'user_456';

    it('should return chama details for public chama', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Test Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PUBLIC,
        description: 'Test description',
        maxMembers: 10,
        contributionAmount: 1000,
        contributionFrequency: Frequency.MONTHLY,
        currency: 'KES',
        shareableLink: 'link',
        qrCode: 'qr',
        status: 'ACTIVE',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
        _count: { memberships: 0 },
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);

      const result = await ChamaService.getChamaDetails(chamaId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(chamaId);
    });

    it('should throw error for private chama if user is not a member', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Private Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PRIVATE,
        memberships: [],
        _count: { memberships: 0 },
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);

      await expect(
        ChamaService.getChamaDetails(chamaId, userId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should return null if chama does not exist', async () => {
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await ChamaService.getChamaDetails(chamaId, userId);

      expect(result).toBeNull();
    });
  });

  describe('updateChama', () => {
    const chamaId = 'chama_123';
    const userId = 'user_456';

    it('should update chama settings for founder', async () => {
      const mockMembership = {
        chamaId,
        userId,
        role: MemberRole.FOUNDER,
        status: MemberStatus.ACTIVE,
      };

      const mockChama = {
        id: chamaId,
        type: ChamaType.ROSCA,
        name: 'Test Chama',
        description: 'Original description',
        status: 'ACTIVE',
      };

      const updatedChama = {
        ...mockChama,
        description: 'Updated description',
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chama.update as jest.Mock).mockResolvedValue(updatedChama);

      const result = await ChamaService.updateChama(
        chamaId,
        { description: 'Updated description' },
        userId
      );

      expect(result.description).toBe('Updated description');
      expect(prisma.chama.update).toHaveBeenCalled();
    });

    it('should throw error if user is not founder or chair', async () => {
      const mockMembership = {
        chamaId,
        userId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await expect(
        ChamaService.updateChama(chamaId, { description: 'New description' }, userId)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('joinChama', () => {
    const userId = 'user_789';
    const chamaId = 'chama_123';
    const shareableLink = 'valid-link';

    it('should allow user to join public chama', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Public Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PUBLIC,
        status: 'ACTIVE',
        maxMembers: 10,
        shareableLink,
      };

      const mockMembership = {
        chamaId,
        userId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
        reliabilityScore: 50,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(5);
      (prisma.chamaMembership.create as jest.Mock).mockResolvedValue(mockMembership);

      const result = await ChamaService.joinChama(userId, chamaId, undefined, true);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.chamaId).toBe(chamaId);
    });

    it('should require shareable link for private chama', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Private Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PRIVATE,
        status: 'ACTIVE',
        maxMembers: 10,
        shareableLink,
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);

      await expect(
        ChamaService.joinChama(userId, chamaId, undefined, true)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw error if chama is at capacity', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Full Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PUBLIC,
        status: 'ACTIVE',
        maxMembers: 10,
        shareableLink,
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.chamaMembership.count as jest.Mock).mockResolvedValue(10);

      await expect(
        ChamaService.joinChama(userId, chamaId, undefined, true)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw error if user is already an active member', async () => {
      const mockChama = {
        id: chamaId,
        name: 'Test Chama',
        type: ChamaType.ROSCA,
        visibility: Visibility.PUBLIC,
        status: 'ACTIVE',
        maxMembers: 10,
        shareableLink,
      };

      const existingMembership = {
        chamaId,
        userId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      };

      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(existingMembership);

      await expect(
        ChamaService.joinChama(userId, chamaId, undefined, true)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('inviteMembers', () => {
    const chamaId = 'chama_123';
    const inviterId = 'user_456';
    const emails = ['newmember1@test.com', 'newmember2@test.com'];

    const mockMembership = {
      chamaId,
      userId: inviterId,
      role: MemberRole.CHAIR,
      status: MemberStatus.ACTIVE,
    };

    const mockChama = {
      id: chamaId,
      name: 'Test Chama',
      shareableLink: 'invite-token',
      status: 'ACTIVE',
    };

    it('should send invitations to existing users', async () => {
      const mockUser = {
        id: 'user_789',
        email: emails[0],
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await ChamaService.inviteMembers(chamaId, emails, 'Join us!', inviterId);

      expect(result).toHaveLength(2);
      expect(result).toEqual(emails.map((email) => ({ email, status: 'NOTIFIED' })));
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(sendTransactionalEmail).not.toHaveBeenCalled();
    });

    it('sends email invitations with the production hash-route URL', async () => {
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (sendTransactionalEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await ChamaService.inviteMembers(chamaId, [emails[0]!], 'Join us!', inviterId);

      expect(result).toEqual([{ email: emails[0], status: 'EMAIL_SENT' }]);
      expect(sendTransactionalEmail).toHaveBeenCalledWith(
        emails[0],
        'Invitation to join Test Chama on CHAMAZ360',
        expect.stringContaining('https://chamaz360.co.ke/#/join/invite-token'),
      );
    });

    it('reports email delivery failure without claiming the invitation was sent', async () => {
      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.chama.findUnique as jest.Mock).mockResolvedValue(mockChama);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (sendTransactionalEmail as jest.Mock).mockRejectedValue(new Error('SMTP unavailable'));

      const result = await ChamaService.inviteMembers(chamaId, [emails[0]!], 'Join us!', inviterId);

      expect(result).toEqual([{ email: emails[0], status: 'EMAIL_FAILED' }]);
    });

    it('should throw error if inviter is not founder or chair', async () => {
      const mockMembership = {
        chamaId,
        userId: inviterId,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      };

      (prisma.chamaMembership.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await expect(
        ChamaService.inviteMembers(chamaId, emails, 'Join us!', inviterId)
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
