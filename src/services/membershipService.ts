// @ts-nocheck
/**
 * Membership Service - Handles multi-Chama membership management
 * 
 * This service provides comprehensive membership management functionality including:
 * - Unified dashboard for multiple Chama participations
 * - Role assignment and status tracking per Chama
 * - Membership history and reliability scoring
 * 
 * Requirements: 2.2, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { prisma } from '../config/database';
import { logger, auditLog } from '../config/logger';
import { NotificationService } from './notificationService';
import { 
  ConflictError,
  NotFoundError,
  ForbiddenError
} from '../middleware/errorHandler';
import {
  MemberRole,
  MemberStatus,
  ChamaType,
  Prisma
} from '@prisma/client';
import {
  NotificationType,
  NotificationPriority,
} from '../types/notification';

// Dashboard data interfaces
export interface ChamaDashboardSummary {
  chamaId: string;
  chamaName: string;
  chamaType: ChamaType;
  role: MemberRole;
  status: MemberStatus;
  reliabilityScore: number;
  joinedAt: Date;
  
  // Financial metrics
  totalContributions: number;
  pendingContributions: number;
  overdueContributions: number;
  activeLoans: number;
  totalLoanBalance: number;
  
  // Activity metrics
  upcomingMeetings: number;
  pendingVotes: number;
  unreadNotifications: number;
  
  // Next actions
  nextContributionDue?: Date;
  nextMeetingDate?: Date;
}

export interface UnifiedDashboard {
  userId: string;
  totalChamas: number;
  activeChamas: number;
  chamas: ChamaDashboardSummary[];
  
  // Aggregated metrics across all Chamas
  aggregatedMetrics: {
    totalContributionsAllChamas: number;
    totalPendingContributions: number;
    totalActiveLoans: number;
    totalLoanBalance: number;
    averageReliabilityScore: number;
  };
  
  // Upcoming activities across all Chamas
  upcomingActivities: {
    nextContributions: Array<{
      chamaId: string;
      chamaName: string;
      dueDate: Date;
      amount: number;
    }>;
    nextMeetings: Array<{
      chamaId: string;
      chamaName: string;
      meetingDate: Date;
    }>;
    pendingVotes: Array<{
      chamaId: string;
      chamaName: string;
      voteTitle: string;
      endDate: Date;
    }>;
  };
}

export interface MembershipHistory {
  chamaId: string;
  userId: string;
  events: Array<{
    id: string;
    eventType: 'JOINED' | 'ROLE_CHANGED' | 'STATUS_CHANGED' | 'CONTRIBUTION_MADE' | 'LOAN_TAKEN' | 'LOAN_REPAID' | 'MEETING_ATTENDED' | 'VOTE_CAST';
    timestamp: Date;
    details: any;
    performedBy?: string;
  }>;
}

export interface ReliabilityScoreBreakdown {
  userId: string;
  chamaId: string;
  currentScore: number;
  components: {
    contributionConsistency: {
      score: number;
      weight: number;
      details: {
        totalContributions: number;
        onTimeContributions: number;
        lateContributions: number;
        missedContributions: number;
        onTimePercentage: number;
      };
    };
    loanPerformance: {
      score: number;
      weight: number;
      details: {
        totalLoans: number;
        repaidLoans: number;
        defaultedLoans: number;
        averageRepaymentTime: number;
        repaymentRate: number;
      };
    };
    meetingAttendance: {
      score: number;
      weight: number;
      details: {
        totalMeetings: number;
        attendedMeetings: number;
        attendanceRate: number;
      };
    };
    governanceParticipation: {
      score: number;
      weight: number;
      details: {
        totalVotes: number;
        votesParticipated: number;
        participationRate: number;
      };
    };
  };
  lastUpdated: Date;
}

export class MembershipService {
  /**
   * Get unified dashboard for a user showing all their Chama participations
   */
  static async getUnifiedDashboard(userId: string): Promise<UnifiedDashboard> {
    // Get all active memberships
    const memberships = await prisma.chamaMembership.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'INVITATION_SENT'] },
      },
      include: {
        chama: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            contributionAmount: true,
            contributionFrequency: true,
          },
        },
      },
    });

    // Build dashboard summary for each Chama
    const chamasSummaries = await Promise.all(
      memberships.map(async (membership) => {
        return await this.getChamaDashboardSummary(userId, membership.chamaId);
      })
    );

    // Calculate aggregated metrics
    const aggregatedMetrics = {
      totalContributionsAllChamas: chamasSummaries.reduce(
        (sum, chama) => sum + chama.totalContributions,
        0
      ),
      totalPendingContributions: chamasSummaries.reduce(
        (sum, chama) => sum + chama.pendingContributions,
        0
      ),
      totalActiveLoans: chamasSummaries.reduce(
        (sum, chama) => sum + chama.activeLoans,
        0
      ),
      totalLoanBalance: chamasSummaries.reduce(
        (sum, chama) => sum + chama.totalLoanBalance,
        0
      ),
      averageReliabilityScore:
        chamasSummaries.reduce((sum, chama) => sum + chama.reliabilityScore, 0) /
        (chamasSummaries.length || 1),
    };

    // Get upcoming activities across all Chamas
    const upcomingActivities = await this.getUpcomingActivities(userId, memberships);

    return {
      userId,
      totalChamas: memberships.length,
      activeChamas: memberships.filter((m) => m.status === 'ACTIVE').length,
      chamas: chamasSummaries,
      aggregatedMetrics,
      upcomingActivities,
    };
  }

  /**
   * Get dashboard summary for a specific Chama membership
   */
  static async getChamaDashboardSummary(
    userId: string,
    chamaId: string
  ): Promise<ChamaDashboardSummary> {
    // Get membership details
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      include: {
        chama: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Get contribution metrics
    const contributions = await prisma.contribution.findMany({
      where: {
        chamaId,
        memberId: userId,
      },
      select: {
        amount: true,
        status: true,
        dueDate: true,
      },
    });

    const totalContributions = contributions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const pendingContributions = contributions.filter(
      (c) => c.status === 'PENDING'
    ).length;

    const overdueContributions = contributions.filter(
      (c) => c.status === 'OVERDUE'
    ).length;

    // Get next contribution due date
    const nextContribution = contributions
      .filter((c) => c.status === 'PENDING' && c.dueDate > new Date())
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    // Get loan metrics
    const loans = await prisma.loan.findMany({
      where: {
        chamaId,
        borrowerId: userId,
      },
      select: {
        status: true,
        balance: true,
      },
    });

    const activeLoans = loans.filter((l) => l.status === 'ACTIVE').length;
    const totalLoanBalance = loans
      .filter((l) => l.status === 'ACTIVE')
      .reduce((sum, l) => sum + Number(l.balance), 0);

    // Get upcoming meetings count (would need a meetings table in full implementation)
    const upcomingMeetings = 0; // Placeholder

    // Get pending votes
    const pendingVotes = await prisma.vote.count({
      where: {
        chamaId,
        status: 'ACTIVE',
        endDate: { gt: new Date() },
        options: {
          some: {
            votesCast: {
              none: {
                memberId: userId,
              },
            },
          },
        },
      },
    });

    // Get unread notifications
    const unreadNotifications = await prisma.notification.count({
      where: {
        recipientId: userId,
        chamaId,
        acknowledgedAt: null,
      },
    });

    return {
      chamaId: membership.chamaId,
      chamaName: membership.chama.name,
      chamaType: membership.chama.type,
      role: membership.role,
      status: membership.status,
      reliabilityScore: Number(membership.reliabilityScore),
      joinedAt: membership.joinedAt,
      totalContributions,
      pendingContributions,
      overdueContributions,
      activeLoans,
      totalLoanBalance,
      upcomingMeetings,
      pendingVotes,
      unreadNotifications,
      nextContributionDue: nextContribution?.dueDate,
      nextMeetingDate: undefined, // Would be populated from meetings table
    };
  }

  /**
   * Get upcoming activities across all Chamas
   */
  private static async getUpcomingActivities(
    userId: string,
    memberships: any[]
  ): Promise<UnifiedDashboard['upcomingActivities']> {
    const chamaIds = memberships.map((m) => m.chamaId);

    // Get next contributions
    const nextContributions = await prisma.contribution.findMany({
      where: {
        chamaId: { in: chamaIds },
        memberId: userId,
        status: 'PENDING',
        dueDate: { gt: new Date() },
      },
      include: {
        chama: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    // Get pending votes
    const pendingVotes = await prisma.vote.findMany({
      where: {
        chamaId: { in: chamaIds },
        status: 'ACTIVE',
        endDate: { gt: new Date() },
      },
      include: {
        chama: {
          select: {
            id: true,
            name: true,
          },
        },
        options: {
          include: {
            votesCast: {
              where: { memberId: userId },
            },
          },
        },
      },
      orderBy: { endDate: 'asc' },
      take: 5,
    });

    // Filter votes where user hasn't voted yet
    const votesNotCast = pendingVotes.filter(
      (vote) => !vote.options.some((opt) => opt.votesCast.length > 0)
    );

    return {
      nextContributions: nextContributions.map((c) => ({
        chamaId: c.chamaId,
        chamaName: c.chama.name,
        dueDate: c.dueDate,
        amount: Number(c.amount),
      })),
      nextMeetings: [], // Would be populated from meetings table
      pendingVotes: votesNotCast.map((v) => ({
        chamaId: v.chamaId,
        chamaName: v.chama.name,
        voteTitle: v.title,
        endDate: v.endDate,
      })),
    };
  }

  /**
   * Update member role in a Chama
   */
  static async updateMemberRole(
    chamaId: string,
    userId: string,
    newRole: MemberRole,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    // Verify updater has permission
    const updaterMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: updatedBy },
      },
    });

    if (!updaterMembership || !['FOUNDER', 'CHAIR'].includes(updaterMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to update member role');
    }

    // Get current membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      include: {
        chama: true,
        user: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Prevent founder role changes
    if (membership.role === 'FOUNDER' && newRole !== 'FOUNDER') {
      throw new ForbiddenError('Cannot change founder role');
    }

    // Prevent multiple founders
    if (newRole === 'FOUNDER') {
      const existingFounder = await prisma.chamaMembership.findFirst({
        where: {
          chamaId,
          role: 'FOUNDER',
          userId: { not: userId },
        },
      });

      if (existingFounder) {
        throw new ConflictError('Chama already has a founder');
      }
    }

    const oldRole = membership.role;

    // Update role
    await prisma.chamaMembership.update({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      data: {
        role: newRole,
        updatedAt: new Date(),
      },
    });

    // Log role change
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'ChamaMembership',
        entityId: `${chamaId}:${userId}`,
        userId: updatedBy,
        chamaId,
        oldValues: { role: oldRole },
        newValues: { role: newRole },
        metadata: { reason },
      },
    });

    // Send notification to member
    const notificationService = new NotificationService(prisma);
    await notificationService.createNotification({
      recipientId: userId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.IMPORTANT,
      title: 'Role Updated',
      message: `Your role in ${membership.chama.name} has been changed from ${oldRole} to ${newRole}.`,
      channels: [],
    });

    logger.info('Member role updated', {
      chamaId,
      userId,
      oldRole,
      newRole,
      updatedBy,
    });
  }

  /**
   * Update member status in a Chama
   */
  static async updateMemberStatus(
    chamaId: string,
    userId: string,
    newStatus: MemberStatus,
    updatedBy: string,
    reason?: string
  ): Promise<void> {
    // Verify updater has permission
    const updaterMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: updatedBy },
      },
    });

    if (!updaterMembership || !['FOUNDER', 'CHAIR'].includes(updaterMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to update member status');
    }

    // Get current membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      include: {
        chama: true,
        user: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Prevent founder status changes to EXITED or SUSPENDED
    if (membership.role === 'FOUNDER' && ['EXITED', 'SUSPENDED'].includes(newStatus)) {
      throw new ForbiddenError('Cannot suspend or exit founder. Transfer ownership first.');
    }

    const oldStatus = membership.status;

    // Update status
    await prisma.chamaMembership.update({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // Log status change
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'ChamaMembership',
        entityId: `${chamaId}:${userId}`,
        userId: updatedBy,
        chamaId,
        oldValues: { status: oldStatus },
        newValues: { status: newStatus },
        metadata: { reason },
      },
    });

    // Send notification to member
    const notificationService = new NotificationService(prisma);
    await notificationService.createNotification({
      recipientId: userId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: newStatus === 'SUSPENDED' ? NotificationPriority.CRITICAL : NotificationPriority.IMPORTANT,
      title: 'Status Updated',
      message: `Your status in ${membership.chama.name} has been changed to ${newStatus}.${reason ? ` Reason: ${reason}` : ''}`,
      channels: [],
    });

    logger.info('Member status updated', {
      chamaId,
      userId,
      oldStatus,
      newStatus,
      updatedBy,
      reason,
    });
  }

  /**
   * Get membership history for a user in a Chama
   */
  static async getMembershipHistory(
    userId: string,
    chamaId: string
  ): Promise<MembershipHistory> {
    // Verify membership exists
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Get audit logs for this membership
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: 'ChamaMembership',
            entityId: `${chamaId}:${userId}`,
          },
          {
            entityType: 'Contribution',
            userId,
            chamaId,
          },
          {
            entityType: 'Loan',
            userId,
            chamaId,
          },
          {
            entityType: 'VoteCast',
            userId,
            chamaId,
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Transform audit logs into events
    const events = auditLogs.map((log) => {
      let eventType: MembershipHistory['events'][0]['eventType'] = 'JOINED';
      
      if (log.entityType === 'ChamaMembership') {
        if (log.action === 'CREATE') {
          eventType = 'JOINED';
        } else if (log.oldValues && (log.oldValues as any).role !== (log.newValues as any)?.role) {
          eventType = 'ROLE_CHANGED';
        } else if (log.oldValues && (log.oldValues as any).status !== (log.newValues as any)?.status) {
          eventType = 'STATUS_CHANGED';
        }
      } else if (log.entityType === 'Contribution') {
        eventType = 'CONTRIBUTION_MADE';
      } else if (log.entityType === 'Loan') {
        if (log.action === 'CREATE') {
          eventType = 'LOAN_TAKEN';
        } else {
          eventType = 'LOAN_REPAID';
        }
      } else if (log.entityType === 'VoteCast') {
        eventType = 'VOTE_CAST';
      }

      return {
        id: log.id,
        eventType,
        timestamp: log.createdAt,
        details: {
          action: log.action,
          oldValues: log.oldValues,
          newValues: log.newValues,
          metadata: log.metadata,
        },
        performedBy: log.userId || undefined,
      };
    });

    return {
      chamaId,
      userId,
      events,
    };
  }

  /**
   * Calculate and update reliability score for a member
   */
  static async calculateReliabilityScore(
    userId: string,
    chamaId: string
  ): Promise<ReliabilityScoreBreakdown> {
    // Get membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Calculate contribution consistency (40% weight)
    const contributions = await prisma.contribution.findMany({
      where: {
        chamaId,
        memberId: userId,
      },
    });

    const totalContributions = contributions.length;
    const onTimeContributions = contributions.filter(
      (c) => c.status === 'PAID' && c.paidDate && c.paidDate <= c.dueDate
    ).length;
    const lateContributions = contributions.filter(
      (c) => c.status === 'PAID' && c.paidDate && c.paidDate > c.dueDate
    ).length;
    const missedContributions = contributions.filter(
      (c) => c.status === 'OVERDUE' || (c.status === 'PENDING' && c.dueDate < new Date())
    ).length;

    const onTimePercentage = totalContributions > 0 ? (onTimeContributions / totalContributions) * 100 : 100;
    const contributionScore = Math.max(0, Math.min(100, onTimePercentage - (missedContributions * 10)));

    // Calculate loan performance (30% weight)
    const loans = await prisma.loan.findMany({
      where: {
        chamaId,
        borrowerId: userId,
      },
    });

    const totalLoans = loans.length;
    const repaidLoans = loans.filter((l) => l.status === 'PAID').length;
    const defaultedLoans = loans.filter((l) => l.status === 'DEFAULTED').length;
    const repaymentRate = totalLoans > 0 ? (repaidLoans / totalLoans) * 100 : 100;
    const loanScore = Math.max(0, repaymentRate - (defaultedLoans * 20));

    // Calculate meeting attendance (20% weight)
    // In a full implementation, this would query a meetings table
    const totalMeetings = 10; // Placeholder
    const attendedMeetings = 8; // Placeholder
    const attendanceRate = (attendedMeetings / totalMeetings) * 100;
    const attendanceScore = attendanceRate;

    // Calculate governance participation (10% weight)
    const totalVotes = await prisma.vote.count({
      where: {
        chamaId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
      },
    });

    const votesParticipated = await prisma.voteCast.count({
      where: {
        memberId: userId,
        option: {
          vote: {
            chamaId,
          },
        },
      },
    });

    const participationRate = totalVotes > 0 ? (votesParticipated / totalVotes) * 100 : 100;
    const governanceScore = participationRate;

    // Calculate weighted overall score
    const overallScore =
      contributionScore * 0.4 +
      loanScore * 0.3 +
      attendanceScore * 0.2 +
      governanceScore * 0.1;

    // Update reliability score in database
    await prisma.chamaMembership.update({
      where: {
        chamaId_userId: { chamaId, userId },
      },
      data: {
        reliabilityScore: Math.round(overallScore * 100) / 100, // Store as percentage (0-100)
        updatedAt: new Date(),
      },
    });

    logger.info('Reliability score calculated', {
      userId,
      chamaId,
      score: overallScore,
    });

    return {
      userId,
      chamaId,
      currentScore: Math.round(overallScore),
      components: {
        contributionConsistency: {
          score: Math.round(contributionScore),
          weight: 0.4,
          details: {
            totalContributions,
            onTimeContributions,
            lateContributions,
            missedContributions,
            onTimePercentage: Math.round(onTimePercentage),
          },
        },
        loanPerformance: {
          score: Math.round(loanScore),
          weight: 0.3,
          details: {
            totalLoans,
            repaidLoans,
            defaultedLoans,
            averageRepaymentTime: 0, // Would be calculated from actual data
            repaymentRate: Math.round(repaymentRate),
          },
        },
        meetingAttendance: {
          score: Math.round(attendanceScore),
          weight: 0.2,
          details: {
            totalMeetings,
            attendedMeetings,
            attendanceRate: Math.round(attendanceRate),
          },
        },
        governanceParticipation: {
          score: Math.round(governanceScore),
          weight: 0.1,
          details: {
            totalVotes,
            votesParticipated,
            participationRate: Math.round(participationRate),
          },
        },
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get reliability score breakdown for a member
   */
  static async getReliabilityScoreBreakdown(
    userId: string,
    chamaId: string
  ): Promise<ReliabilityScoreBreakdown> {
    // Calculate and return the score
    return await this.calculateReliabilityScore(userId, chamaId);
  }

  /**
   * Switch active Chama context for a user
   */
  static async switchChamaContext(
    userId: string,
    chamaId: string
  ): Promise<ChamaDashboardSummary> {
    // Verify membership exists and is active
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Cannot switch to inactive membership');
    }

    // Get dashboard summary for the Chama
    const dashboard = await this.getChamaDashboardSummary(userId, chamaId);

    // Log context switch
    auditLog('UPDATE', userId, chamaId, {
      action: 'CHAMA_CONTEXT_SWITCHED',
      chamaId,
    });

    logger.info('Chama context switched', {
      userId,
      chamaId,
    });

    return dashboard;
  }

  /**
   * Get all memberships for a user with filtering and pagination
   */
  static async getUserMemberships(
    userId: string,
    filters?: {
      status?: MemberStatus[];
      role?: MemberRole[];
      chamaType?: ChamaType[];
    },
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.ChamaMembershipWhereInput = {
      userId,
    };

    if (filters?.status) {
      where.status = { in: filters.status };
    }

    if (filters?.role) {
      where.role = { in: filters.role };
    }

    if (filters?.chamaType) {
      where.chama = {
        type: { in: filters.chamaType },
      };
    }

    const [memberships, total] = await Promise.all([
      prisma.chamaMembership.findMany({
        where,
        include: {
          chama: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              maxMembers: true,
              contributionAmount: true,
              contributionFrequency: true,
              currency: true,
              _count: {
                select: { memberships: true },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.chamaMembership.count({ where }),
    ]);

    return {
      memberships,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

