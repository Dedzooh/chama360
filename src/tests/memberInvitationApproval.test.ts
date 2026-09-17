/**
 * Unit tests for member invitation and approval workflow
 * 
 * Tests the implementation of task 5.3:
 * - Create invitation system with secure registration links
 * - Add membership application review and approval process
 * - Implement member onboarding with terms agreement
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { prisma } from '../config/database';
import { ChamaService } from '../services/chamaService';
import { MemberStatus, MemberRole, ChamaType, Visibility, Frequency, KycStatus } from '@prisma/client';
import { IdentityProtectionService } from '../services/identityProtectionService';

describe('Member Invitation and Approval Workflow', () => {
  let founderId: string;
  let applicantId: string;
  let chamaId: string;
  let shareableLink: string;

  beforeAll(async () => {
    // Create test users
    const founder = await prisma.user.create({
      data: {
        email: 'founder-invite-test@example.com',
        phone: '+254700000101',
        ...IdentityProtectionService.protect('ID-FOUNDER-101'),
        firstName: 'Test',
        lastName: 'Founder',
        passwordHash: 'hashed_password',
        kycStatus: KycStatus.VERIFIED,
        isActive: true,
      },
    });
    founderId = founder.id;

    const applicant = await prisma.user.create({
      data: {
        email: 'applicant-test@example.com',
        phone: '+254700000102',
        ...IdentityProtectionService.protect('ID-APPLICANT-102'),
        firstName: 'Test',
        lastName: 'Applicant',
        passwordHash: 'hashed_password',
        kycStatus: KycStatus.VERIFIED,
        isActive: true,
      },
    });
    applicantId = applicant.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.chamaMembership.deleteMany({
      where: {
        OR: [
          { userId: founderId },
          { userId: applicantId },
        ],
      },
    });

    await prisma.chama.deleteMany({
      where: {
        memberships: {
          some: {
            userId: founderId,
          },
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [founderId, applicantId] },
      },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create a test chama before each test
    const chama = await ChamaService.createChama(founderId, {
      name: 'Test Invitation Chama',
      type: ChamaType.ROSCA,
      description: 'A test chama for invitation and approval workflow',
      maxMembers: 10,
      contributionAmount: 1000,
      contributionFrequency: Frequency.MONTHLY,
      currency: 'KES',
      visibility: Visibility.PUBLIC,
      settings: {
        roscaSettings: {
          payoutSchedule: [],
          currentPayoutIndex: 0,
          rotationType: 'SEQUENTIAL',
          allowSkipping: false,
        },
        governanceRules: {
          votingRules: {
            defaultVoteType: 'SIMPLE_MAJORITY',
            quorumPercentage: 50,
            votingPeriodDays: 7,
          },
          decisionThreshold: 50,
          allowProposals: true,
          proposalApprovalRequired: true,
        },
      },
    });
    chamaId = chama.id;
    shareableLink = chama.shareableLink!;
  });

  describe('Secure Registration Links', () => {
    it('should generate unique shareable link when creating a chama', async () => {
      const chama = await prisma.chama.findUnique({
        where: { id: chamaId },
        select: { shareableLink: true, qrCode: true },
      });

      expect(chama).toBeDefined();
      expect(chama?.shareableLink).toBeDefined();
      expect(chama?.shareableLink).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(chama?.qrCode).toBeDefined();
      expect(chama?.qrCode).toContain('data:image/png;base64');
    });

    it('should allow joining with valid shareable link', async () => {
      const membership = await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true,
        'I would like to join this chama'
      );

      expect(membership).toBeDefined();
      expect(membership.userId).toBe(applicantId);
      expect(membership.chamaId).toBe(chamaId);
      expect(membership.status).toBe(MemberStatus.PENDING);
    });

    it('should reject joining with invalid shareable link for invite-only chama', async () => {
      // Update chama to invite-only
      await prisma.chama.update({
        where: { id: chamaId },
        data: { visibility: Visibility.INVITE_ONLY },
      });

      await expect(
        ChamaService.joinChama(
          applicantId,
          chamaId,
          'invalid-link',
          true
        )
      ).rejects.toThrow('Invalid or missing invitation link');
    });
  });

  describe('Terms Agreement', () => {
    it('should require terms agreement to join', async () => {
      await expect(
        ChamaService.joinChama(
          applicantId,
          chamaId,
          shareableLink,
          false // Terms not agreed
        )
      ).rejects.toThrow('You must agree to the Chama terms and conditions to join');
    });

    it('should log terms agreement in audit trail', async () => {
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true,
        'Test application'
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'ChamaMembership',
          entityId: `${chamaId}:${applicantId}`,
          action: 'CREATE',
        },
      });

      expect(auditLog).toBeDefined();
      expect((auditLog?.newValues as any)?.termsAgreed).toBe(true);
    });
  });

  describe('Membership Application Process', () => {
    it('should create membership with PENDING status', async () => {
      const membership = await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true,
        'I am interested in joining'
      );

      expect(membership.status).toBe(MemberStatus.PENDING);
      expect(membership.role).toBe(MemberRole.MEMBER);
    });

    it('should prevent duplicate applications', async () => {
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true
      );

      await expect(
        ChamaService.joinChama(
          applicantId,
          chamaId,
          shareableLink,
          true
        )
      ).rejects.toThrow('Membership application already pending approval');
    });

    it('should notify leadership of new application', async () => {
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true,
        'Please accept my application'
      );

      // Check that notification was created for founder
      const notification = await prisma.notification.findFirst({
        where: {
          recipientId: founderId,
          chamaId,
          title: { contains: 'Membership Application' },
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.message).toContain('has applied to join');
    });

    it('should include application message in notification', async () => {
      const applicationMessage = 'I have experience with savings groups';
      
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true,
        applicationMessage
      );

      const notification = await prisma.notification.findFirst({
        where: {
          recipientId: founderId,
          chamaId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(notification?.message).toContain(applicationMessage);
    });
  });

  describe('Application Approval', () => {
    beforeEach(async () => {
      // Create a pending application
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true
      );
    });

    it('should approve membership application', async () => {
      const approvedMembership = await ChamaService.approveMembershipApplication(
        chamaId,
        applicantId,
        founderId,
        'Welcome to the chama'
      );

      expect(approvedMembership.status).toBe(MemberStatus.ACTIVE);
    });

    it('should notify applicant of approval', async () => {
      await ChamaService.approveMembershipApplication(
        chamaId,
        applicantId,
        founderId
      );

      const notification = await prisma.notification.findFirst({
        where: {
          recipientId: applicantId,
          chamaId,
          title: 'Membership Approved!',
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.message).toContain('approved');
    });

    it('should log approval in audit trail', async () => {
      await ChamaService.approveMembershipApplication(
        chamaId,
        applicantId,
        founderId,
        'Approved after review'
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'ChamaMembership',
          entityId: `${chamaId}:${applicantId}`,
          action: 'UPDATE',
          userId: founderId,
        },
      });

      expect(auditLog).toBeDefined();
      expect((auditLog?.oldValues as any)?.status).toBe(MemberStatus.PENDING);
      expect((auditLog?.newValues as any)?.status).toBe(MemberStatus.ACTIVE);
      expect((auditLog?.metadata as any)?.approvalNotes).toBe('Approved after review');
    });

    it('should prevent approval by non-leadership members', async () => {
      // Create another regular member
      const regularMember = await prisma.user.create({
        data: {
          email: 'regular@example.com',
          phone: '+254700000103',
          ...IdentityProtectionService.protect('ID-REGULAR-103'),
          firstName: 'Regular',
          lastName: 'Member',
          passwordHash: 'hashed_password',
          kycStatus: KycStatus.VERIFIED,
        },
      });

      await prisma.chamaMembership.create({
        data: {
          chamaId,
          userId: regularMember.id,
          role: MemberRole.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      });

      await expect(
        ChamaService.approveMembershipApplication(
          chamaId,
          applicantId,
          regularMember.id
        )
      ).rejects.toThrow('Insufficient permissions');

      // Cleanup
      await prisma.chamaMembership.delete({
        where: {
          chamaId_userId: {
            chamaId,
            userId: regularMember.id,
          },
        },
      });
      await prisma.user.delete({ where: { id: regularMember.id } });
    });

    it('should check member limit before approval', async () => {
      // Update chama to have max 2 members (founder + 1)
      await prisma.chama.update({
        where: { id: chamaId },
        data: { maxMembers: 2 },
      });

      // Create another active member
      const anotherMember = await prisma.user.create({
        data: {
          email: 'another@example.com',
          phone: '+254700000104',
          ...IdentityProtectionService.protect('ID-ANOTHER-104'),
          firstName: 'Another',
          lastName: 'Member',
          passwordHash: 'hashed_password',
          kycStatus: KycStatus.VERIFIED,
        },
      });

      await prisma.chamaMembership.create({
        data: {
          chamaId,
          userId: anotherMember.id,
          role: MemberRole.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      });

      // Now try to approve the applicant (would exceed limit)
      await expect(
        ChamaService.approveMembershipApplication(
          chamaId,
          applicantId,
          founderId
        )
      ).rejects.toThrow('Chama is at maximum capacity');

      // Cleanup
      await prisma.chamaMembership.delete({
        where: {
          chamaId_userId: {
            chamaId,
            userId: anotherMember.id,
          },
        },
      });
      await prisma.user.delete({ where: { id: anotherMember.id } });
    });
  });

  describe('Application Rejection', () => {
    beforeEach(async () => {
      // Create a pending application
      await ChamaService.joinChama(
        applicantId,
        chamaId,
        shareableLink,
        true
      );
    });

    it('should reject membership application', async () => {
      const result = await ChamaService.rejectMembershipApplication(
        chamaId,
        applicantId,
        founderId,
        'Not enough experience with savings groups'
      );

      expect(result.success).toBe(true);

      // Verify membership was deleted
      const membership = await prisma.chamaMembership.findUnique({
        where: {
          chamaId_userId: {
            chamaId,
            userId: applicantId,
          },
        },
      });

      expect(membership).toBeNull();
    });

    it('should notify applicant of rejection', async () => {
      await ChamaService.rejectMembershipApplication(
        chamaId,
        applicantId,
        founderId,
        'Application does not meet requirements'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          recipientId: applicantId,
          chamaId,
          title: 'Membership Application Update',
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.message).toContain('not approved');
      expect(notification?.message).toContain('Application does not meet requirements');
    });

    it('should log rejection in audit trail', async () => {
      const rejectionReason = 'Incomplete KYC information';
      
      await ChamaService.rejectMembershipApplication(
        chamaId,
        applicantId,
        founderId,
        rejectionReason
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'ChamaMembership',
          entityId: `${chamaId}:${applicantId}`,
          action: 'DELETE',
          userId: founderId,
        },
      });

      expect(auditLog).toBeDefined();
      expect((auditLog?.metadata as any)?.rejectionReason).toBe(rejectionReason);
    });
  });

  describe('Get Pending Applications', () => {
    it('should retrieve all pending applications', async () => {
      // Create multiple applications
      const applicant2 = await prisma.user.create({
        data: {
          email: 'applicant2@example.com',
          phone: '+254700000105',
          ...IdentityProtectionService.protect('ID-APPLICANT-105'),
          firstName: 'Second',
          lastName: 'Applicant',
          passwordHash: 'hashed_password',
          kycStatus: KycStatus.VERIFIED,
        },
      });

      await ChamaService.joinChama(applicantId, chamaId, shareableLink, true, 'First application');
      await ChamaService.joinChama(applicant2.id, chamaId, shareableLink, true, 'Second application');

      const applications = await ChamaService.getPendingApplications(chamaId, founderId);

      expect(applications).toHaveLength(2);
      expect(applications[0]?.status).toBe(MemberStatus.PENDING);
      expect(applications[1]?.status).toBe(MemberStatus.PENDING);

      // Cleanup
      await prisma.chamaMembership.deleteMany({
        where: { userId: applicant2.id },
      });
      await prisma.user.delete({ where: { id: applicant2.id } });
    });

    it('should include applicant details and KYC status', async () => {
      await ChamaService.joinChama(applicantId, chamaId, shareableLink, true);

      const applications = await ChamaService.getPendingApplications(chamaId, founderId);

      expect(applications[0]?.user).toBeDefined();
      expect(applications[0]?.user.email).toBe('applicant-test@example.com');
      expect(applications[0]?.user.kycStatus).toBe(KycStatus.VERIFIED);
    });

    it('should prevent non-leadership from viewing applications', async () => {
      const regularMember = await prisma.user.create({
        data: {
          email: 'regular2@example.com',
          phone: '+254700000106',
          ...IdentityProtectionService.protect('ID-REGULAR-106'),
          firstName: 'Regular',
          lastName: 'Member',
          passwordHash: 'hashed_password',
          kycStatus: KycStatus.VERIFIED,
        },
      });

      await prisma.chamaMembership.create({
        data: {
          chamaId,
          userId: regularMember.id,
          role: MemberRole.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      });

      await expect(
        ChamaService.getPendingApplications(chamaId, regularMember.id)
      ).rejects.toThrow('Insufficient permissions');

      // Cleanup
      await prisma.chamaMembership.delete({
        where: {
          chamaId_userId: {
            chamaId,
            userId: regularMember.id,
          },
        },
      });
      await prisma.user.delete({ where: { id: regularMember.id } });
    });
  });

  describe('Member Invitations', () => {
    it('should send invitations to existing users', async () => {
      const invitee = await prisma.user.create({
        data: {
          email: 'invitee@example.com',
          phone: '+254700000107',
          ...IdentityProtectionService.protect('ID-INVITEE-107'),
          firstName: 'Invited',
          lastName: 'User',
          passwordHash: 'hashed_password',
          kycStatus: KycStatus.VERIFIED,
        },
      });

      const invitations = await ChamaService.inviteMembers(
        chamaId,
        ['invitee@example.com'],
        'Join our savings group!',
        founderId
      );

      expect(invitations).toHaveLength(1);
      expect(invitations[0]?.status).toBe('NOTIFIED');

      // Verify notification was created
      const notification = await prisma.notification.findFirst({
        where: {
          recipientId: invitee.id,
          chamaId,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.message).toContain('invited to join');

      // Cleanup
      await prisma.user.delete({ where: { id: invitee.id } });
    });

    it('should handle invitations to non-existent users', async () => {
      const invitations = await ChamaService.inviteMembers(
        chamaId,
        ['nonexistent@example.com'],
        'Join us!',
        founderId
      );

      expect(invitations).toHaveLength(1);
      expect(invitations[0]?.status).toBe('EMAIL_SENT');
    });
  });
});
