import { MemberRole } from '@prisma/client';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { logger } from '../config/logger';
import { Permission } from './permissionService';

// Unauthorized access attempt details
export interface UnauthorizedAccessAttempt {
  id: string;
  userId?: string;
  sessionId?: string;
  chamaId?: string;
  attemptedAction: string;
  attemptedPermission?: Permission;
  requiredRole?: MemberRole[];
  currentRole?: MemberRole;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blocked: boolean;
}

// Access pattern analysis
export interface AccessPattern {
  userId?: string;
  ipAddress?: string;
  attemptCount: number;
  firstAttempt: Date;
  lastAttempt: Date;
  uniqueActions: string[];
  uniqueChamas: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isBlocked: boolean;
}

// Security alert
export interface SecurityAlert {
  id: string;
  type: 'REPEATED_UNAUTHORIZED_ACCESS' | 'PRIVILEGE_ESCALATION' | 'SUSPICIOUS_PATTERN' | 'BRUTE_FORCE';
  userId?: string;
  ipAddress?: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata: Record<string, any>;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export class UnauthorizedAccessService {
  private static readonly ACCESS_LOG_PREFIX = 'unauthorized_access:';
  private static readonly PATTERN_PREFIX = 'access_pattern:';
  private static readonly ALERT_PREFIX = 'security_alert:';
  private static readonly BLOCK_PREFIX = 'blocked_access:';
  
  // Thresholds for security alerts
  private static readonly ALERT_THRESHOLDS = {
    REPEATED_ACCESS: 5, // 5 attempts in time window
    TIME_WINDOW: 300, // 5 minutes
    BRUTE_FORCE: 10, // 10 attempts in time window
    PRIVILEGE_ESCALATION: 3, // 3 privilege escalation attempts
  };

  /**
   * Log unauthorized access attempt
   */
  static async logUnauthorizedAccess(attempt: Omit<UnauthorizedAccessAttempt, 'id' | 'timestamp'>): Promise<void> {
    const attemptId = `ua_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullAttempt: UnauthorizedAccessAttempt = {
      ...attempt,
      id: attemptId,
      timestamp: new Date(),
    };

    // Store in Redis for immediate analysis
    const cacheKey = `${this.ACCESS_LOG_PREFIX}${attemptId}`;
    await RedisService.set(cacheKey, fullAttempt, 24 * 60 * 60); // 24 hours

    // Store in database for long-term analysis
    await prisma.auditLog.create({
      data: {
        action: 'CREATE', // Use existing audit action
        entityType: 'ACCESS_ATTEMPT',
        entityId: attemptId,
        userId: attempt.userId,
        chamaId: attempt.chamaId,
        metadata: {
          attemptedAction: attempt.attemptedAction,
          attemptedPermission: attempt.attemptedPermission,
          requiredRole: attempt.requiredRole,
          currentRole: attempt.currentRole,
          reason: attempt.reason,
          severity: attempt.severity,
          blocked: attempt.blocked,
          requestPath: attempt.requestPath,
          requestMethod: attempt.requestMethod,
        },
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
      },
    });

    // Log to application logger
    logger.warn('Unauthorized access attempt', {
      attemptId,
      userId: attempt.userId,
      chamaId: attempt.chamaId,
      action: attempt.attemptedAction,
      permission: attempt.attemptedPermission,
      reason: attempt.reason,
      severity: attempt.severity,
      ipAddress: attempt.ipAddress,
      userAgent: attempt.userAgent,
    });

    // Analyze patterns and generate alerts if needed
    await this.analyzeAccessPatterns(fullAttempt);
  }

  /**
   * Analyze access patterns for security threats
   */
  private static async analyzeAccessPatterns(attempt: UnauthorizedAccessAttempt): Promise<void> {
    // Analyze by user ID if available
    if (attempt.userId) {
      await this.analyzeUserPattern(attempt);
    }

    // Analyze by IP address
    if (attempt.ipAddress) {
      await this.analyzeIpPattern(attempt);
    }

    // Check for privilege escalation attempts
    if (attempt.attemptedPermission && attempt.requiredRole) {
      await this.checkPrivilegeEscalation(attempt);
    }
  }

  /**
   * Analyze access patterns by user
   */
  private static async analyzeUserPattern(attempt: UnauthorizedAccessAttempt): Promise<void> {
    if (!attempt.userId) return;

    const patternKey = `${this.PATTERN_PREFIX}user:${attempt.userId}`;
    const pattern = await RedisService.get<AccessPattern>(patternKey, true) || {
      userId: attempt.userId,
      attemptCount: 0,
      firstAttempt: attempt.timestamp,
      lastAttempt: attempt.timestamp,
      uniqueActions: [],
      uniqueChamas: [],
      severity: 'LOW' as const,
      isBlocked: false,
    };

    // Update pattern
    pattern.attemptCount++;
    pattern.lastAttempt = attempt.timestamp;
    
    if (!pattern.uniqueActions.includes(attempt.attemptedAction)) {
      pattern.uniqueActions.push(attempt.attemptedAction);
    }
    
    if (attempt.chamaId && !pattern.uniqueChamas.includes(attempt.chamaId)) {
      pattern.uniqueChamas.push(attempt.chamaId);
    }

    // Calculate time window
    const timeWindow = (attempt.timestamp.getTime() - pattern.firstAttempt.getTime()) / 1000;

    // Check for alerts
    if (timeWindow <= this.ALERT_THRESHOLDS.TIME_WINDOW) {
      if (pattern.attemptCount >= this.ALERT_THRESHOLDS.REPEATED_ACCESS) {
        await this.createSecurityAlert({
          type: 'REPEATED_UNAUTHORIZED_ACCESS',
          userId: attempt.userId,
          description: `User ${attempt.userId} made ${pattern.attemptCount} unauthorized access attempts in ${Math.round(timeWindow)} seconds`,
          severity: pattern.attemptCount >= this.ALERT_THRESHOLDS.BRUTE_FORCE ? 'CRITICAL' : 'HIGH',
          metadata: {
            attemptCount: pattern.attemptCount,
            timeWindow,
            uniqueActions: pattern.uniqueActions,
            uniqueChamas: pattern.uniqueChamas,
          },
        });

        // Block user if threshold exceeded
        if (pattern.attemptCount >= this.ALERT_THRESHOLDS.BRUTE_FORCE) {
          await this.blockAccess('user', attempt.userId, 'Excessive unauthorized access attempts');
          pattern.isBlocked = true;
          pattern.severity = 'CRITICAL';
        }
      }
    } else {
      // Reset pattern if outside time window
      pattern.attemptCount = 1;
      pattern.firstAttempt = attempt.timestamp;
      pattern.uniqueActions = [attempt.attemptedAction];
      pattern.uniqueChamas = attempt.chamaId ? [attempt.chamaId] : [];
    }

    // Store updated pattern
    await RedisService.set(patternKey, pattern, 24 * 60 * 60); // 24 hours
  }

  /**
   * Analyze access patterns by IP address
   */
  private static async analyzeIpPattern(attempt: UnauthorizedAccessAttempt): Promise<void> {
    if (!attempt.ipAddress) return;

    const patternKey = `${this.PATTERN_PREFIX}ip:${attempt.ipAddress}`;
    const pattern = await RedisService.get<AccessPattern>(patternKey, true) || {
      ipAddress: attempt.ipAddress,
      attemptCount: 0,
      firstAttempt: attempt.timestamp,
      lastAttempt: attempt.timestamp,
      uniqueActions: [],
      uniqueChamas: [],
      severity: 'LOW' as const,
      isBlocked: false,
    };

    // Update pattern
    pattern.attemptCount++;
    pattern.lastAttempt = attempt.timestamp;
    
    if (!pattern.uniqueActions.includes(attempt.attemptedAction)) {
      pattern.uniqueActions.push(attempt.attemptedAction);
    }
    
    if (attempt.chamaId && !pattern.uniqueChamas.includes(attempt.chamaId)) {
      pattern.uniqueChamas.push(attempt.chamaId);
    }

    // Calculate time window
    const timeWindow = (attempt.timestamp.getTime() - pattern.firstAttempt.getTime()) / 1000;

    // Check for alerts
    if (timeWindow <= this.ALERT_THRESHOLDS.TIME_WINDOW) {
      if (pattern.attemptCount >= this.ALERT_THRESHOLDS.BRUTE_FORCE) {
        await this.createSecurityAlert({
          type: 'BRUTE_FORCE',
          ipAddress: attempt.ipAddress,
          description: `IP ${attempt.ipAddress} made ${pattern.attemptCount} unauthorized access attempts in ${Math.round(timeWindow)} seconds`,
          severity: 'CRITICAL',
          metadata: {
            attemptCount: pattern.attemptCount,
            timeWindow,
            uniqueActions: pattern.uniqueActions,
            uniqueChamas: pattern.uniqueChamas,
          },
        });

        // Block IP
        await this.blockAccess('ip', attempt.ipAddress, 'Brute force attack detected');
        pattern.isBlocked = true;
        pattern.severity = 'CRITICAL';
      }
    } else {
      // Reset pattern if outside time window
      pattern.attemptCount = 1;
      pattern.firstAttempt = attempt.timestamp;
      pattern.uniqueActions = [attempt.attemptedAction];
      pattern.uniqueChamas = attempt.chamaId ? [attempt.chamaId] : [];
    }

    // Store updated pattern
    await RedisService.set(patternKey, pattern, 24 * 60 * 60); // 24 hours
  }

  /**
   * Check for privilege escalation attempts
   */
  private static async checkPrivilegeEscalation(attempt: UnauthorizedAccessAttempt): Promise<void> {
    if (!attempt.userId || !attempt.requiredRole || !attempt.currentRole) return;

    // Check if user is trying to access higher privilege functions
    const roleHierarchy: Record<MemberRole, number> = {
      MEMBER: 1,
      AUDITOR: 2,
      SECRETARY: 3,
      TREASURER: 4,
      CHAIR: 5,
      FOUNDER: 6,
    };

    const currentLevel = roleHierarchy[attempt.currentRole];
    const requiredLevels = attempt.requiredRole.map(role => roleHierarchy[role]);
    const maxRequiredLevel = Math.max(...requiredLevels);

    if (maxRequiredLevel > currentLevel + 1) { // Trying to access 2+ levels higher
      const escalationKey = `${this.PATTERN_PREFIX}escalation:${attempt.userId}`;
      const escalationCount = await RedisService.incr(escalationKey);
      
      if (escalationCount === 1) {
        await RedisService.expire(escalationKey, this.ALERT_THRESHOLDS.TIME_WINDOW);
      }

      if (escalationCount >= this.ALERT_THRESHOLDS.PRIVILEGE_ESCALATION) {
        await this.createSecurityAlert({
          type: 'PRIVILEGE_ESCALATION',
          userId: attempt.userId,
          description: `User ${attempt.userId} attempted privilege escalation ${escalationCount} times`,
          severity: 'HIGH',
          metadata: {
            currentRole: attempt.currentRole,
            requiredRoles: attempt.requiredRole,
            attemptedPermission: attempt.attemptedPermission,
            escalationCount,
          },
        });
      }
    }
  }

  /**
   * Create security alert
   */
  private static async createSecurityAlert(
    alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'acknowledged'>
  ): Promise<SecurityAlert> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullAlert: SecurityAlert = {
      ...alert,
      id: alertId,
      createdAt: new Date(),
      acknowledged: false,
    };

    // Store in Redis
    const cacheKey = `${this.ALERT_PREFIX}${alertId}`;
    await RedisService.set(cacheKey, fullAlert, 7 * 24 * 60 * 60); // 7 days

    // Store in database
    await prisma.auditLog.create({
      data: {
        action: 'CREATE', // Use existing audit action
        entityType: 'SECURITY_ALERT',
        entityId: alertId,
        userId: alert.userId,
        metadata: {
          type: alert.type,
          description: alert.description,
          severity: alert.severity,
          ...alert.metadata,
        },
        ipAddress: alert.ipAddress,
      },
    });

    // Log critical alerts immediately
    if (alert.severity === 'CRITICAL') {
      logger.error('Critical security alert', {
        alertId,
        type: alert.type,
        description: alert.description,
        userId: alert.userId,
        ipAddress: alert.ipAddress,
        metadata: alert.metadata,
      });
    } else {
      logger.warn('Security alert', {
        alertId,
        type: alert.type,
        description: alert.description,
        severity: alert.severity,
      });
    }

    return fullAlert;
  }

  /**
   * Block access for user or IP
   */
  private static async blockAccess(
    type: 'user' | 'ip',
    identifier: string,
    reason: string,
    duration: number = 24 * 60 * 60 // 24 hours
  ): Promise<void> {
    const blockKey = `${this.BLOCK_PREFIX}${type}:${identifier}`;
    const blockInfo = {
      type,
      identifier,
      reason,
      blockedAt: new Date(),
      expiresAt: new Date(Date.now() + duration * 1000),
    };

    await RedisService.set(blockKey, blockInfo, duration);

    logger.warn('Access blocked', {
      type,
      identifier,
      reason,
      duration,
    });
  }

  /**
   * Check if access is blocked
   */
  static async isAccessBlocked(type: 'user' | 'ip', identifier: string): Promise<boolean> {
    const blockKey = `${this.BLOCK_PREFIX}${type}:${identifier}`;
    const blockInfo = await RedisService.get(blockKey);
    return blockInfo !== null;
  }

  /**
   * Get security alerts
   */
  static async getSecurityAlerts(
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    _acknowledged?: boolean,
    limit: number = 50
  ): Promise<SecurityAlert[]> {
    // In production, you'd query the database with proper filtering
    // For now, this is a simplified implementation
    
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'CREATE', // Use existing audit action
        entityType: 'SECURITY_ALERT',
        ...(severity && {
          metadata: {
            path: ['severity'],
            equals: severity,
          },
        }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return auditLogs.map(log => ({
      id: log.entityId,
      type: (log.metadata as any).type,
      userId: log.userId || undefined,
      ipAddress: log.ipAddress || undefined,
      description: (log.metadata as any).description,
      severity: (log.metadata as any).severity,
      metadata: log.metadata as any,
      createdAt: log.createdAt,
      acknowledged: false, // Would need separate tracking in production
    }));
  }

  /**
   * Get unauthorized access statistics
   */
  static async getAccessStatistics(
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    totalAttempts: number;
    uniqueUsers: number;
    uniqueIPs: number;
    topActions: { action: string; count: number }[];
    severityBreakdown: Record<string, number>;
    blockedAccess: number;
  }> {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'CREATE', // Use existing audit action
        entityType: 'ACCESS_ATTEMPT',
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        userId: true,
        ipAddress: true,
        metadata: true,
      },
    });

    const uniqueUsers = new Set(logs.filter(l => l.userId).map(l => l.userId)).size;
    const uniqueIPs = new Set(logs.filter(l => l.ipAddress).map(l => l.ipAddress)).size;
    
    const actionCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    let blockedCount = 0;

    logs.forEach(log => {
      const metadata = log.metadata as any;
      const action = metadata.attemptedAction || 'unknown';
      const severity = metadata.severity || 'LOW';
      const blocked = metadata.blocked || false;

      actionCounts[action] = (actionCounts[action] || 0) + 1;
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      
      if (blocked) {
        blockedCount++;
      }
    });

    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return {
      totalAttempts: logs.length,
      uniqueUsers,
      uniqueIPs,
      topActions,
      severityBreakdown: severityCounts,
      blockedAccess: blockedCount,
    };
  }

  /**
   * Acknowledge security alert
   */
  static async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const cacheKey = `${this.ALERT_PREFIX}${alertId}`;
    const alert = await RedisService.get<SecurityAlert>(cacheKey, true);

    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      await RedisService.set(cacheKey, alert, 7 * 24 * 60 * 60);

      logger.info('Security alert acknowledged', {
        alertId,
        acknowledgedBy,
      });
    }
  }

  /**
   * Unblock access
   */
  static async unblockAccess(type: 'user' | 'ip', identifier: string): Promise<void> {
    const blockKey = `${this.BLOCK_PREFIX}${type}:${identifier}`;
    await RedisService.del(blockKey);

    logger.info('Access unblocked', {
      type,
      identifier,
    });
  }
}