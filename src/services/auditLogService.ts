/**
 * Audit Log Service
 * 
 * This service handles system audit logging for all significant actions
 * to support debugging, auditing, and system monitoring.
 * 
 * Requirements: 27.4, 13.1, 13.2, 13.3
 */

import { PrismaClient } from '@prisma/client';
import {
  AuditLogData,
  CreateAuditLogRequest,
  AuditAction
} from '../types/notification';
import {
  createAuditLogSchema,
  auditLogQuerySchema
} from '../schemas/notification';
import { z } from 'zod';

export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new audit log entry
   * Requirement 27.4: Event logs for all significant actions
   */
  async createAuditLog(data: CreateAuditLogRequest): Promise<AuditLogData> {
    const validatedData = createAuditLogSchema.parse(data);

    const auditLog = await this.prisma.auditLog.create({
      data: {
        action: validatedData.action,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        userId: validatedData.userId,
        chamaId: validatedData.chamaId,
        oldValues: validatedData.oldValues,
        newValues: validatedData.newValues,
        metadata: validatedData.metadata,
        ipAddress: validatedData.ipAddress,
        userAgent: validatedData.userAgent
      }
    });

    return auditLog as AuditLogData;
  }

  /**
   * Create audit log for entity creation
   * Requirement 13.1: Immutable transaction logs
   */
  async logCreate(
    entityType: string,
    entityId: string,
    newValues: any,
    userId?: string,
    chamaId?: string,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action: AuditAction.CREATE,
      entityType,
      entityId,
      userId,
      chamaId,
      newValues,
      metadata
    });
  }

  /**
   * Create audit log for entity update
   * Requirement 13.1: Complete transaction histories with user attribution
   */
  async logUpdate(
    entityType: string,
    entityId: string,
    oldValues: any,
    newValues: any,
    userId?: string,
    chamaId?: string,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      userId,
      chamaId,
      oldValues,
      newValues,
      metadata
    });
  }

  /**
   * Create audit log for entity deletion
   * Requirement 13.1: Immutable audit trails
   */
  async logDelete(
    entityType: string,
    entityId: string,
    oldValues: any,
    userId?: string,
    chamaId?: string,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action: AuditAction.DELETE,
      entityType,
      entityId,
      userId,
      chamaId,
      oldValues,
      metadata
    });
  }

  /**
   * Log user authentication events
   * Requirement 27.4: Security event logging
   */
  async logAuthentication(
    action: AuditAction.LOGIN | AuditAction.LOGOUT,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action,
      entityType: 'User',
      entityId: userId,
      userId,
      ipAddress,
      userAgent,
      metadata
    });
  }

  /**
   * Log financial transactions
   * Requirement 13.1: Financial audit trails with timestamps
   */
  async logFinancialTransaction(
    action: AuditAction,
    transactionId: string,
    transactionData: any,
    userId?: string,
    chamaId?: string,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action,
      entityType: 'Transaction',
      entityId: transactionId,
      userId,
      chamaId,
      newValues: transactionData,
      metadata
    });
  }

  /**
   * Log Chama-related activities
   * Requirement 13.2: Chama operation audit trails
   */
  async logChamaActivity(
    action: AuditAction,
    chamaId: string,
    entityType: string,
    entityId: string,
    userId?: string,
    oldValues?: any,
    newValues?: any,
    metadata?: any
  ): Promise<AuditLogData> {
    return this.createAuditLog({
      action,
      entityType,
      entityId,
      userId,
      chamaId,
      oldValues,
      newValues,
      metadata
    });
  }

  /**
   * Get audit logs with filtering and pagination
   * Requirement 13.3: Audit trail access and reporting
   */
  async getAuditLogs(
    query: z.infer<typeof auditLogQuerySchema>
  ): Promise<{ logs: AuditLogData[]; total: number }> {
    const validatedQuery = auditLogQuerySchema.parse(query);

    const where = {
      ...(validatedQuery.action && { action: validatedQuery.action }),
      ...(validatedQuery.entityType && { entityType: validatedQuery.entityType }),
      ...(validatedQuery.entityId && { entityId: validatedQuery.entityId }),
      ...(validatedQuery.userId && { userId: validatedQuery.userId }),
      ...(validatedQuery.chamaId && { chamaId: validatedQuery.chamaId }),
      ...(validatedQuery.startDate && validatedQuery.endDate && {
        createdAt: {
          gte: validatedQuery.startDate,
          lte: validatedQuery.endDate
        }
      })
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          chama: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      logs: logs as AuditLogData[],
      total
    };
  }

  /**
   * Get audit trail for a specific entity
   * Requirement 13.3: Complete entity history
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 100
  ): Promise<AuditLogData[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return logs as AuditLogData[];
  }

  /**
   * Get user activity logs
   * Requirement 13.3: User action tracking
   */
  async getUserActivity(
    userId: string,
    chamaId?: string,
    limit: number = 100
  ): Promise<AuditLogData[]> {
    const where = {
      userId,
      ...(chamaId && { chamaId })
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        chama: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    return logs as AuditLogData[];
  }

  /**
   * Get Chama activity logs
   * Requirement 13.2: Chama audit trails
   */
  async getChamaActivity(
    chamaId: string,
    limit: number = 100
  ): Promise<AuditLogData[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { chamaId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return logs as AuditLogData[];
  }

  /**
   * Get audit statistics for monitoring
   * Requirement 27.4: System monitoring and debugging
   */
  async getAuditStats(chamaId?: string): Promise<{
    total: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    recentActivity: number; // Last 24 hours
    topUsers: Array<{ userId: string; count: number; userEmail?: string }>;
  }> {
    const where = chamaId ? { chamaId } : {};
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      total,
      byAction,
      byEntityType,
      recentActivity,
      topUsers
    ] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true }
      }),
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: { entityType: true }
      }),
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: { gte: last24Hours }
        }
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          ...where,
          userId: { not: null }
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      })
    ]);

    // Get user details for top users
    const userIds = topUsers.map(u => u.userId).filter((id): id is string => id !== null);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true }
    });

    const topUsersWithDetails = topUsers
      .filter((u): u is typeof u & { userId: string } => u.userId !== null)
      .map(u => ({
        userId: u.userId,
        count: u._count.userId,
        userEmail: users.find(user => user.id === u.userId)?.email
      }));

    return {
      total,
      byAction: Object.fromEntries(byAction.map(a => [a.action, a._count.action])),
      byEntityType: Object.fromEntries(byEntityType.map(e => [e.entityType, e._count.entityType])),
      recentActivity,
      topUsers: topUsersWithDetails
    };
  }

  /**
   * Clean up old audit logs (with retention policy)
   * Requirement 27.4: System maintenance
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Only clean up non-financial audit logs to maintain compliance
    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        action: {
          notIn: [
            AuditAction.PAYMENT_PROCESSED,
            AuditAction.LOAN_APPROVED,
            AuditAction.LOAN_DISBURSED,
            AuditAction.CONTRIBUTION_MADE,
            AuditAction.PAYOUT_PROCESSED
          ]
        }
      }
    });

    return result.count;
  }

  /**
   * Batch create audit logs for performance
   * Requirement 27.4: Efficient logging for high-volume operations
   */
  async batchCreateAuditLogs(logs: CreateAuditLogRequest[]): Promise<number> {
    const validatedLogs = logs.map(log => createAuditLogSchema.parse(log));

    const result = await this.prisma.auditLog.createMany({
      data: validatedLogs.map(log => ({
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        chamaId: log.chamaId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      }))
    });

    return result.count;
  }
}