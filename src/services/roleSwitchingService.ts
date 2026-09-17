import { MemberRole } from '@prisma/client';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { logger, auditLog } from '../config/logger';
import { PermissionService } from './permissionService';
import { 
  BadRequestError, 
  ForbiddenError, 
  NotFoundError 
} from '../middleware/errorHandler';

// Role switching context
export interface RoleSwitchContext {
  userId: string;
  fromChamaId?: string;
  toChamaId: string;
  requestedRole?: MemberRole;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Active Chama session
export interface ActiveChamaSession {
  userId: string;
  chamaId: string;
  role: MemberRole;
  switchedAt: Date;
  sessionId: string;
  permissions: string[]; // Cached permissions
}

// Role switch request (for approval workflows)
export interface RoleSwitchRequest {
  id: string;
  userId: string;
  chamaId: string;
  currentRole: MemberRole;
  requestedRole: MemberRole;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export class RoleSwitchingService {
  private static readonly ACTIVE_CHAMA_PREFIX = 'active_chama:';
  private static readonly SWITCH_REQUEST_PREFIX = 'switch_request:';
  private static readonly SESSION_TTL = 24 * 60 * 60; // 24 hours

  /**
   * Switch user's active Chama context
   */
  static async switchChamaContext(context: RoleSwitchContext): Promise<ActiveChamaSession> {
    const { userId, toChamaId, sessionId, ipAddress, userAgent } = context;

    // Validate user membership in target Chama
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: toChamaId,
          userId,
        },
      },
      select: {
        role: true,
        status: true,
        chama: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError('User is not a member of the target Chama');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenError(`Membership status is ${membership.status}`);
    }

    if (membership.chama.status !== 'ACTIVE') {
      throw new ForbiddenError(`Chama status is ${membership.chama.status}`);
    }

    // Get user permissions in the new Chama
    const permissions = await PermissionService.getUserPermissions(userId, toChamaId);

    // Create active session
    const activeSession: ActiveChamaSession = {
      userId,
      chamaId: toChamaId,
      role: membership.role,
      switchedAt: new Date(),
      sessionId,
      permissions: permissions.map(p => p.toString()),
    };

    // Store in Redis
    const cacheKey = `${this.ACTIVE_CHAMA_PREFIX}${userId}:${sessionId}`;
    await RedisService.set(cacheKey, activeSession, this.SESSION_TTL);

    // Log the context switch
    auditLog('UPDATE', userId, toChamaId, {
      action: 'CHAMA_CONTEXT_SWITCH',
      fromChamaId: context.fromChamaId,
      toChamaId,
      role: membership.role,
      ipAddress,
      userAgent,
    });

    logger.info('User switched Chama context', {
      userId,
      fromChamaId: context.fromChamaId,
      toChamaId,
      role: membership.role,
      sessionId,
    });

    return activeSession;
  }

  /**
   * Get user's active Chama context
   */
  static async getActiveChamaContext(
    userId: string,
    sessionId: string
  ): Promise<ActiveChamaSession | null> {
    const cacheKey = `${this.ACTIVE_CHAMA_PREFIX}${userId}:${sessionId}`;
    return RedisService.get<ActiveChamaSession>(cacheKey, true);
  }

