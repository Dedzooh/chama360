// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NotificationService } from './notificationService';
import { BackgroundJobService } from './backgroundJobService';
import {
  Chama,
  ChamaStatus,
  Visibility,
  MemberRole,
  MemberStatus,
} from '@prisma/client';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError
} from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import {
  NotificationType,
  NotificationPriority,
  BackgroundJobType,
  NotificationChannelType,
} from '../types/notification';
import {
  CreateChamaInput,
  UpdateChamaInput,
  ChamaType,
} from '../schemas/chama';
import {
  canJoinChama,
  canInviteMembers,
  isEditableChama,
  isPendingMemberStatus,
} from '../utils/chamaLifecycle';

// Initialize services
const notificationService = new NotificationService(prisma);
const backgroundJobService = new BackgroundJobService(prisma);
const inAppChannel = (recipientId: string) => ([
  {
    type: NotificationChannelType.IN_APP,
    address: recipientId,
  },
]);

const defaultEnabledModulesByType: Record<string, Record<string, boolean>> = {
  SAVINGS: { savings: true, contributions: true, loans: true, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: true },
  MERRY_GO_ROUND: { savings: true, contributions: true, loans: false, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: true },
  ROSCA: { savings: true, contributions: true, loans: false, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: true },
  INVESTMENT: { savings: true, contributions: true, loans: false, welfare: false, investments: true, meetings: true, voting: true, fines: false, reports: true, documents: false, mpesa: false },
  WELFARE: { savings: false, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  BUSINESS: { savings: true, contributions: true, loans: true, welfare: false, investments: true, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: true },
  HOUSING: { savings: true, contributions: true, loans: true, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: true, mpesa: false },
  FAMILY: { savings: true, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  CHURCH: { savings: true, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: true, mpesa: false },
  YOUTH: { savings: true, contributions: true, loans: false, welfare: false, investments: false, meetings: true, voting: true, fines: false, reports: true, documents: false, mpesa: false },
  STAFF: { savings: true, contributions: true, loans: true, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: true },
  FARMERS: { savings: true, contributions: true, loans: true, welfare: false, investments: true, meetings: true, voting: false, fines: false, reports: true, documents: true, mpesa: true },
  WOMEN: { savings: true, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  MEN: { savings: true, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  COMMUNITY: { savings: true, contributions: true, loans: false, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  HYBRID: { savings: true, contributions: true, loans: true, welfare: true, investments: true, meetings: true, voting: true, fines: true, reports: true, documents: true, mpesa: true },
  ASCA: { savings: true, contributions: true, loans: true, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
  NORMAL: { savings: true, contributions: true, loans: true, welfare: true, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false },
};

function resolveDefaultEnabledModules(type: ChamaType): Record<string, boolean> {
  return defaultEnabledModulesByType[type] || { savings: true, contributions: true, loans: false, welfare: false, investments: false, meetings: true, voting: false, fines: false, reports: true, documents: false, mpesa: false };
}
export interface ChamaDetails extends Chama {
  _count?: {
    memberships: number;
  };
  memberships?: Array<{
    chamaId: string;
    userId: string;
    role: MemberRole;
    status: MemberStatus;
    joinedAt: Date;
    reliabilityScore: any;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
}

export interface MembershipWithUser {
  chamaId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  reliabilityScore: any; // Decimal from Prisma
  joinedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    kycStatus: string;
  };
}

/**
 * Validate type-specific settings based on Chama type
 */
function validateTypeSpecificSettings(type: ChamaType, settings: any): void {
  if (type === 'ROSCA' && !settings.roscaSettings) {
    throw new BadRequestError('ROSCA Chama requires roscaSettings');
  }
  if (type === 'ASCA' && !settings.ascaSettings) {
    throw new BadRequestError('ASCA Chama requires ascaSettings');
  }
  if (type === 'NORMAL' && !settings.normalSettings) {
    throw new BadRequestError('NORMAL Chama requires normalSettings');
  }
}

function resolveOrganizationProfile(data: CreateChamaInput) {
  const kind = data.organizationKind ?? 'CHAMA';
  const labelMap: Record<string, string> = {
    CHAMA: 'Chama',
    WELFARE: 'Welfare',
    SACCO: 'SACCO',
    INVESTMENT_CLUB: 'Investment Club',
    FAMILY_GROUP: 'Family Group',
    CHURCH_GROUP: 'Church Group',
    YOUTH_GROUP: 'Youth Group',
    STAFF_WELFARE: 'Staff Welfare',
    ESTATE_ASSOCIATION: 'Estate Association',
  };

  return {
    organizationKind: kind,
    organizationLabel: data.settings.organizationLabel || labelMap[kind] || 'Community Group',
  };
}

export class ChamaService {
  static async getChamaByShareableLink(shareableLink: string) {
    const chama = await prisma.chama.findFirst({
      where: {
        shareableLink,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        visibility: true,
        contributionAmount: true,
        contributionFrequency: true,
        currency: true,
      },
    });

    if (!chama) {
      throw new NotFoundError('Invitation link is invalid or expired');
    }

    return chama;
  }

  /**
   * Create a new Chama
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5
   */
  static async createChama(founderId: string, data: CreateChamaInput): Promise<Chama> {
    // Validate founder exists and is active
    const founder = await prisma.user.findUnique({
      where: { id: founderId },
    });

    if (!founder || !founder.isActive) {
      throw new ForbiddenError('Invalid or inactive user');
    }

    // Validate type-specific settings
    validateTypeSpecificSettings(data.type, data.settings);

    const organizationProfile = resolveOrganizationProfile(data);
    const storedType = data.type === 'MERRY_GO_ROUND' ? 'ROSCA' : data.type;
    const enabledModules = (data.settings as any).enabledModules ?? resolveDefaultEnabledModules(data.type);

    // Generate unique shareable link
    const shareableLink = uuidv4();

    // Generate QR code for the shareable link
    const qrCodeData = `${process.env.FRONTEND_URL || 'https://app.chama.com'}/join/${shareableLink}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    // Create chama with founder as first member
    const chama = await prisma.chama.create({
      data: {
        name: data.name,
        createdById: founderId,
        type: storedType as any,
        description: data.description,
        maxMembers: data.maxMembers,
        contributionAmount: data.contributionAmount,
        contributionFrequency: data.contributionFrequency,
        currency: data.currency || 'KES',
        visibility: data.visibility || Visibility.PUBLIC,
        status: ChamaStatus.DRAFT,
        shareableLink,
        qrCode,
        settings: {
          ...data.settings,
          enabledModules,
          ...organizationProfile,
        } as any, // JSON field
        memberships: {
          create: {
            userId: founderId,
            role: MemberRole.FOUNDER,
            status: MemberStatus.ACTIVE,
            approvedAt: new Date(),
            reliabilityScore: 100, // Founder starts with perfect score
          },
        },
      },
      include: {
        memberships: true,
      },
    });

    // Schedule welcome notifications
    await backgroundJobService.createJob({
      type: BackgroundJobType.NOTIFICATION_DELIVERY,
      payload: {
        type: NotificationType.GENERAL_UPDATE,
        recipientId: founderId,
        title: 'Chama Created Successfully',
        message: `Your ${data.type} chama "${data.name}" has been created successfully. Share your link: ${process.env.FRONTEND_URL}/join/${shareableLink}`,
        priority: NotificationPriority.INFO,
      },
      scheduledAt: new Date(Date.now() + 1000), // 1 second delay
    });

    logger.info('Chama created', {
      chamaId: chama.id,
      founderId,
      type: storedType as any,
      visibility: data.visibility,
      organizationKind: organizationProfile.organizationKind,
      organizationLabel: organizationProfile.organizationLabel,
      shareableLink,
    });

    return chama;
  }

  /**
   * Get public chamas for browsing with advanced filtering
   * Requirements: 6.1, 6.2
   */
  static async getPublicChamas(
    page: number = 1,
    limit: number = 20,
    filters?: {
      search?: string;
      type?: ChamaType;
      minContribution?: number;
      maxContribution?: number;
      frequency?: string;
      location?: string;
    }
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      visibility: 'PUBLIC',
      status: 'ACTIVE',
    };

    // Text search
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Type filter
    if (filters?.type) {
      where.type = filters.type;
    }

    // Contribution amount range filter
    if (filters?.minContribution !== undefined || filters?.maxContribution !== undefined) {
      where.contributionAmount = {};
      if (filters.minContribution !== undefined) {
        where.contributionAmount.gte = filters.minContribution;
      }
      if (filters.maxContribution !== undefined) {
        where.contributionAmount.lte = filters.maxContribution;
      }
    }

    // Frequency filter
    if (filters?.frequency) {
      where.contributionFrequency = filters.frequency;
    }

    const [chamas, total] = await Promise.all([
      prisma.chama.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          maxMembers: true,
          contributionAmount: true,
          contributionFrequency: true,
          currency: true,
          shareableLink: true,
          qrCode: true,
          createdAt: true,
          _count: {
            select: { 
              memberships: true,
              contributions: true,
            },
          },
          memberships: {
            where: { status: 'ACTIVE' },
            select: {
              role: true,
              reliabilityScore: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            take: 3, // Show first 3 members as preview
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.chama.count({ where }),
    ]);

    // Calculate success metrics for each chama
    const chamasWithMetrics = await Promise.all(
      chamas.map(async (chama) => {
        const metrics = await this.calculateChamaSuccessMetrics(chama.id);
        return {
          ...chama,
          successMetrics: metrics,
          availableSlots: chama.maxMembers - chama._count.memberships,
        };
      })
    );

    return {
      chamas: chamasWithMetrics,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate success metrics for a Chama
   * Requirements: 6.2, 6.5
   */
  static async calculateChamaSuccessMetrics(chamaId: string) {
    const [
      totalContributions,
      onTimeContributions,
      activeLoans,
      completedLoans,
      memberCount,
      avgReliabilityScore,
    ] = await Promise.all([
      prisma.contribution.count({
        where: { chamaId },
      }),
      prisma.contribution.count({
        where: {
          chamaId,
          status: 'PAID',
          paidDate: { not: null },
        },
      }),
      prisma.loan.count({
        where: { chamaId, status: 'ACTIVE' },
      }),
      prisma.loan.count({
        where: { chamaId, status: 'PAID' },
      }),
      prisma.chamaMembership.count({
        where: { chamaId, status: 'ACTIVE' },
      }),
      prisma.chamaMembership.aggregate({
        where: { chamaId, status: 'ACTIVE' },
        _avg: { reliabilityScore: true },
      }),
    ]);

    const contributionSuccessRate = totalContributions > 0
      ? (onTimeContributions / totalContributions) * 100
      : 0;

    const loanRepaymentRate = (activeLoans + completedLoans) > 0
      ? (completedLoans / (activeLoans + completedLoans)) * 100
      : 0;

    return {
      memberCount,
      contributionSuccessRate: Math.round(contributionSuccessRate * 100) / 100,
      loanRepaymentRate: Math.round(loanRepaymentRate * 100) / 100,
      avgReliabilityScore: avgReliabilityScore._avg.reliabilityScore
        ? Math.round(Number(avgReliabilityScore._avg.reliabilityScore) * 100) / 100
        : 0,
      totalContributions,
      activeLoans,
    };
  }

  /**
   * Get Chama recommendations based on user preferences
   * Requirements: 6.3
   */
  static async getRecommendedChamas(userId: string, limit: number = 10) {
    // Get user's existing memberships to understand preferences
    const userMemberships = await prisma.chamaMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        chama: true,
      },
    });

    // Determine user preferences from existing memberships
    const preferredTypes = new Set(userMemberships.map(m => m.chama.type));
    const avgContribution = userMemberships.length > 0
      ? userMemberships.reduce((sum, m) => sum + Number(m.chama.contributionAmount), 0) / userMemberships.length
      : null;
    const preferredFrequency = userMemberships.length > 0 && userMemberships[0]
      ? userMemberships[0].chama.contributionFrequency
      : null;

    // Build recommendation query
    const where: any = {
      visibility: 'PUBLIC',
      status: 'ACTIVE',
    };

    // Filter by preferred types if user has memberships
    if (preferredTypes.size > 0) {
      where.type = { in: Array.from(preferredTypes) };
    }

    // Filter by similar contribution amounts (within 50% range)
    if (avgContribution !== null) {
      where.contributionAmount = {
        gte: avgContribution * 0.5,
        lte: avgContribution * 1.5,
      };
    }

    // Filter by preferred frequency
    if (preferredFrequency) {
      where.contributionFrequency = preferredFrequency;
    }

    // Exclude chamas user is already a member of
    const existingChamaIds = userMemberships.map(m => m.chamaId);
    if (existingChamaIds.length > 0) {
      where.id = { notIn: existingChamaIds };
    }

    // Get recommended chamas
    const chamas = await prisma.chama.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        maxMembers: true,
        contributionAmount: true,
        contributionFrequency: true,
        currency: true,
        shareableLink: true,
        qrCode: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            contributions: true,
          },
        },
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            reliabilityScore: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 3,
        },
      },
      take: limit,
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    // Calculate success metrics and match score for each chama
    const chamasWithScores = await Promise.all(
      chamas.map(async (chama) => {
        const metrics = await this.calculateChamaSuccessMetrics(chama.id);
        
        // Calculate match score based on preferences
        let matchScore = 0;
        if (preferredTypes.has(chama.type)) matchScore += 30;
        if (avgContribution && Math.abs(Number(chama.contributionAmount) - avgContribution) < avgContribution * 0.3) {
          matchScore += 25;
        }
        if (preferredFrequency === chama.contributionFrequency) matchScore += 20;
        if (metrics.contributionSuccessRate > 80) matchScore += 15;
        if (metrics.avgReliabilityScore > 70) matchScore += 10;

        return {
          ...chama,
          successMetrics: metrics,
          matchScore,
          availableSlots: chama.maxMembers - chama._count.memberships,
          recommendationReason: this.generateRecommendationReason(chama, metrics, {
            preferredTypes: Array.from(preferredTypes),
            avgContribution,
            preferredFrequency,
          }),
        };
      })
    );

    // Sort by match score
    chamasWithScores.sort((a, b) => b.matchScore - a.matchScore);

    return chamasWithScores;
  }

  /**
   * Generate recommendation reason text
   * Requirements: 6.3
   */
  private static generateRecommendationReason(
    chama: any,
    metrics: any,
    preferences: {
      preferredTypes: ChamaType[];
      avgContribution: number | null;
      preferredFrequency: string | null;
    }
  ): string {
    const reasons: string[] = [];

    if (preferences.preferredTypes.includes(chama.type)) {
      reasons.push(`Matches your preferred ${chama.type} type`);
    }

    if (preferences.avgContribution && Math.abs(Number(chama.contributionAmount) - preferences.avgContribution) < preferences.avgContribution * 0.3) {
      reasons.push('Similar contribution amount to your current groups');
    }

    if (preferences.preferredFrequency === chama.contributionFrequency) {
      reasons.push(`${chama.contributionFrequency} contributions match your preference`);
    }

    if (metrics.contributionSuccessRate > 80) {
      reasons.push(`High success rate (${metrics.contributionSuccessRate}%)`);
    }

    if (metrics.avgReliabilityScore > 70) {
      reasons.push('Reliable member base');
    }

    if (reasons.length === 0) {
      reasons.push('Active and accepting new members');
    }

    return reasons.join(', ');
  }

  /**
   * Get featured/successful Chamas
   * Requirements: 6.5
   */
  static async getFeaturedChamas(limit: number = 5) {
    const chamas = await prisma.chama.findMany({
      where: {
        visibility: 'PUBLIC',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        maxMembers: true,
        contributionAmount: true,
        contributionFrequency: true,
        currency: true,
        shareableLink: true,
        qrCode: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            contributions: true,
          },
        },
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            reliabilityScore: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 3,
        },
      },
      take: limit * 3, // Get more to filter by success metrics
    });

    // Calculate success metrics and filter for high performers
    const chamasWithMetrics = await Promise.all(
      chamas.map(async (chama) => {
        const metrics = await this.calculateChamaSuccessMetrics(chama.id);
        
        // Calculate overall success score
        const successScore = 
          (metrics.contributionSuccessRate * 0.4) +
          (metrics.loanRepaymentRate * 0.3) +
          (metrics.avgReliabilityScore * 0.3);

        return {
          ...chama,
          successMetrics: metrics,
          successScore,
          availableSlots: chama.maxMembers - chama._count.memberships,
        };
      })
    );

    // Sort by success score and return top performers
    chamasWithMetrics.sort((a, b) => b.successScore - a.successScore);
    
    return chamasWithMetrics.slice(0, limit);
  }

  /**
   * Bookmark a Chama for later (user interest tracking)
   * Requirements: 6.4
   */
  static async bookmarkChama(userId: string, chamaId: string) {
    // Verify chama exists and is public
    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (chama.visibility === 'PRIVATE') {
      throw new ForbiddenError('Cannot bookmark private chamas');
    }

    // Check if already a member
    const existingMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (existingMembership && existingMembership.status === 'ACTIVE') {
      throw new ConflictError('Already a member of this chama');
    }

    // For now, we'll use a notification as a bookmark mechanism
    // In a full implementation, you'd create a separate Bookmark model
    await notificationService.createNotification({
      recipientId: userId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.INFO,
      title: 'Chama Bookmarked',
      message: `You've bookmarked ${chama.name}. We'll notify you when there are openings.`,
      channels: inAppChannel(userId),
    });

    logger.info('Chama bookmarked', {
      userId,
      chamaId,
      chamaName: chama.name,
    });

    return {
      success: true,
      message: 'Chama bookmarked successfully',
    };
  }

  /**
   * Get detailed chama information
   */
  static async getChamaDetails(chamaId: string, userId: string): Promise<ChamaDetails | null> {
    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!chama) {
      return null;
    }

    // Check if user has access (member or public chama)
    const isMember = chama.memberships.some(m => m.userId === userId);
    if (chama.visibility === 'PRIVATE' && !isMember) {
      throw new ForbiddenError('Access denied to private chama');
    }

    return chama;
  }

  /**
   * Update chama settings
   * Requirements: 2.4, 7.4
   */
  static async updateChama(chamaId: string, updates: UpdateChamaInput, userId: string): Promise<Chama> {
    // Verify user has permission (founder or chair)
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership || (membership.role !== MemberRole.FOUNDER && membership.role !== MemberRole.CHAIR)) {
      throw new ForbiddenError('Insufficient permissions to update chama');
    }

    // Get current chama to validate type-specific settings
    const currentChama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!currentChama) {
      throw new NotFoundError('Chama not found');
    }

    if (!isEditableChama(currentChama.status)) {
      throw new ForbiddenError('Archived or closed chamas cannot be edited');
    }

    let updatePayload: any = updates;

    // If settings are being updated, merge with existing settings then validate.
    if (updates.settings) {
      const currentSettings = (currentChama.settings as Record<string, unknown>) || {};
      const mergedSettings = {
        ...currentSettings,
        ...updates.settings,
      };

      validateTypeSpecificSettings(currentChama.type, mergedSettings);

      updatePayload = {
        ...updates,
        settings: mergedSettings,
      };
    }

    const chama = await prisma.chama.update({
      where: { id: chamaId },
      data: updatePayload,
    });

    logger.info('Chama updated', {
      chamaId,
      updatedBy: userId,
      updates,
    });

    return chama;
  }

  /**
   * Join a chama (creates membership application)
   * Requirements: 2.1, 2.4, 2.5, 3.2, 3.3
   */
  static async joinChama(
    userId: string, 
    chamaId: string, 
    shareableLink?: string,
    termsAgreed?: boolean,
    applicationMessage?: string
  ) {
    // Verify chama exists and is active
    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (!canJoinChama(chama.status)) {
      throw new ForbiddenError('Chama is not accepting new members');
    }

    // Check shareable link for private/invite-only chamas
    if (chama.visibility === Visibility.PRIVATE || chama.visibility === Visibility.INVITE_ONLY) {
      if (!shareableLink || chama.shareableLink !== shareableLink) {
        throw new ForbiddenError('Invalid or missing invitation link');
      }
    }

    // Verify terms agreement for new members
    if (!termsAgreed) {
      throw new BadRequestError('You must agree to the Chama terms and conditions to join');
    }

    // Check if user is already a member
    const existingMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === MemberStatus.ACTIVE) {
        throw new ConflictError('Already a member of this chama');
      } else if (existingMembership.status === MemberStatus.INVITATION_SENT) {
        const updatedMembership = await prisma.chamaMembership.update({
          where: {
            chamaId_userId: {
              chamaId,
              userId,
            },
          },
          data: {
            status: MemberStatus.PENDING_APPROVAL,
            updatedAt: new Date(),
          },
        });

        await this.notifyLeadershipOfApplication(chamaId, userId, 'rejoin', applicationMessage);

        return updatedMembership;
      } else if (isPendingMemberStatus(existingMembership.status)) {
        throw new ConflictError('Membership application already pending approval');
      } else if (existingMembership.status === MemberStatus.EXITED || existingMembership.status === MemberStatus.ARCHIVED) {
        // Reactivate membership - requires approval
        const updatedMembership = await prisma.chamaMembership.update({
          where: {
            chamaId_userId: {
              chamaId,
              userId,
            },
          },
          data: {
            status: MemberStatus.PENDING_APPROVAL,
            updatedAt: new Date(),
          },
        });

        // Notify leadership of rejoin request
        await this.notifyLeadershipOfApplication(chamaId, userId, 'rejoin', applicationMessage);

        return updatedMembership;
      }
    }
    // Check member limit (including pending applications)
    const memberCount = await prisma.chamaMembership.count({
      where: { 
        chamaId, 
        status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING, MemberStatus.PENDING_APPROVAL, MemberStatus.INVITATION_SENT] }
      },
    });

    if (memberCount >= chama.maxMembers) {
      throw new ConflictError('Chama is at maximum capacity');
    }

    // Get user details for KYC check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create membership application (PENDING_APPROVAL status)
    const membership = await prisma.chamaMembership.create({
      data: {
        chamaId,
        userId,
        role: MemberRole.MEMBER,
        status: MemberStatus.PENDING_APPROVAL, // Requires approval
        reliabilityScore: 50, // Default starting score
      },
    });

    // Log the application with terms agreement
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'ChamaMembership',
        entityId: `${chamaId}:${userId}`,
        userId,
        chamaId,
        newValues: {
          status: MemberStatus.PENDING_APPROVAL,
          termsAgreed: true,
          applicationMessage,
          kycStatus: user.kycStatus,
        },
        metadata: {
          shareableLinkUsed: !!shareableLink,
          applicationDate: new Date(),
        },
      },
    });

    // Notify chama leadership of new application
    await this.notifyLeadershipOfApplication(chamaId, userId, 'new', applicationMessage);

    // Notify applicant
    await notificationService.createNotification({
      recipientId: userId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.INFO,
      title: 'Membership Application Submitted',
      message: `Your application to join ${chama.name} has been submitted and is pending approval from the Chama leadership.`,
      channels: inAppChannel(userId),
    });

    logger.info('Membership application created', {
      chamaId,
      userId,
      kycStatus: user.kycStatus,
    });

    return membership;
  }

  /**
   * Notify Chama leadership of new membership application
   * Requirements: 3.3, 4.1
   */
  private static async notifyLeadershipOfApplication(
    chamaId: string,
    applicantId: string,
    applicationType: 'new' | 'rejoin',
    applicationMessage?: string
  ) {
    // Get chama leadership (Founder, Chair, Secretary)
    const leadership = await prisma.chamaMembership.findMany({
      where: {
        chamaId,
        role: { in: [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.SECRETARY] },
        status: MemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Get applicant details
    const applicant = await prisma.user.findUnique({
      where: { id: applicantId },
      select: { 
        firstName: true, 
        lastName: true, 
        email: true,
        kycStatus: true,
      },
    });

    if (!applicant) return;

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
      select: { name: true },
    });

    // Notify each leader
    for (const leader of leadership) {
      await notificationService.createNotification({
        recipientId: leader.userId,
        chamaId,
        type: NotificationType.GENERAL_UPDATE,
        priority: NotificationPriority.IMPORTANT,
        title: `New Membership Application - ${chama?.name}`,
        message: `${applicant.firstName} ${applicant.lastName} has applied to ${applicationType === 'rejoin' ? 'rejoin' : 'join'} the Chama. KYC Status: ${applicant.kycStatus}. ${applicationMessage ? `Message: ${applicationMessage}` : ''}`,
        channels: inAppChannel(leader.userId),
      });
    }
  }

  /**
   * Approve membership application
   * Requirements: 3.3, 4.1
   */
  static async approveMembershipApplication(
    chamaId: string,
    applicantId: string,
    approverId: string,
    approvalNotes?: string
  ) {
    // Verify approver has permission (Founder, Chair, or Secretary)
    const approverMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: approverId },
      },
    });

    if (!approverMembership || 
        !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(approverMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to approve membership applications');
    }

    // Get the pending membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: applicantId },
      },
      include: {
        chama: true,
        user: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership application not found');
    }

    if (!isPendingMemberStatus(membership.status)) {
      throw new BadRequestError('Membership is not in pending status');
    }

    // Check member limit one more time
    const activeCount = await prisma.chamaMembership.count({
      where: { chamaId, status: MemberStatus.ACTIVE },
    });

    if (activeCount >= membership.chama.maxMembers) {
      throw new ConflictError('Chama is at maximum capacity');
    }

    // Approve the membership
    const approvedMembership = await prisma.chamaMembership.update({
      where: {
        chamaId_userId: { chamaId, userId: applicantId },
      },
      data: {
        status: MemberStatus.ACTIVE,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log the approval
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'ChamaMembership',
        entityId: `${chamaId}:${applicantId}`,
        userId: approverId,
        chamaId,
        oldValues: { status: membership.status },
        newValues: { status: MemberStatus.ACTIVE },
        metadata: {
          approvalNotes,
          approvedAt: new Date(),
        },
      },
    });

    // Notify the new member
    await notificationService.createNotification({
      recipientId: applicantId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.IMPORTANT,
      title: 'Membership Approved!',
      message: `Congratulations! Your membership to ${membership.chama.name} has been approved. Welcome to the Chama!`,
      channels: inAppChannel(applicantId),
    });

    // Notify other members
    await backgroundJobService.createJob({
      type: BackgroundJobType.NOTIFICATION_DELIVERY,
      payload: {
        type: NotificationType.GENERAL_UPDATE,
        chamaId,
        title: 'New Member Joined',
        message: `${membership.user.firstName} ${membership.user.lastName} has joined ${membership.chama.name}`,
        priority: NotificationPriority.INFO,
      },
      scheduledAt: new Date(Date.now() + 5000),
    });

    logger.info('Membership application approved', {
      chamaId,
      applicantId,
      approverId,
    });

    return approvedMembership;
  }

  /**
   * Reject membership application
   * Requirements: 3.3, 4.1
   */
  static async rejectMembershipApplication(
    chamaId: string,
    applicantId: string,
    rejecterId: string,
    rejectionReason: string
  ) {
    // Verify rejecter has permission (Founder, Chair, or Secretary)
    const rejecterMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: rejecterId },
      },
    });

    if (!rejecterMembership || 
        !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(rejecterMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to reject membership applications');
    }

    // Get the pending membership
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: applicantId },
      },
      include: {
        chama: true,
        user: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Membership application not found');
    }

    if (!isPendingMemberStatus(membership.status)) {
      throw new BadRequestError('Membership is not in pending status');
    }

    // Archive the membership application for auditability
    await prisma.chamaMembership.update({
      where: {
        chamaId_userId: { chamaId, userId: applicantId },
      },
      data: {
        status: MemberStatus.ARCHIVED,
        archivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log the rejection
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'ChamaMembership',
        entityId: `${chamaId}:${applicantId}`,
        userId: rejecterId,
        chamaId,
        oldValues: { status: membership.status },
        newValues: { status: MemberStatus.ARCHIVED },
        metadata: {
          rejectionReason,
          rejectedAt: new Date(),
        },
      },
    });

    // Notify the applicant
    await notificationService.createNotification({
      recipientId: applicantId,
      chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.IMPORTANT,
      title: 'Membership Application Update',
      message: `Your application to join ${membership.chama.name} was not approved at this time. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
      channels: inAppChannel(applicantId),
    });

    logger.info('Membership application rejected', {
      chamaId,
      applicantId,
      rejecterId,
      reason: rejectionReason,
    });

    return { success: true, message: 'Membership application rejected' };
  }

  /**
   * Get pending membership applications for a Chama
   * Requirements: 3.3, 4.1
   */
  static async getPendingApplications(chamaId: string, requesterId: string) {
    // Verify requester has permission
    const requesterMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: { chamaId, userId: requesterId },
      },
    });

    if (!requesterMembership || 
        !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(requesterMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to view membership applications');
    }

    // Get all pending applications
    const applications = await prisma.chamaMembership.findMany({
      where: {
        chamaId,
        status: { in: [MemberStatus.PENDING, MemberStatus.PENDING_APPROVAL, MemberStatus.INVITATION_SENT] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            kycStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc', // Oldest applications first
      },
    });

    // Get audit logs for each application to retrieve application details
    const applicationsWithDetails = await Promise.all(
      applications.map(async (app) => {
        const auditLog = await prisma.auditLog.findFirst({
          where: {
            entityType: 'ChamaMembership',
            entityId: `${chamaId}:${app.userId}`,
            action: 'CREATE',
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          ...app,
          applicationMessage: auditLog?.newValues ? (auditLog.newValues as any).applicationMessage : undefined,
          applicationDate: app.joinedAt,
        };
      })
    );

    return applicationsWithDetails;
  }

  /**
   * Invite members to chama
   * Requirements: 2.1, 3.2
   */
  static async inviteMembers(chamaId: string, emails: string[], message: string, inviterId: string) {
    // Verify inviter has permission
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId: inviterId,
        },
      },
    });

    if (!membership || (membership.role !== MemberRole.FOUNDER && membership.role !== MemberRole.CHAIR)) {
      throw new ForbiddenError('Insufficient permissions to invite members');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (!canInviteMembers(chama.status)) {
      throw new ForbiddenError('Chama is not accepting invitations');
    }

    // For each email, check if user exists and send invitation
    const invitations = [];

    for (const email of emails) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        const existingMembership = await prisma.chamaMembership.findUnique({
          where: {
            chamaId_userId: {
              chamaId,
              userId: existingUser.id,
            },
          },
        });

        if (!existingMembership) {
          await prisma.chamaMembership.create({
            data: {
              chamaId,
              userId: existingUser.id,
              role: MemberRole.MEMBER,
              status: MemberStatus.INVITATION_SENT,
              invitedAt: new Date(),
            },
          });
        } else if (existingMembership.status === MemberStatus.INVITATION_SENT || existingMembership.status === MemberStatus.EXITED || existingMembership.status === MemberStatus.ARCHIVED) {
          await prisma.chamaMembership.update({
            where: {
              chamaId_userId: {
                chamaId,
                userId: existingUser.id,
              },
            },
            data: {
              status: MemberStatus.INVITATION_SENT,
              invitedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        // User exists, send direct notification
        await notificationService.createNotification({
          recipientId: existingUser.id,
          chamaId,
          type: NotificationType.GENERAL_UPDATE,
          priority: NotificationPriority.INFO,
          title: `Invitation to join ${chama.name}`,
          message: message || `You've been invited to join ${chama.name}. Visit: ${process.env.FRONTEND_URL}/join/${chama.shareableLink}`,
          channels: inAppChannel(existingUser.id),
        });
      } else {
        // User doesn't exist, would send email invitation
        // For now, we'll log this as it requires email service integration
        logger.info('Email invitation would be sent', {
          email,
          chamaId,
          chamaName: chama.name,
        });
      }

      invitations.push({ email, status: existingUser ? 'NOTIFIED' : 'EMAIL_SENT' });
    }

    return invitations;
  }

  /**
   * Get chama members with pagination
   */
  static async getChamaMembers(chamaId: string, userId: string, page: number = 1, limit: number = 50) {
    // Verify user is member
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError('Not a member of this chama');
    }

    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      prisma.chamaMembership.findMany({
        where: { chamaId, status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              kycStatus: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.chamaMembership.count({
        where: { chamaId, status: 'ACTIVE' },
      }),
    ]);

    return {
      members,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update membership role/status
   */
  static async updateMembership(membershipId: string, updates: any, updaterId: string) {
    // Parse membershipId as chamaId:userId format or find by some other means
    // For now, let's assume membershipId is in format "chamaId:userId"
    const [chamaId, userId] = membershipId.split(':');
    if (!chamaId || !userId) {
      throw new BadRequestError('Invalid membership ID format');
    }

    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
      include: { chama: true, user: true },
    });

    if (!membership) {
      throw new NotFoundError('Membership not found');
    }

    // Verify updater has permission
    const updaterMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: membership.chamaId,
          userId: updaterId,
        },
      },
    });

    if (!updaterMembership || !['FOUNDER', 'CHAIR'].includes(updaterMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to update membership');
    }

    // Prevent founder from being demoted
    if (membership.role === 'FOUNDER' && updates.role && updates.role !== 'FOUNDER') {
      throw new ForbiddenError('Cannot change founder role');
    }

    const updatedMembership = await prisma.chamaMembership.update({
      where: {
        chamaId_userId: {
          chamaId: membership.chamaId,
          userId: membership.userId,
        },
      },
      data: updates,
    });

    // Notify member of role/status change
    await notificationService.createNotification({
      recipientId: membership.userId,
      chamaId: membership.chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.IMPORTANT,
      title: 'Membership Updated',
      message: `Your role/status in ${membership.chama.name} has been updated.`,
      channels: inAppChannel(membership.userId),
    });

    return updatedMembership;
  }

  /**
   * Leave chama
   */
  static async leaveChama(userId: string, chamaId: string) {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError('Not a member of this chama');
    }

    if (membership.role === 'FOUNDER') {
      throw new ForbiddenError('Founder cannot leave chama. Transfer ownership or close chama instead.');
    }

    const outstandingLoan = await prisma.loan.findFirst({
      where: {
        chamaId,
        borrowerId: userId,
        balance: { gt: 0 },
        status: { in: ['ACTIVE', 'APPROVED', 'DEFAULTED'] },
      },
      select: { id: true },
    });

    if (outstandingLoan) {
      throw new ForbiddenError('Members with outstanding loans cannot leave until the loan is settled or formally released');
    }

    await prisma.chamaMembership.update({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
      data: {
        status: 'EXITED',
        exitedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Notify remaining members
    const chama = await prisma.chama.findUnique({ where: { id: chamaId } });
    await backgroundJobService.createJob({
      type: BackgroundJobType.NOTIFICATION_DELIVERY,
      payload: {
        type: NotificationType.GENERAL_UPDATE,
        chamaId,
        title: 'Member Left',
        message: `A member has left ${chama?.name}`,
        priority: NotificationPriority.INFO,
      },
      scheduledAt: new Date(Date.now() + 5000),
    });
  }

  /**
   * Close chama (founder only)
   */
  static async activateChama(chamaId: string, userId: string) {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership || !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(membership.role)) {
      throw new ForbiddenError('Only the creator or committee can activate a chama');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (chama.status !== ChamaStatus.DRAFT && chama.status !== ChamaStatus.SUSPENDED) {
      throw new ForbiddenError('Only draft or suspended chamas can be activated');
    }

    return prisma.chama.update({
      where: { id: chamaId },
      data: {
        status: ChamaStatus.ACTIVE,
        activatedAt: new Date(),
        suspendedAt: null,
      },
    });
  }

  /**
   * Suspend chama
   */
  static async suspendChama(chamaId: string, userId: string) {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership || !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(membership.role)) {
      throw new ForbiddenError('Only the creator or committee can suspend a chama');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (chama.status !== ChamaStatus.ACTIVE) {
      throw new ForbiddenError('Only active chamas can be suspended');
    }

    return prisma.chama.update({
      where: { id: chamaId },
      data: {
        status: ChamaStatus.SUSPENDED,
        suspendedAt: new Date(),
      },
    });
  }

  /**
   * Close chama
   */
  static async closeChama(chamaId: string, userId: string) {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership || !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(membership.role)) {
      throw new ForbiddenError('Only the creator or committee can close a chama');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (chama.status === ChamaStatus.ARCHIVED) {
      throw new ForbiddenError('Archived chamas cannot be closed again');
    }

    const activeMembers = await prisma.chamaMembership.findMany({
      where: { chamaId, status: MemberStatus.ACTIVE },
      include: { user: true },
    });

    const updatedChama = await prisma.chama.update({
      where: { id: chamaId },
      data: {
        status: ChamaStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    await backgroundJobService.createJob({
      type: BackgroundJobType.NOTIFICATION_DELIVERY,
      payload: {
        type: NotificationType.GENERAL_UPDATE,
        chamaId,
        title: 'Chama Closed',
        message: 'This chama has been closed by the leadership team.',
        priority: NotificationPriority.CRITICAL,
      },
      scheduledAt: new Date(Date.now() + 5000),
    });

    for (const member of activeMembers) {
      await notificationService.createNotification({
        recipientId: member.userId,
        chamaId,
        type: NotificationType.GENERAL_UPDATE,
        priority: NotificationPriority.CRITICAL,
        title: 'Chama Closed',
        message: 'This chama has been closed by the leadership team.',
        channels: inAppChannel(member.userId),
      });
    }

    return updatedChama;
  }

  /**
   * Archive chama
   */
  static async archiveChama(chamaId: string, userId: string) {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    if (!membership || !['FOUNDER', 'CHAIR', 'SECRETARY'].includes(membership.role)) {
      throw new ForbiddenError('Only the creator or committee can archive a chama');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    if (chama.status !== ChamaStatus.CLOSED) {
      throw new ForbiddenError('Only closed chamas can be archived');
    }

    await prisma.chamaMembership.updateMany({
      where: { chamaId },
      data: {
        status: MemberStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    return prisma.chama.update({
      where: { id: chamaId },
      data: {
        status: ChamaStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
  }
}
