import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RoleSwitchingService } from '../services/roleSwitchingService';
import { PermissionService, Permission } from '../services/permissionService';
import { UnauthorizedAccessService } from '../services/unauthorizedAccessService';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  authenticate, 
  loadChamaContext, 
  allowChamaSwitch,
  requirePermission,
  requireAdminRole
} from '../middleware/auth';
import { 
  BadRequestError
} from '../middleware/errorHandler';
import { auditLog } from '../config/logger';

const router = Router();

// Validation schemas
const chamaSwitchSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID format'),
});

const roleChangeRequestSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID format'),
  requestedRole: z.enum(['CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR', 'MEMBER']),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason too long'),
});

const roleChangeReviewSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  approved: z.boolean(),
  reviewNotes: z.string().max(500, 'Review notes too long').optional(),
});

const permissionCheckSchema = z.object({
  chamaId: z.string().cuid('Invalid Chama ID format'),
  permissions: z.array(z.nativeEnum(Permission)).min(1, 'At least one permission required'),
});

/**
 * POST /role-management/switch-chama
 * Switch active Chama context
 */
router.post('/switch-chama', 
  authenticate, 
  allowChamaSwitch,
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId } = chamaSwitchSchema.parse(req.body);

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    // Switch Chama context
    const activeSession = await RoleSwitchingService.switchChamaContext({
      userId: req.user.id,
      fromChamaId: req.currentChama?.id,
      toChamaId: chamaId,
      sessionId: req.user.sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: 'Chama context switched successfully',
      activeChama: {
        id: activeSession.chamaId,
        role: activeSession.role,
        switchedAt: activeSession.switchedAt,
        permissions: activeSession.permissions,
      },
    });
  })
);

/**
 * GET /role-management/available-chamas
 * Get all Chamas a user can switch to
 */
router.get('/available-chamas', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    const availableChamas = await RoleSwitchingService.getAvailableChamas(req.user.id);

    res.json({
      chamas: availableChamas,
    });
  })
);

/**
 * GET /role-management/current-context
 * Get current active Chama context
 */
router.get('/current-context', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    const activeContext = await RoleSwitchingService.getActiveChamaContext(
      req.user.id,
      req.user.sessionId
    );

    if (!activeContext) {
      res.json({
        message: 'No active Chama context',
        activeChama: null,
      });
      return;
    }

    res.json({
      message: 'Active Chama context retrieved',
      activeChama: {
        id: activeContext.chamaId,
        role: activeContext.role,
        switchedAt: activeContext.switchedAt,
        permissions: activeContext.permissions,
      },
    });
  })
);

/**
 * POST /role-management/request-role-change
 * Request role change within a Chama
 */
router.post('/request-role-change', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId, requestedRole, reason } = roleChangeRequestSchema.parse(req.body);

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    // Create role change request
    const request = await RoleSwitchingService.requestRoleChange(
      req.user.id,
      chamaId,
      requestedRole,
      reason
    );

    res.status(201).json({
      message: 'Role change request submitted successfully',
      request: {
        id: request.id,
        currentRole: request.currentRole,
        requestedRole: request.requestedRole,
        status: request.status,
        requestedAt: request.requestedAt,
      },
    });
  })
);

/**
 * POST /role-management/review-role-change
 * Review (approve/reject) role change request
 */
router.post('/review-role-change', 
  authenticate,
  loadChamaContext(),
  requirePermission(Permission.MANAGE_MEMBERS),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, approved, reviewNotes } = roleChangeReviewSchema.parse(req.body);

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    // Review the request
    const reviewedRequest = await RoleSwitchingService.reviewRoleChangeRequest(
      requestId,
      req.user.id,
      approved,
      reviewNotes
    );

    res.json({
      message: `Role change request ${approved ? 'approved' : 'rejected'} successfully`,
      request: {
        id: reviewedRequest.id,
        status: reviewedRequest.status,
        reviewedAt: reviewedRequest.reviewedAt,
        reviewedBy: reviewedRequest.reviewedBy,
        reviewNotes: reviewedRequest.reviewNotes,
      },
    });
  })
);

/**
 * GET /role-management/pending-requests/:chamaId
 * Get pending role change requests for a Chama
 */
router.get('/pending-requests/:chamaId', 
  authenticate,
  loadChamaContext('chamaId'),
  requirePermission(Permission.MANAGE_MEMBERS),
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId } = req.params;

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    const pendingRequests = await RoleSwitchingService.getPendingRoleChangeRequests(chamaId);

    res.json({
      requests: pendingRequests,
    });
  })
);

