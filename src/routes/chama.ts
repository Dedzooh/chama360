// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ChamaService } from '../services/chamaService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/auth';
import {
  BadRequestError,
  NotFoundError 
} from '../middleware/errorHandler';
import { auditLog, logger } from '../config/logger';
import { MemberRole } from '@prisma/client';
import {
  createChamaSchema,
  updateChamaSchema,
  joinChamaSchema,
  inviteMembersSchema,
  chamaSearchSchema,
  approveMembershipSchema,
  rejectMembershipSchema,
} from '../schemas/chama';

// Membership update schema
const updateMembershipSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID'),
  memberId: z.string().cuid('Invalid member ID'),
  role: z.nativeEnum(MemberRole).optional(),
  status: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']).optional(),
});

const router = Router();

/**
 * POST /chama/create
 * Create a new Chama
 */
router.post('/create',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const chamaData = createChamaSchema.parse(req.body);

    const chama = await ChamaService.createChama(req.user.id, chamaData);
    const organizationProfile = (chama.settings as any) || {};

    // Audit log
    auditLog('CREATE', chama.id, req.user.id, {
      action: 'CHAMA_CREATED',
      chamaType: chama.type,
      organizationKind: organizationProfile.organizationKind || chamaData.organizationKind,
      organizationLabel: organizationProfile.organizationLabel || chamaData.settings.organizationLabel,
      visibility: chama.visibility,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('New chama created', {
      chamaId: chama.id,
      founderId: req.user.id,
      type: chama.type,
      organizationKind: organizationProfile.organizationKind || chamaData.organizationKind,
    });

    res.status(201).json({
      message: 'Chama created successfully',
      chama: {
        id: chama.id,
        name: chama.name,
        organizationKind: organizationProfile.organizationKind || chamaData.organizationKind,
        organizationLabel: organizationProfile.organizationLabel || chamaData.settings.organizationLabel,
        type: chama.type,
        status: chama.status,
        shareableLink: chama.shareableLink,
        qrCode: chama.qrCode,
        createdAt: chama.createdAt,
      },
    });
  })
);

/**
 * GET /chama/public
 * Get public chamas for browsing with advanced filtering
 * Requirements: 6.1, 6.2
 */
router.get('/public',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const searchParams = chamaSearchSchema.parse({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string,
      type: req.query.type as any,
      minContribution: req.query.minContribution ? parseFloat(req.query.minContribution as string) : undefined,
      maxContribution: req.query.maxContribution ? parseFloat(req.query.maxContribution as string) : undefined,
      frequency: req.query.frequency as any,
      visibility: req.query.visibility as any,
    });

    const result = await ChamaService.getPublicChamas(
      searchParams.page,
      searchParams.limit,
      {
        search: searchParams.search,
        type: searchParams.type,
        minContribution: searchParams.minContribution,
        maxContribution: searchParams.maxContribution,
        frequency: searchParams.frequency,
      }
    );

    res.json(result);
  })
);

/**
 * GET /chama/recommendations
 * Get personalized Chama recommendations
 * Requirements: 6.3
 */
router.get('/recommendations',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const recommendations = await ChamaService.getRecommendedChamas(req.user.id, limit);

    res.json({
      recommendations,
      count: recommendations.length,
    });
  })
);

/**
 * GET /chama/featured
 * Get featured/successful Chamas
 * Requirements: 6.5
 */
router.get('/featured',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 5;
    const featured = await ChamaService.getFeaturedChamas(limit);

    res.json({
      featured,
      count: featured.length,
    });
  })
);

/**
 * GET /chama/invite/:shareableLink
 * Resolve invitation link to chama details
 */
router.get('/invite/:shareableLink',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { shareableLink } = req.params;

    if (!shareableLink) {
      throw new BadRequestError('Invitation link is required');
    }

    const chama = await ChamaService.getChamaByShareableLink(shareableLink);
    res.json({ chama });
  })
);

/**
 * POST /chama/:chamaId/bookmark
 * Bookmark a Chama for later
 * Requirements: 6.4
 */