  /**
   * Get all Chamas a user can switch to
   */
  static async getAvailableChamas(userId: string): Promise<{
    chamaId: string;
    name: string;
    type: string;
    role: MemberRole;
    status: string;
    memberCount: number;
    canSwitch: boolean;
    switchReason?: string;
  }[]> {
    const memberships = await prisma.chamaMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        role: true,
        status: true,
        chama: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            _count: {
              select: {
                memberships: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map(membership => ({
      chamaId: membership.chama.id,
      name: membership.chama.name,
      type: membership.chama.type,
      role: membership.role,
      status: membership.chama.status,
      memberCount: membership.chama._count.memberships,
      canSwitch: membership.chama.status === 'ACTIVE',
      switchReason: membership.chama.status !== 'ACTIVE' 
        ? `Chama is ${membership.chama.status}` 
        : undefined,
    }));
  }

  /**
   * Request role change within a Chama (for approval workflow)
   */
  static async requestRoleChange(
    userId: string,
    chamaId: string,
    requestedRole: MemberRole,
    reason: string
  ): Promise<RoleSwitchRequest> {
    // Validate current membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
      select: {
        role: true,
        status: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Only active members can request role changes');
    }

    if (membership.role === requestedRole) {
      throw new BadRequestError('Requested role is the same as current role');
    }

    // Check if user can request this role change
    const canRequest = await this.canRequestRoleChange(
      membership.role,
      requestedRole,
      chamaId
    );

    if (!canRequest.allowed) {
      throw new ForbiddenError(canRequest.reason || 'Role change not allowed');
    }

    // Create role switch request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const switchRequest: RoleSwitchRequest = {
      id: requestId,
      userId,
      chamaId,
      currentRole: membership.role,
      requestedRole,
      reason,
      status: 'PENDING',
      requestedAt: new Date(),
    };

    // Store in Redis (in production, you might want to use database)
    const cacheKey = `${this.SWITCH_REQUEST_PREFIX}${requestId}`;
    await RedisService.set(cacheKey, switchRequest, 7 * 24 * 60 * 60); // 7 days

    // Log the request
    auditLog('CREATE', userId, chamaId, {
      action: 'ROLE_CHANGE_REQUESTED',
      currentRole: membership.role,
      requestedRole,
      reason,
      requestId,
    });

    logger.info('Role change requested', {
      userId,
      chamaId,
      currentRole: membership.role,
      requestedRole,
      requestId,
    });

    return switchRequest;
  }

  /**
   * Approve or reject role change request
   */
  static async reviewRoleChangeRequest(
    requestId: string,
    reviewerId: string,
    approved: boolean,
    reviewNotes?: string
  ): Promise<RoleSwitchRequest> {
    // Get the request
    const cacheKey = `${this.SWITCH_REQUEST_PREFIX}${requestId}`;
    const request = await RedisService.get<RoleSwitchRequest>(cacheKey, true);

    if (!request) {
      throw new NotFoundError('Role change request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestError('Request has already been reviewed');
    }

    // Verify reviewer has permission
    const hasPermission = await PermissionService.hasPermission(
      reviewerId,
      request.chamaId,
      'MANAGE_MEMBERS' as any
    );

    if (!hasPermission.granted) {
      throw new ForbiddenError('Insufficient permissions to review role change requests');
    }

    // Update request
    request.status = approved ? 'APPROVED' : 'REJECTED';
    request.reviewedAt = new Date();
    request.reviewedBy = reviewerId;
    request.reviewNotes = reviewNotes;

    // If approved, update the membership
    if (approved) {
      await prisma.chamaMembership.update({
        where: {
          chamaId_userId: {
            chamaId: request.chamaId,
            userId: request.userId,
          },
        },
        data: {
          role: request.requestedRole,
        },
      });

      // Invalidate permission cache
      await PermissionService.invalidateUserPermissionCache(
        request.userId,
        request.chamaId
      );
    }

    // Update request in cache
    await RedisService.set(cacheKey, request, 7 * 24 * 60 * 60);

    // Log the review
    auditLog(approved ? 'UPDATE' : 'DELETE', request.userId, request.chamaId, {
      action: approved ? 'ROLE_CHANGE_APPROVED' : 'ROLE_CHANGE_REJECTED',
      requestId,
      reviewerId,
      reviewNotes,
      newRole: approved ? request.requestedRole : undefined,
    });

    logger.info('Role change request reviewed', {
      requestId,
      approved,
      reviewerId,
      userId: request.userId,
      chamaId: request.chamaId,
    });

    return request;
  }

  /**
   * Get pending role change requests for a Chama
   */
  static async getPendingRoleChangeRequests(chamaId: string): Promise<RoleSwitchRequest[]> {
    // In a production system, you'd query the database
    // For now, this is a simplified implementation
    // You would need to maintain an index of requests by Chama
    
    logger.info('Getting pending role change requests', { chamaId });
    
    // Return empty array for now - in production, implement proper storage
    return [];
  }

  /**
   * Clear active Chama context (logout)
   */
  static async clearActiveChamaContext(userId: string, sessionId: string): Promise<void> {
    const cacheKey = `${this.ACTIVE_CHAMA_PREFIX}${userId}:${sessionId}`;
    await RedisService.del(cacheKey);

    logger.info('Active Chama context cleared', { userId, sessionId });
  }

  /**
   * Check if a role change request is allowed
   */
  private static async canRequestRoleChange(
    currentRole: MemberRole,
    requestedRole: MemberRole,
    chamaId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Founders cannot change roles (they created the Chama)
    if (currentRole === 'FOUNDER') {
      return {
        allowed: false,
        reason: 'Founders cannot change their role',
      };
    }

    // Cannot request to become founder
    if (requestedRole === 'FOUNDER') {
      return {
        allowed: false,
        reason: 'Cannot request to become founder',
      };
    }

    // Check if the requested role is already taken (for unique roles)
    const uniqueRoles: MemberRole[] = ['CHAIR', 'TREASURER', 'SECRETARY'];
    
    if (uniqueRoles.includes(requestedRole)) {
      const existingMember = await prisma.chamaMembership.findFirst({
        where: {
          chamaId,
          role: requestedRole,
          status: 'ACTIVE',
        },
      });

      if (existingMember) {
        return {
          allowed: false,
          reason: `Role ${requestedRole} is already assigned to another member`,
        };
      }
    }

    // Members can request any role except founder
    // Other roles can request any role except founder
    return { allowed: true };
  }

  /**
   * Get user's role switching history
   */
  static async getRoleSwitchingHistory(
    userId: string,
    chamaId?: string,
    limit: number = 50
  ): Promise<{
    action: string;
    chamaId?: string;
    chamaName?: string;
    fromRole?: MemberRole;
    toRole?: MemberRole;
    timestamp: Date;
    ipAddress?: string;
  }[]> {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        chamaId,
        action: {
          in: ['UPDATE', 'CREATE'], // Use existing audit actions
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return auditLogs.map(log => ({
      action: log.action,
      chamaId: log.chamaId || undefined,
      chamaName: undefined, // Would need to join with chama table
      fromRole: (log.metadata as any)?.fromRole,
      toRole: (log.metadata as any)?.toRole || (log.metadata as any)?.role,
      timestamp: log.createdAt,
      ipAddress: log.ipAddress || undefined,
    }));
  }

  /**
   * Validate session and refresh active context if needed
   */
  static async validateAndRefreshContext(
    userId: string,
    sessionId: string,
    chamaId?: string
  ): Promise<ActiveChamaSession | null> {
    const activeContext = await this.getActiveChamaContext(userId, sessionId);

    // If no active context and chamaId provided, try to create one
    if (!activeContext && chamaId) {
      try {
        return await this.switchChamaContext({
          userId,
          toChamaId: chamaId,
          sessionId,
        });
      } catch (error) {
        logger.warn('Failed to create Chama context', {
          userId,
          chamaId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    }

    // If active context exists but for different Chama, switch if requested
    if (activeContext && chamaId && activeContext.chamaId !== chamaId) {
      try {
        return await this.switchChamaContext({
          userId,
          fromChamaId: activeContext.chamaId,
          toChamaId: chamaId,
          sessionId,
        });
      } catch (error) {
        logger.warn('Failed to switch Chama context', {
          userId,
          fromChamaId: activeContext.chamaId,
          toChamaId: chamaId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return activeContext; // Return existing context if switch fails
      }
    }

    return activeContext;
  }
}