/**
 * POST /role-management/check-permissions
 * Check user permissions for specific actions
 */
router.post('/check-permissions', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId, permissions } = permissionCheckSchema.parse(req.body);

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    // Check permissions
    const results = await PermissionService.hasPermissions(
      req.user.id,
      chamaId,
      permissions
    );

    res.json({
      chamaId,
      permissions: results,
    });
  })
);

/**
 * GET /role-management/my-permissions/:chamaId
 * Get all permissions for current user in a Chama
 */
router.get('/my-permissions/:chamaId', 
  authenticate,
  loadChamaContext('chamaId'),
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId } = req.params;

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    // Get user permissions
    const permissions = await PermissionService.getUserPermissions(req.user.id, chamaId);

    res.json({
      chamaId,
      role: req.currentChama?.role,
      permissions,
    });
  })
);

/**
 * GET /role-management/permission-summary/:chamaId
 * Get detailed permission summary for debugging (admin only)
 */
router.get('/permission-summary/:chamaId', 
  authenticate,
  loadChamaContext('chamaId'),
  requireAdminRole,
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId } = req.params;
    const { userId } = req.query;

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    if (!chamaId) {
      throw new BadRequestError('Chama ID is required');
    }

    // Use target user ID if provided (for admin debugging), otherwise use current user
    const targetUserId = (userId as string) || req.user.id;

    // Get permission summary
    const summary = await PermissionService.getPermissionSummary(targetUserId, chamaId);

    res.json({
      userId: targetUserId,
      chamaId,
      summary,
    });
  })
);

/**
 * GET /role-management/switching-history
 * Get role switching history for current user
 */
router.get('/switching-history', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { chamaId, limit } = req.query;

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    const history = await RoleSwitchingService.getRoleSwitchingHistory(
      req.user.id,
      chamaId as string,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      history,
    });
  })
);

/**
 * GET /role-management/security-alerts
 * Get security alerts (admin only)
 */
router.get('/security-alerts', 
  authenticate,
  requireAdminRole, // This requires Chama context, but for security alerts we might want system-wide access
  asyncHandler(async (req: Request, res: Response) => {
    const { severity, acknowledged, limit } = req.query;

    const alerts = await UnauthorizedAccessService.getSecurityAlerts(
      severity as any,
      acknowledged ? acknowledged === 'true' : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      alerts,
    });
  })
);

/**
 * GET /role-management/access-statistics
 * Get unauthorized access statistics (admin only)
 */
router.get('/access-statistics', 
  authenticate,
  requireAdminRole,
  asyncHandler(async (req: Request, res: Response) => {
    const { timeRange } = req.query;

    const statistics = await UnauthorizedAccessService.getAccessStatistics(
      timeRange as any
    );

    res.json({
      statistics,
    });
  })
);

/**
 * POST /role-management/acknowledge-alert
 * Acknowledge security alert (admin only)
 */
router.post('/acknowledge-alert', 
  authenticate,
  requireAdminRole,
  asyncHandler(async (req: Request, res: Response) => {
    const { alertId } = req.body;

    if (!alertId) {
      throw new BadRequestError('Alert ID is required');
    }

    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    await UnauthorizedAccessService.acknowledgeAlert(alertId, req.user.id);

    res.json({
      message: 'Security alert acknowledged successfully',
    });
  })
);

/**
 * POST /role-management/unblock-access
 * Unblock user or IP access (admin only)
 */
router.post('/unblock-access', 
  authenticate,
  requireAdminRole,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, identifier } = req.body;

    if (!type || !identifier) {
      throw new BadRequestError('Type and identifier are required');
    }

    if (!['user', 'ip'].includes(type)) {
      throw new BadRequestError('Type must be "user" or "ip"');
    }

    await UnauthorizedAccessService.unblockAccess(type, identifier);

    // Log the unblock action
    auditLog('UPDATE', req.user?.id || 'unknown', undefined, {
      action: 'ACCESS_UNBLOCKED',
      type,
      identifier,
      unblockedBy: req.user?.id,
    });

    res.json({
      message: `${type} access unblocked successfully`,
    });
  })
);

/**
 * DELETE /role-management/clear-context
 * Clear active Chama context (logout from Chama)
 */
router.delete('/clear-context', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new BadRequestError('User not found');
    }

    await RoleSwitchingService.clearActiveChamaContext(req.user.id, req.user.sessionId);

    res.json({
      message: 'Chama context cleared successfully',
    });
  })
);

export { router as roleManagementRouter };