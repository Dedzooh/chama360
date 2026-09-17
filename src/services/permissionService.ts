import { MemberRole } from '@prisma/client';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { logger } from '../config/logger';

// Permission definitions
export enum Permission {
  // Member permissions
  VIEW_CHAMA_INFO = 'VIEW_CHAMA_INFO',
  VIEW_OWN_CONTRIBUTIONS = 'VIEW_OWN_CONTRIBUTIONS',
  MAKE_CONTRIBUTIONS = 'MAKE_CONTRIBUTIONS',
  REQUEST_LOANS = 'REQUEST_LOANS',
  VIEW_OWN_LOANS = 'VIEW_OWN_LOANS',
  ATTEND_MEETINGS = 'ATTEND_MEETINGS',
  CAST_VOTES = 'CAST_VOTES',
  RAISE_DISPUTES = 'RAISE_DISPUTES',
  VIEW_OWN_PROFILE = 'VIEW_OWN_PROFILE',
  UPDATE_OWN_PROFILE = 'UPDATE_OWN_PROFILE',
  
  // Administrative permissions
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  APPROVE_MEMBERS = 'APPROVE_MEMBERS',
  SUSPEND_MEMBERS = 'SUSPEND_MEMBERS',
  VIEW_ALL_CONTRIBUTIONS = 'VIEW_ALL_CONTRIBUTIONS',
  MANAGE_CONTRIBUTIONS = 'MANAGE_CONTRIBUTIONS',
  VIEW_MEMBER_PROFILES = 'VIEW_MEMBER_PROFILES',
  
  // Financial permissions
  APPROVE_LOANS = 'APPROVE_LOANS',
  DISBURSE_LOANS = 'DISBURSE_LOANS',
  MANAGE_PAYOUTS = 'MANAGE_PAYOUTS',
  VIEW_FINANCIAL_REPORTS = 'VIEW_FINANCIAL_REPORTS',
  PROCESS_PAYMENTS = 'PROCESS_PAYMENTS',
  MANAGE_LOAN_DEFAULTS = 'MANAGE_LOAN_DEFAULTS',
  CALCULATE_SHARE_OUTS = 'CALCULATE_SHARE_OUTS',
  
  // Governance permissions
  CREATE_VOTES = 'CREATE_VOTES',
  MANAGE_VOTES = 'MANAGE_VOTES',
  SCHEDULE_MEETINGS = 'SCHEDULE_MEETINGS',
  MANAGE_MEETINGS = 'MANAGE_MEETINGS',
  RESOLVE_DISPUTES = 'RESOLVE_DISPUTES',
  VIEW_DISPUTE_DETAILS = 'VIEW_DISPUTE_DETAILS',
  