router.post('/:chamaId/bookmark',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const result = await ChamaService.bookmarkChama(req.user.id, chamaId);

    // Audit log
    auditLog('CREATE', chamaId, req.user.id, {
      action: 'CHAMA_BOOKMARKED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json(result);
  })
);

/**
 * GET /chama/:chamaId
 * Get chama details
 */
router.get('/:chamaId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const chama = await ChamaService.getChamaDetails(chamaId, req.user.id);

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    res.json({ chama });
  })
);

/**
 * PUT /chama/:chamaId
 * Update chama settings
 */
router.put('/:chamaId',
  authenticate,
  requireRole('FOUNDER', 'CHAIR'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const updateData = updateChamaSchema.parse(req.body);

    const chama = await ChamaService.updateChama(chamaId, updateData, req.user.id);

    // Audit log
    auditLog('UPDATE', chamaId || 'unknown', req.user.id, {
      action: 'CHAMA_UPDATED',
      changes: updateData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Chama updated successfully',
      chama,
    });
  })
);

/**
 * POST /chama/join
 * Join a chama (creates membership application)
 * Requirements: 3.1, 3.2, 3.3
 */
router.post('/:chamaId/activate',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const chama = await ChamaService.activateChama(chamaId, req.user.id);

    auditLog('UPDATE', chamaId, req.user.id, {
      action: 'CHAMA_ACTIVATED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Chama activated successfully',
      chama,
    });
  })
);

router.post('/:chamaId/suspend',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const chama = await ChamaService.suspendChama(chamaId, req.user.id);

    auditLog('UPDATE', chamaId, req.user.id, {
      action: 'CHAMA_SUSPENDED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Chama suspended successfully',
      chama,
    });
  })
);

router.post('/:chamaId/archive',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const chama = await ChamaService.archiveChama(chamaId, req.user.id);

    auditLog('UPDATE', chamaId, req.user.id, {
      action: 'CHAMA_ARCHIVED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Chama archived successfully',
      chama,
    });
  })
);
router.post('/join',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId, shareableLink, termsAgreed, applicationMessage } = joinChamaSchema.parse(req.body);

    const membership = await ChamaService.joinChama(
      req.user.id, 
      chamaId, 
      shareableLink,
      termsAgreed,
      applicationMessage
    );

    // Audit log
    auditLog('CREATE', membership.chamaId + ':' + membership.userId, req.user.id, {
      action: 'MEMBERSHIP_APPLICATION_SUBMITTED',
      chamaId,
      termsAgreed,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Membership application submitted', {
      userId: req.user.id,
      chamaId,
      membershipId: membership.chamaId + ':' + membership.userId,
      status: membership.status,
    });

    res.status(201).json({
      message: membership.status === 'PENDING' 
        ? 'Membership application submitted successfully. Awaiting approval from Chama leadership.'
        : 'Successfully joined chama',
      membership: {
        id: membership.chamaId + ':' + membership.userId,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      },
    });
  })
);

/**
 * POST /chama/:chamaId/invite
 * Invite members to chama (Chair/Founder only)
 */
router.post('/:chamaId/invite',
  authenticate,
  requireRole('FOUNDER', 'CHAIR'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;
    
    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const { emails, message } = inviteMembersSchema.parse(req.body);

    const invitations = await ChamaService.inviteMembers(chamaId, emails, message || '', req.user.id);

    // Audit log
    auditLog('CREATE', chamaId, req.user.id, {
      action: 'MEMBERS_INVITED',
      invitedCount: emails.length,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: `Invitations sent to ${emails.length} members`,
      invitations,
    });
  })
);

/**
 * GET /chama/:chamaId/members
 * Get chama members
 */
router.get('/:chamaId/members',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const members = await ChamaService.getChamaMembers(chamaId, req.user.id, page, limit);

    res.json({ members });
  })
);

/**
 * PUT /chama/:chamaId/members/:memberId
 * Update member role/status (Chair/Founder only)
 */
