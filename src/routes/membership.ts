/**
 * Membership Routes - Multi-Chama membership management endpoints
 * 
 * Provides endpoints for:
 * - Unified dashboard for multiple Chama participations
 * - Role assignment and status tracking per Chama
 * - Membership history and reliability scoring
 * 
 * Requirements: 2.2, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { MembershipService } from '../services/membershipService';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { 
  BadRequestError, 
  NotFoundError 
} from '../middleware/errorHandler';
import { auditLog, logger } from '../config/logger';
import { MemberRole, MemberStatus, ChamaType } from '@prisma/client';

const router = Router();

// Validation schemas
const updateRoleSchema = z.object({
  newRole: z.enum(['FOUNDER', 'CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR', 'MEMBER']),
  reason: z.string().optional(),
});

const updateStatusSchema = z.object({
  newStatus: z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED']),
  reason: z.string().optional(),
});

const membershipFiltersSchema = z.object({
  status: z.array(z.enum(['INVITATION_SENT', 'PENDING_APPROVAL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXITED', 'ARCHIVED'])).optional(),
  role: z.array(z.enum(['FOUNDER', 'CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR', 'MEMBER'])).optional(),
  chamaType: z.array(z.enum(['ROSCA', 'ASCA', 'NORMAL'])).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

/**
 * GET /membership/dashboard
 * Get unified dashboard showing all Chama participations for the current user
 */
router.get('/dashboard', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const dashboard = await MembershipService.getUnifiedDashboard(req.user.id);

  logger.info('Unified dashboard retrieved', {
    userId: req.user.id,
    totalChamas: dashboard.totalChamas,
  });

  res.json({
    dashboard,
  });
}));

/**
 * GET /membership/chama/:chamaId/summary
 * Get dashboard summary for a specific Chama
 */
router.get('/chama/:chamaId/summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId } = req.params;
  if (!chamaId) {
    throw new BadRequestError('Chama ID is required');
  }

  const summary = await MembershipService.getChamaDashboardSummary(req.user.id, chamaId);

  logger.info('Chama dashboard summary retrieved', {
    userId: req.user.id,
    chamaId,
  });

  res.json({
    summary,
  });
}));

/**
 * POST /membership/chama/:chamaId/switch
 * Switch active Chama context
 */
router.post('/chama/:chamaId/switch', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId } = req.params;
  if (!chamaId) {
    throw new BadRequestError('Chama ID is required');
  }

  const dashboard = await MembershipService.switchChamaContext(req.user.id, chamaId);

  logger.info('Chama context switched', {
    userId: req.user.id,
    chamaId,
  });

  res.json({
    message: 'Chama context switched successfully',
    dashboard,
  });
}));

/**
 * GET /membership/list
 * Get all memberships for the current user with filtering and pagination
 */
router.get('/list', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  // Parse query parameters
  const filters = membershipFiltersSchema.parse({
    status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : undefined,
    role: req.query.role ? (Array.isArray(req.query.role) ? req.query.role : [req.query.role]) : undefined,
    chamaType: req.query.chamaType ? (Array.isArray(req.query.chamaType) ? req.query.chamaType : [req.query.chamaType]) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  });

  const result = await MembershipService.getUserMemberships(
    req.user.id,
    {
      status: filters.status as MemberStatus[] | undefined,
      role: filters.role as MemberRole[] | undefined,
      chamaType: filters.chamaType as ChamaType[] | undefined,
    },
    filters.page,
    filters.limit
  );

  logger.info('User memberships retrieved', {
    userId: req.user.id,
    total: result.pagination.total,
    page: filters.page,
  });

  res.json(result);
}));

/**
 * PUT /membership/chama/:chamaId/member/:userId/role
 * Update member role in a Chama (requires FOUNDER or CHAIR role)
 */
router.put('/chama/:chamaId/member/:userId/role', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId, userId } = req.params;
  if (!chamaId || !userId) {
    throw new BadRequestError('Chama ID and User ID are required');
  }

  const { newRole, reason } = updateRoleSchema.parse(req.body);

  await MembershipService.updateMemberRole(
    chamaId,
    userId,
    newRole as MemberRole,
    req.user.id,
    reason
  );

  // Log role update
  auditLog('UPDATE', req.user.id, chamaId, {
    action: 'MEMBER_ROLE_UPDATED',
    targetUserId: userId,
    newRole,
    reason,
  });

  logger.info('Member role updated', {
    chamaId,
    userId,
    newRole,
    updatedBy: req.user.id,
  });

  res.json({
    message: 'Member role updated successfully',
  });
}));

/**
 * PUT /membership/chama/:chamaId/member/:userId/status
 * Update member status in a Chama (requires FOUNDER or CHAIR role)
 */