  // System permissions
  MANAGE_CHAMA_SETTINGS = 'MANAGE_CHAMA_SETTINGS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  EXPORT_DATA = 'EXPORT_DATA',
  MANAGE_NOTIFICATIONS = 'MANAGE_NOTIFICATIONS',
  VIEW_SYSTEM_REPORTS = 'VIEW_SYSTEM_REPORTS',
}

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  FOUNDER: [
    // All permissions - founders have complete control
    ...Object.values(Permission),
  ],
  
  CHAIR: [
    // Member permissions
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
    
    // Administrative permissions
    Permission.MANAGE_MEMBERS,
    Permission.APPROVE_MEMBERS,
    Permission.SUSPEND_MEMBERS,
    Permission.VIEW_ALL_CONTRIBUTIONS,
    Permission.MANAGE_CONTRIBUTIONS,
    Permission.VIEW_MEMBER_PROFILES,
    
    // Financial permissions (limited)
    Permission.APPROVE_LOANS,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.MANAGE_LOAN_DEFAULTS,
    
    // Governance permissions
    Permission.CREATE_VOTES,
    Permission.MANAGE_VOTES,
    Permission.SCHEDULE_MEETINGS,
    Permission.MANAGE_MEETINGS,
    Permission.RESOLVE_DISPUTES,
    Permission.VIEW_DISPUTE_DETAILS,
    
    // System permissions
    Permission.MANAGE_CHAMA_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_NOTIFICATIONS,
    Permission.VIEW_SYSTEM_REPORTS,
  ],
  
  TREASURER: [
    // Member permissions
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
    
    // Administrative permissions (limited)
    Permission.VIEW_ALL_CONTRIBUTIONS,
    Permission.MANAGE_CONTRIBUTIONS,
    Permission.VIEW_MEMBER_PROFILES,
    
    // Financial permissions (full)
    Permission.APPROVE_LOANS,
    Permission.DISBURSE_LOANS,
    Permission.MANAGE_PAYOUTS,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.PROCESS_PAYMENTS,
    Permission.MANAGE_LOAN_DEFAULTS,
    Permission.CALCULATE_SHARE_OUTS,
    
    // Governance permissions (limited)
    Permission.VIEW_DISPUTE_DETAILS,
    
    // System permissions (limited)
    Permission.EXPORT_DATA,
    Permission.VIEW_SYSTEM_REPORTS,
  ],
  
  SECRETARY: [
    // Member permissions
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
    
    // Administrative permissions (limited)
    Permission.VIEW_ALL_CONTRIBUTIONS,
    Permission.VIEW_MEMBER_PROFILES,
    
    // Governance permissions
    Permission.SCHEDULE_MEETINGS,
    Permission.MANAGE_MEETINGS,
    Permission.VIEW_DISPUTE_DETAILS,
    
    // System permissions (limited)
    Permission.MANAGE_NOTIFICATIONS,
    Permission.EXPORT_DATA,
  ],
  
  AUDITOR: [
    // Member permissions
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
    
    // Administrative permissions (read-only)
    Permission.VIEW_ALL_CONTRIBUTIONS,
    Permission.VIEW_MEMBER_PROFILES,
    
    // Financial permissions (read-only)
    Permission.VIEW_FINANCIAL_REPORTS,
    
    // Governance permissions
    Permission.RESOLVE_DISPUTES,
    Permission.VIEW_DISPUTE_DETAILS,
    
    // System permissions (audit focus)
    Permission.VIEW_AUDIT_LOGS,
    Permission.EXPORT_DATA,
    Permission.VIEW_SYSTEM_REPORTS,
  ],
  
  MEMBER: [
    // Basic member permissions only
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
  ],
};

// Context-specific permissions (can be overridden by Chama settings)
export interface PermissionContext {
  chamaId: string;
  userId: string;
  role: MemberRole;
  memberStatus: string;
  chamaStatus: string;
  chamaType: string;
}

// Permission check result
export interface PermissionResult {
  granted: boolean;
  reason?: string;
  requiredRole?: MemberRole[];
  context?: Record<string, any>;
}