router.put('/:chamaId/members/:memberId',
  authenticate,
  requireRole('FOUNDER', 'CHAIR'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId, memberId } = req.params;
    const updateData = updateMembershipSchema.parse(req.body);

    // Ensure chamaId matches
    if (updateData.chamaId !== chamaId) {
      throw new BadRequestError('Chama ID mismatch');
    }

    const membership = await ChamaService.updateMembership(`${chamaId}:${memberId}`, updateData, req.user.id);

    // Audit log
    auditLog('UPDATE', membership.chamaId + ':' + membership.userId, req.user.id, {
      action: 'MEMBERSHIP_UPDATED',
      memberId,
      changes: updateData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Membership updated successfully',
      membership,
    });
  })
);

/**
 * GET /chama/:chamaId/applications
 * Get pending membership applications (Chair/Founder/Secretary only)
 * Requirements: 3.3, 4.1
 */
router.get('/:chamaId/applications',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const applications = await ChamaService.getPendingApplications(chamaId, req.user.id);

    res.json({
      applications,
      count: applications.length,
    });
  })
);

/**
 * POST /chama/:chamaId/applications/:applicantId/approve
 * Approve a membership application (Chair/Founder/Secretary only)
 * Requirements: 3.3, 4.1
 */
router.post('/:chamaId/applications/:applicantId/approve',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId, applicantId } = req.params;

    if (!chamaId || !applicantId) {
      throw new BadRequestError('Chama ID and Applicant ID are required');
    }

    const { approvalNotes } = approveMembershipSchema.parse({
      applicantId,
      ...req.body,
    });

    const membership = await ChamaService.approveMembershipApplication(
      chamaId,
      applicantId,
      req.user.id,
      approvalNotes
    );

    // Audit log
    auditLog('UPDATE', `${chamaId}:${applicantId}`, req.user.id, {
      action: 'MEMBERSHIP_APPROVED',
      approvalNotes,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Membership application approved', {
      chamaId,
      applicantId,
      approverId: req.user.id,
    });

    res.json({
      message: 'Membership application approved successfully',
      membership: {
        id: `${membership.chamaId}:${membership.userId}`,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      },
    });
  })
);

/**
 * POST /chama/:chamaId/applications/:applicantId/reject
 * Reject a membership application (Chair/Founder/Secretary only)
 * Requirements: 3.3, 4.1
 */
router.post('/:chamaId/applications/:applicantId/reject',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId, applicantId } = req.params;

    if (!chamaId || !applicantId) {
      throw new BadRequestError('Chama ID and Applicant ID are required');
    }

    const { rejectionReason } = rejectMembershipSchema.parse({
      applicantId,
      ...req.body,
    });

    const result = await ChamaService.rejectMembershipApplication(
      chamaId,
      applicantId,
      req.user.id,
      rejectionReason
    );

    // Audit log
    auditLog('DELETE', `${chamaId}:${applicantId}`, req.user.id, {
      action: 'MEMBERSHIP_REJECTED',
      rejectionReason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Membership application rejected', {
      chamaId,
      applicantId,
      rejecterId: req.user.id,
    });

    res.json(result);
  })
);

/**
 * DELETE /chama/:chamaId/leave
 * Leave chama
 */
router.delete('/:chamaId/leave',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    await ChamaService.leaveChama(req.user.id, chamaId);

    // Audit log
    auditLog('UPDATE', chamaId, req.user.id, {
      action: 'MEMBER_LEFT',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User left chama', {
      userId: req.user.id,
      chamaId,
    });

    res.json({
      message: 'Successfully left chama',
    });
  })
);

/**
 * DELETE /chama/:chamaId
 * Close chama (Founder only)
 */
router.delete('/:chamaId',
  authenticate,
  requireRole('FOUNDER', 'CHAIR', 'SECRETARY'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    await ChamaService.closeChama(chamaId, req.user.id);

    // Audit log
    auditLog('DELETE', chamaId, req.user.id, {
      action: 'CHAMA_CLOSED',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Chama closed', {
      chamaId,
      closedBy: req.user.id,
    });

    res.json({
      message: 'Chama closed successfully',
    });
  })
);

export { router as chamaRouter };