router.put('/chama/:chamaId/member/:userId/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId, userId } = req.params;
  if (!chamaId || !userId) {
    throw new BadRequestError('Chama ID and User ID are required');
  }

  const { newStatus, reason } = updateStatusSchema.parse(req.body);

  await MembershipService.updateMemberStatus(
    chamaId,
    userId,
    newStatus as MemberStatus,
    req.user.id,
    reason
  );

  // Log status update
  auditLog('UPDATE', req.user.id, chamaId, {
    action: 'MEMBER_STATUS_UPDATED',
    targetUserId: userId,
    newStatus,
    reason,
  });

  logger.info('Member status updated', {
    chamaId,
    userId,
    newStatus,
    updatedBy: req.user.id,
  });

  res.json({
    message: 'Member status updated successfully',
  });
}));

/**
 * GET /membership/chama/:chamaId/history
 * Get membership history for the current user in a specific Chama
 */
router.get('/chama/:chamaId/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId } = req.params;
  if (!chamaId) {
    throw new BadRequestError('Chama ID is required');
  }

  const history = await MembershipService.getMembershipHistory(req.user.id, chamaId);

  logger.info('Membership history retrieved', {
    userId: req.user.id,
    chamaId,
    eventsCount: history.events.length,
  });

  res.json({
    history,
  });
}));

/**
 * GET /membership/chama/:chamaId/member/:userId/history
 * Get membership history for a specific member (requires appropriate permissions)
 */
router.get('/chama/:chamaId/member/:userId/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId, userId } = req.params;
  if (!chamaId || !userId) {
    throw new BadRequestError('Chama ID and User ID are required');
  }

  // Verify requester has permission (is a member of the Chama)
  const requesterSummary = await MembershipService.getChamaDashboardSummary(req.user.id, chamaId);
  
  if (!requesterSummary) {
    throw new NotFoundError('Membership not found');
  }

  const history = await MembershipService.getMembershipHistory(userId, chamaId);

  logger.info('Member history retrieved', {
    requesterId: req.user.id,
    targetUserId: userId,
    chamaId,
    eventsCount: history.events.length,
  });

  res.json({
    history,
  });
}));

/**
 * GET /membership/chama/:chamaId/reliability-score
 * Get reliability score breakdown for the current user in a specific Chama
 */
router.get('/chama/:chamaId/reliability-score', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId } = req.params;
  if (!chamaId) {
    throw new BadRequestError('Chama ID is required');
  }

  const scoreBreakdown = await MembershipService.getReliabilityScoreBreakdown(req.user.id, chamaId);

  logger.info('Reliability score retrieved', {
    userId: req.user.id,
    chamaId,
    score: scoreBreakdown.currentScore,
  });

  res.json({
    scoreBreakdown,
  });
}));

/**
 * GET /membership/chama/:chamaId/member/:userId/reliability-score
 * Get reliability score breakdown for a specific member (requires appropriate permissions)
 */
router.get('/chama/:chamaId/member/:userId/reliability-score', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId, userId } = req.params;
  if (!chamaId || !userId) {
    throw new BadRequestError('Chama ID and User ID are required');
  }

  // Verify requester has permission (is a member of the Chama)
  const requesterSummary = await MembershipService.getChamaDashboardSummary(req.user.id, chamaId);
  
  if (!requesterSummary) {
    throw new NotFoundError('Membership not found');
  }

  const scoreBreakdown = await MembershipService.getReliabilityScoreBreakdown(userId, chamaId);

  logger.info('Member reliability score retrieved', {
    requesterId: req.user.id,
    targetUserId: userId,
    chamaId,
    score: scoreBreakdown.currentScore,
  });

  res.json({
    scoreBreakdown,
  });
}));

/**
 * POST /membership/chama/:chamaId/recalculate-scores
 * Recalculate reliability scores for all members in a Chama (requires CHAIR or TREASURER role)
 */
router.post('/chama/:chamaId/recalculate-scores', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new BadRequestError('User not found');
  }

  const { chamaId } = req.params;
  if (!chamaId) {
    throw new BadRequestError('Chama ID is required');
  }

  // Verify requester has permission
  const requesterSummary = await MembershipService.getChamaDashboardSummary(req.user.id, chamaId);
  
  if (!['FOUNDER', 'CHAIR', 'TREASURER'].includes(requesterSummary.role)) {
    throw new BadRequestError('Insufficient permissions to recalculate scores');
  }

  // Get all active members
  const { prisma } = await import('../config/database');
  const members = await prisma.chamaMembership.findMany({
    where: {
      chamaId,
      status: 'ACTIVE',
    },
    select: {
      userId: true,
    },
  });

  // Recalculate scores for all members
  const results = await Promise.allSettled(
    members.map(member => 
      MembershipService.calculateReliabilityScore(member.userId, chamaId)
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  // Log recalculation
  auditLog('UPDATE', req.user.id, chamaId, {
    action: 'RELIABILITY_SCORES_RECALCULATED',
    totalMembers: members.length,
    successful,
    failed,
  });

  logger.info('Reliability scores recalculated', {
    chamaId,
    requesterId: req.user.id,
    totalMembers: members.length,
    successful,
    failed,
  });

  res.json({
    message: 'Reliability scores recalculated',
    results: {
      total: members.length,
      successful,
      failed,
    },
  });
}));

export { router as membershipRouter };