export class PermissionService {
  private static readonly PERMISSION_CACHE_PREFIX = 'permissions:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Check if a user has a specific permission in a Chama context
   */
  static async hasPermission(
    userId: string,
    chamaId: string,
    permission: Permission
  ): Promise<PermissionResult> {
    try {
      // Get user's membership and context
      const context = await this.getUserChamaContext(userId, chamaId);
      
      if (!context) {
        return {
          granted: false,
          reason: 'User is not a member of this Chama',
        };
      }

      // Check if member is active
      if (context.memberStatus !== 'ACTIVE') {
        return {
          granted: false,
          reason: `Member status is ${context.memberStatus}`,
        };
      }

      // Check if Chama is active
      if (context.chamaStatus !== 'ACTIVE') {
        return {
          granted: false,
          reason: `Chama status is ${context.chamaStatus}`,
        };
      }

      // Get role permissions
      const rolePermissions = ROLE_PERMISSIONS[context.role] || [];
      
      // Check if role has the permission
      if (!rolePermissions.includes(permission)) {
        return {
          granted: false,
          reason: `Role ${context.role} does not have permission ${permission}`,
          requiredRole: this.getRolesWithPermission(permission),
        };
      }

      // Check context-specific restrictions
      const contextCheck = await this.checkContextualPermissions(context, permission);
      if (!contextCheck.granted) {
        return contextCheck;
      }

      return { granted: true };
    } catch (error) {
      logger.error('Permission check failed', {
        userId,
        chamaId,
        permission,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        granted: false,
        reason: 'Permission check failed',
      };
    }
  }

  /**
   * Check multiple permissions at once
   */
  static async hasPermissions(
    userId: string,
    chamaId: string,
    permissions: Permission[]
  ): Promise<Record<Permission, PermissionResult>> {
    const results: Record<Permission, PermissionResult> = {} as any;
    
    for (const permission of permissions) {
      results[permission] = await this.hasPermission(userId, chamaId, permission);
    }
    
    return results;
  }

  /**
   * Get all permissions for a user in a Chama
   */
  static async getUserPermissions(
    userId: string,
    chamaId: string
  ): Promise<Permission[]> {
    const context = await this.getUserChamaContext(userId, chamaId);
    
    if (!context || context.memberStatus !== 'ACTIVE' || context.chamaStatus !== 'ACTIVE') {
      return [];
    }

    const rolePermissions = ROLE_PERMISSIONS[context.role] || [];
    
    // Filter permissions based on contextual restrictions
    const allowedPermissions: Permission[] = [];
    
    for (const permission of rolePermissions) {
      const contextCheck = await this.checkContextualPermissions(context, permission);
      if (contextCheck.granted) {
        allowedPermissions.push(permission);
      }
    }
    
    return allowedPermissions;
  }

  /**
   * Get user's Chama context with caching
   */
  private static async getUserChamaContext(
    userId: string,
    chamaId: string
  ): Promise<PermissionContext | null> {
    const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}:${chamaId}`;
    
    // Try to get from cache first
    const cached = await RedisService.get<PermissionContext>(cacheKey, true);
    if (cached) {
      return cached;
    }

    // Get from database
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
        chama: {
          select: {
            id: true,
            status: true,
            type: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    const context: PermissionContext = {
      chamaId,
      userId,
      role: membership.role,
      memberStatus: membership.status,
      chamaStatus: membership.chama.status,
      chamaType: membership.chama.type,
    };

    // Cache the context
    await RedisService.set(cacheKey, context, this.CACHE_TTL);

    return context;
  }

  /**
   * Check contextual permission restrictions
   */
  private static async checkContextualPermissions(
    context: PermissionContext,
    permission: Permission
  ): Promise<PermissionResult> {
    // Context-specific permission checks can be added here
    // For example, certain permissions might be restricted during specific Chama states
    
    // Check if financial permissions are restricted during disputes
    if (this.isFinancialPermission(permission)) {
      const hasActiveDisputes = await this.hasActiveFinancialDisputes(context.chamaId);
      if (hasActiveDisputes && !this.canOverrideDisputeRestrictions(context.role)) {
        return {
          granted: false,
          reason: 'Financial operations restricted due to active disputes',
        };
      }
    }

    // Check if governance permissions are restricted during voting periods
    if (this.isGovernancePermission(permission)) {
      const hasActiveVotes = await this.hasActiveVotes(context.chamaId);
      if (hasActiveVotes && permission === Permission.MANAGE_CHAMA_SETTINGS) {
        return {
          granted: false,
          reason: 'Chama settings cannot be modified during active voting',
        };
      }
    }

    return { granted: true };
  }

  /**
   * Get roles that have a specific permission
   */
  private static getRolesWithPermission(permission: Permission): MemberRole[] {
    const roles: MemberRole[] = [];
    
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      if (permissions.includes(permission)) {
        roles.push(role as MemberRole);
      }
    }
    
    return roles;
  }

  /**
   * Check if permission is financial
   */
  private static isFinancialPermission(permission: Permission): boolean {
    const financialPermissions = [
      Permission.APPROVE_LOANS,
      Permission.DISBURSE_LOANS,
      Permission.MANAGE_PAYOUTS,
      Permission.PROCESS_PAYMENTS,
      Permission.MANAGE_LOAN_DEFAULTS,
      Permission.CALCULATE_SHARE_OUTS,
    ];
    
    return financialPermissions.includes(permission);
  }

  /**
   * Check if permission is governance-related
   */
  private static isGovernancePermission(permission: Permission): boolean {
    const governancePermissions = [
      Permission.CREATE_VOTES,
      Permission.MANAGE_VOTES,
      Permission.MANAGE_CHAMA_SETTINGS,
      Permission.RESOLVE_DISPUTES,
    ];
    
    return governancePermissions.includes(permission);
  }

  /**
   * Check if role can override dispute restrictions
   */
  private static canOverrideDisputeRestrictions(role: MemberRole): boolean {
    return ['FOUNDER', 'CHAIR', 'AUDITOR'].includes(role);
  }

  /**
   * Check if Chama has active financial disputes
   */
  private static async hasActiveFinancialDisputes(chamaId: string): Promise<boolean> {
    const count = await prisma.dispute.count({
      where: {
        chamaId,
        status: {
          in: ['OPEN', 'UNDER_REVIEW', 'VOTING'],
        },
        category: {
          in: ['CONTRIBUTION', 'LOAN', 'PAYOUT'],
        },
      },
    });
    
    return count > 0;
  }

  /**
   * Check if Chama has active votes
   */
  private static async hasActiveVotes(chamaId: string): Promise<boolean> {
    const count = await prisma.vote.count({
      where: {
        chamaId,
        status: 'ACTIVE',
        endDate: {
          gt: new Date(),
        },
      },
    });
    
    return count > 0;
  }

  /**
   * Invalidate permission cache for a user in a Chama
   */
  static async invalidateUserPermissionCache(userId: string, chamaId?: string): Promise<void> {
    if (chamaId) {
      // Invalidate specific Chama cache
      const cacheKey = `${this.PERMISSION_CACHE_PREFIX}${userId}:${chamaId}`;
      await RedisService.del(cacheKey);
    } else {
      // Invalidate all Chama caches for user (requires pattern matching)
      // This is a simplified approach - in production, you might want to maintain
      // a separate index of user cache keys
      logger.info('Permission cache invalidated for user', { userId });
    }
  }

  /**
   * Bulk permission check for multiple users
   */
  static async bulkPermissionCheck(
    userIds: string[],
    chamaId: string,
    permission: Permission
  ): Promise<Record<string, PermissionResult>> {
    const results: Record<string, PermissionResult> = {};
    
    for (const userId of userIds) {
      results[userId] = await this.hasPermission(userId, chamaId, permission);
    }
    
    return results;
  }

  /**
   * Get permission summary for debugging/admin purposes
   */
  static async getPermissionSummary(
    userId: string,
    chamaId: string
  ): Promise<{
    context: PermissionContext | null;
    permissions: Permission[];
    deniedPermissions: { permission: Permission; reason: string }[];
  }> {
    const context = await this.getUserChamaContext(userId, chamaId);
    
    if (!context) {
      return {
        context: null,
        permissions: [],
        deniedPermissions: [],
      };
    }

    const allPermissions = Object.values(Permission);
    const grantedPermissions: Permission[] = [];
    const deniedPermissions: { permission: Permission; reason: string }[] = [];

    for (const permission of allPermissions) {
      const result = await this.hasPermission(userId, chamaId, permission);
      if (result.granted) {
        grantedPermissions.push(permission);
      } else {
        deniedPermissions.push({
          permission,
          reason: result.reason || 'Unknown reason',
        });
      }
    }

    return {
      context,
      permissions: grantedPermissions,
      deniedPermissions,
    };
  }
}