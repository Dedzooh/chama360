// @ts-nocheck
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NotificationService } from './notificationService';
import { BackgroundJobService } from './backgroundJobService';
import {
  Contribution,
  ContributionStatus,
  MemberRole,
  MemberStatus,
  TransactionType,
  TransactionStatus,
  Prisma,
} from '@prisma/client';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} from '../middleware/errorHandler';
import {
  CreateContributionCycleInput,
  RecordPaymentInput,
  UpdateContributionInput,
  GetContributionsInput,
  CalculatePenaltiesInput,
  CurrencyConversionInput,
  ContributionSummaryInput,
  BulkRecordPaymentInput,
} from '../schemas/contribution';
import {
  NotificationType,
  NotificationPriority,
  BackgroundJobType,
  NotificationChannelType,
} from '../types/notification';
import { v4 as uuidv4 } from 'uuid';
import { isOperationalChama } from '../utils/chamaLifecycle';
import { LedgerService } from './ledgerService';

// Initialize services
const notificationService = new NotificationService(prisma);
const backgroundJobService = new BackgroundJobService(prisma);

const inAppChannel = (recipientId: string) => ([
  {
    type: NotificationChannelType.IN_APP,
    address: recipientId,
  },
]);

type PaymentApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface PendingPaymentRequest {
  id: string;
  contributionId: string;
  chamaId: string;
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  submittedBy: string;
  submittedAt: Date;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

/**
 * Contribution Service
 * 
 * Handles contribution tracking and management including:
 * - Contribution cycle management with due date tracking
 * - Payment recording with multiple payment methods
 * - Penalty calculation for late contributions
 * - Multi-currency support with conversion tracking
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export class ContributionService {
  /**
   * Create a new contribution cycle for a Chama
   * Requirements: 8.1
   */
  static async createContributionCycle(
    data: CreateContributionCycleInput,
    createdBy: string
  ): Promise<Contribution[]> {
    // Verify Chama exists and user has permission
    const chama = await prisma.chama.findUnique({
      where: { id: data.chamaId },
      include: {
        memberships: {
          where: { status: MemberStatus.ACTIVE },
        },
      },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }



    if (!isOperationalChama(chama.status)) {
      throw new ForbiddenError('Contribution cycles can only be created when the chama is active');
    }
    // Verify user has permission (Treasurer, Chair, or Founder)
    const userMembership = chama.memberships.find(m => m.userId === createdBy);
    const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!userMembership || !allowedRoles.includes(userMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to create contribution cycle');
    }

    // Determine contribution amount (use provided or Chama default)
    const contributionAmount = data.amount || Number(chama.contributionAmount);

    // Determine members (use provided or all active members)
    const targetMembers = data.memberIds
      ? chama.memberships.filter(m => data.memberIds!.includes(m.userId))
      : chama.memberships;

    if (targetMembers.length === 0) {
      throw new BadRequestError('No active members found for contribution cycle');
    }

    // Create contributions for all target members
    const contributions = await prisma.$transaction(
      targetMembers.map(member =>
        prisma.contribution.create({
          data: {
            chamaId: data.chamaId,
            memberId: member.userId,
            amount: contributionAmount,
            dueDate: new Date(data.dueDate),
            status: ContributionStatus.PENDING,
          },
        })
      )
    );

    // Schedule notifications for all members
    for (const contribution of contributions) {
      await backgroundJobService.createJob({
        type: BackgroundJobType.CONTRIBUTION_REMINDER,
        payload: {
          contributionId: contribution.id,
          memberId: contribution.memberId,
          chamaId: contribution.chamaId,
          dueDate: contribution.dueDate,
          amount: contribution.amount,
        },
        scheduledAt: new Date(contribution.dueDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      });

      // Send immediate notification
      await notificationService.createNotification({
        recipientId: contribution.memberId,
        chamaId: contribution.chamaId,
        type: NotificationType.CONTRIBUTION_DUE,
        priority: NotificationPriority.IMPORTANT,
        title: 'New Contribution Due',
        message: `A contribution of ${chama.currency} ${contributionAmount} is due on ${new Date(data.dueDate).toLocaleDateString()}`,
        channels: inAppChannel(contribution.memberId),
      });
    }

    logger.info('Contribution cycle created', {
      chamaId: data.chamaId,
      contributionCount: contributions.length,
      dueDate: data.dueDate,
      amount: contributionAmount,
      createdBy,
    });

    return contributions;
  }

  /**
   * Record a payment for a contribution
   * Requirements: 8.2, 8.4
   */
  static async recordPayment(
    data: RecordPaymentInput,
    recordedBy: string
  ): Promise<Contribution> {
    // Get the contribution
    const contribution = await prisma.contribution.findUnique({
      where: { id: data.contributionId },
      include: {
        chama: true,
        member: true,
      },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    // Verify user has permission (member themselves, or Treasurer/Chair/Founder)
    const userMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: contribution.chamaId,
          userId: recordedBy,
        },
      },
    });

    const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    const canRecord = 
      recordedBy === contribution.memberId ||
      (userMembership && allowedRoles.includes(userMembership.role));

    if (!canRecord) {
      throw new ForbiddenError('Insufficient permissions to record payment');
    }

    const leadershipRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    const isLeadershipRecorder = !!userMembership && leadershipRoles.includes(userMembership.role);

    // If a regular member marks as paid, create a pending approval request instead of settling immediately.
    if (!isLeadershipRecorder) {
      const pendingRequest = await prisma.transaction.findFirst({
        where: {
          chamaId: contribution.chamaId,
          fromMemberId: contribution.memberId,
          type: TransactionType.CONTRIBUTION,
          status: TransactionStatus.PENDING,
          metadata: {
            path: ['paymentApproval', 'status'],
            equals: 'PENDING',
          },
        },
      });

      if (pendingRequest) {
        throw new ConflictError('You already have a pending payment approval request');
      }

      const paymentRequestId = `PAYREQ-${uuidv4()}`;
      await prisma.transaction.create({
        data: {
          chamaId: contribution.chamaId,
          type: TransactionType.CONTRIBUTION,
          amount: data.amount,
          fromMemberId: contribution.memberId,
          reference: `CONTRIB-PENDING-${contribution.id}-${Date.now()}`,
          idempotencyKey: paymentRequestId,
          status: TransactionStatus.PENDING,
          metadata: {
            contributionId: contribution.id,
            paymentMethod: data.paymentMethod,
            transactionRef: data.transactionRef,
            paidDate: data.paidDate,
            submittedBy: recordedBy,
            paymentApproval: {
              status: 'PENDING' as PaymentApprovalStatus,
              submittedAt: new Date(),
            },
          },
        },
      });

      const approvers = await prisma.chamaMembership.findMany({
        where: {
          chamaId: contribution.chamaId,
          role: { in: leadershipRoles },
          status: MemberStatus.ACTIVE,
        },
      });

      for (const approver of approvers) {
        await notificationService.createNotification({
          recipientId: approver.userId,
          chamaId: contribution.chamaId,
          type: NotificationType.GENERAL_UPDATE,
          priority: NotificationPriority.IMPORTANT,
          title: 'Payment Approval Needed',
          message: `${contribution.member.firstName} ${contribution.member.lastName} marked ${contribution.chama.currency} ${data.amount} as paid. Please approve.`,
          channels: inAppChannel(approver.userId),
        });
      }

      await notificationService.createNotification({
        recipientId: contribution.memberId,
        chamaId: contribution.chamaId,
        type: NotificationType.GENERAL_UPDATE,
        priority: NotificationPriority.INFO,
        title: 'Payment Submitted',
        message: 'Your payment has been submitted and is awaiting Treasurer approval.',
        channels: inAppChannel(contribution.memberId),
      });

      logger.info('Payment submitted for approval', {
        contributionId: contribution.id,
        chamaId: contribution.chamaId,
        amount: data.amount,
        submittedBy: recordedBy,
      });

      return {
        ...contribution,
        transactionRef: data.transactionRef || contribution.transactionRef,
      } as Contribution;
    }

    // Handle multi-currency conversion if needed
    let finalAmount = data.amount;
    let conversionMetadata: any = null;

    if (data.currency && data.currency !== contribution.chama.currency) {
      if (!data.exchangeRate) {
        throw new BadRequestError('Exchange rate required for currency conversion');
      }

      // Convert to Chama's currency
      finalAmount = data.amount * data.exchangeRate;
      
      conversionMetadata = {
        originalAmount: data.amount,
        originalCurrency: data.currency,
        exchangeRate: data.exchangeRate,
        convertedAmount: finalAmount,
        convertedCurrency: contribution.chama.currency,
        conversionDate: new Date(),
      };

      logger.info('Currency conversion applied', {
        contributionId: contribution.id,
        ...conversionMetadata,
      });
    }

    if (contribution.status === ContributionStatus.PAID) {
      throw new ConflictError('Contribution has already been fully paid');
    }

    const completedPayments = await prisma.transaction.findMany({
      where: {
        chamaId: contribution.chamaId,
        fromMemberId: contribution.memberId,
        type: TransactionType.CONTRIBUTION,
        status: TransactionStatus.COMPLETED,
      },
      select: { amount: true, metadata: true },
    });
    const amountAlreadyPaid = completedPayments.reduce((total: number, payment: any) => {
      const metadata = payment.metadata as { contributionId?: string } | null;
      return metadata?.contributionId === contribution.id ? total + Number(payment.amount) : total;
    }, 0);
    const amountDue = Number(contribution.amount) - Number(contribution.penalties);
    const remainingAmount = Math.max(0, amountDue - amountAlreadyPaid);

    if (finalAmount > remainingAmount) {
      throw new BadRequestError(`Payment exceeds the remaining contribution balance of ${remainingAmount.toFixed(2)}`);
    }

    const newStatus: ContributionStatus = finalAmount >= remainingAmount
      ? ContributionStatus.PAID
      : ContributionStatus.PARTIAL;

    // Check if payment is late and calculate penalties if needed
    const now = new Date();
    const isLate = now > contribution.dueDate && contribution.status !== ContributionStatus.PAID;
    let penalties = Number(contribution.penalties);

    if (isLate && newStatus !== ContributionStatus.PAID) {
      // Calculate penalties based on Chama rules
      const penaltyAmount = await this.calculatePenaltyAmount(contribution.chamaId, contribution.id);
      penalties = penaltyAmount;
    }

    // Create idempotency key for transaction
    const idempotencyKey = data.transactionRef || uuidv4();

    // Check for duplicate transaction
    const existingTransaction = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      throw new ConflictError('Payment already recorded with this transaction reference');
    }

    // Update contribution and post an idempotent ledger entry in a single database transaction
    const [updatedContribution, transaction] = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.contribution.update({
        where: { id: data.contributionId },
        data: {
          status: newStatus,
          paidDate: data.paidDate ? new Date(data.paidDate) : new Date(),
          paymentMethod: data.paymentMethod,
          transactionRef: data.transactionRef,
          penalties,
          updatedAt: new Date(),
        },
      });

      const ledgerTransaction = await LedgerService.recordContributionPayment(
        { transaction: tx },
        {
          organizationId: contribution.organizationId ?? null,
          chamaId: contribution.chamaId,
          fromMemberId: contribution.memberId,
          amount: finalAmount,
          reference: `CONTRIB-${contribution.id}-${Date.now()}`,
          idempotencyKey,
          status: TransactionStatus.COMPLETED,
          metadata: {
            contributionId: contribution.id,
            paymentMethod: data.paymentMethod,
            transactionRef: data.transactionRef,
            currencyConversion: conversionMetadata,
            recordedBy,
          },
        }
      );

      return [updated, ledgerTransaction];
    });

    // Send notification to member
    await notificationService.createNotification({
      recipientId: contribution.memberId,
      chamaId: contribution.chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.INFO,
      title: 'Payment Recorded',
      message: `Your payment of ${contribution.chama.currency} ${finalAmount} has been recorded successfully.`,
      channels: inAppChannel(contribution.memberId),
    });

    // Notify treasurer if payment was made by member
    if (recordedBy === contribution.memberId) {
      const treasurers = await prisma.chamaMembership.findMany({
        where: {
          chamaId: contribution.chamaId,
          role: MemberRole.TREASURER,
          status: MemberStatus.ACTIVE,
        },
      });

      for (const treasurer of treasurers) {
        await notificationService.createNotification({
          recipientId: treasurer.userId,
          chamaId: contribution.chamaId,
          type: NotificationType.GENERAL_UPDATE,
          priority: NotificationPriority.INFO,
          title: 'Payment Received',
          message: `${contribution.member.firstName} ${contribution.member.lastName} made a payment of ${contribution.chama.currency} ${finalAmount}`,
          channels: inAppChannel(treasurer.userId),
        });
      }
    }

    logger.info('Payment recorded', {
      contributionId: contribution.id,
      amount: finalAmount,
      paymentMethod: data.paymentMethod,
      status: newStatus,
      transactionId: transaction.id,
      recordedBy,
    });

    return updatedContribution;
  }

  static async getPendingPaymentApprovals(chamaId: string, userId: string): Promise<PendingPaymentRequest[]> {
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    const leadershipRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!membership || !leadershipRoles.includes(membership.role)) {
      throw new ForbiddenError('Insufficient permissions to view payment approvals');
    }

    const requests = await prisma.transaction.findMany({
      where: {
        chamaId,
        type: TransactionType.CONTRIBUTION,
        status: TransactionStatus.PENDING,
        metadata: {
          path: ['paymentApproval', 'status'],
          equals: 'PENDING',
        },
      },
      include: {
        fromMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => {
      const metadata = (request.metadata as any) || {};
      return {
        id: request.id,
        contributionId: metadata.contributionId,
        chamaId: request.chamaId,
        amount: Number(request.amount),
        paymentMethod: metadata.paymentMethod || 'UNKNOWN',
        transactionRef: metadata.transactionRef,
        submittedBy: metadata.submittedBy || request.fromMemberId || '',
        submittedAt: request.createdAt,
        member: request.fromMember,
      };
    });
  }

  static async approvePaymentRequest(paymentRequestId: string, approverId: string): Promise<Contribution> {
    const paymentRequest = await prisma.transaction.findUnique({
      where: { id: paymentRequestId },
    });

    if (!paymentRequest) {
      throw new NotFoundError('Payment request not found');
    }

    if (paymentRequest.status !== TransactionStatus.PENDING) {
      throw new ConflictError('Payment request is not pending approval');
    }

    const metadata = (paymentRequest.metadata as any) || {};
    const contributionId = metadata.contributionId as string | undefined;

    if (!contributionId) {
      throw new BadRequestError('Payment request is missing contribution reference');
    }

    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: paymentRequest.chamaId,
          userId: approverId,
        },
      },
    });

    const leadershipRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!membership || !leadershipRoles.includes(membership.role)) {
      throw new ForbiddenError('Insufficient permissions to approve payment');
    }

    const updatedContribution = await this.recordPayment(
      {
        contributionId,
        amount: Number(paymentRequest.amount),
        paymentMethod: metadata.paymentMethod,
        transactionRef: metadata.transactionRef || `APPROVED-${paymentRequest.id}`,
        paidDate: metadata.paidDate,
      },
      approverId
    );

    await prisma.transaction.update({
      where: { id: paymentRequest.id },
      data: {
        status: TransactionStatus.COMPLETED,
        metadata: {
          ...metadata,
          paymentApproval: {
            ...(metadata.paymentApproval || {}),
            status: 'APPROVED' as PaymentApprovalStatus,
            approvedBy: approverId,
            approvedAt: new Date(),
          },
          settlementContributionId: updatedContribution.id,
        },
      },
    });

    await notificationService.createNotification({
      recipientId: updatedContribution.memberId,
      chamaId: updatedContribution.chamaId,
      type: NotificationType.GENERAL_UPDATE,
      priority: NotificationPriority.INFO,
      title: 'Payment Approved',
      message: 'Your payment has been approved and reflected in contributions.',
      channels: inAppChannel(updatedContribution.memberId),
    });

    logger.info('Payment request approved', {
      paymentRequestId,
      contributionId: updatedContribution.id,
      approvedBy: approverId,
    });

    return updatedContribution;
  }

  /**
   * Calculate penalty amount for a contribution
   * Requirements: 8.3
   */
  private static async calculatePenaltyAmount(
    chamaId: string,
    contributionId: string
  ): Promise<number> {
    const chama = await prisma.chama.findUnique({
      where: { id: chamaId },
    });

    if (!chama) {
      throw new NotFoundError('Chama not found');
    }

    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }

    // Get penalty rules from Chama settings
    const settings = chama.settings as any;
    const penaltyRules = settings?.penaltyRules || {
      lateContributionPenalty: 0,
      penaltyType: 'FIXED',
      gracePeriodDays: 0,
      maxPenaltyAmount: null,
      compoundPenalties: false,
    };

    // Check if within grace period
    const now = new Date();
    const daysLate = Math.floor((now.getTime() - contribution.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLate <= penaltyRules.gracePeriodDays) {
      return 0;
    }

    const effectiveDaysLate = daysLate - penaltyRules.gracePeriodDays;

    let penaltyAmount = 0;

    if (penaltyRules.penaltyType === 'FIXED') {
      // Fixed penalty per day or total
      penaltyAmount = penaltyRules.compoundPenalties
        ? penaltyRules.lateContributionPenalty * effectiveDaysLate
        : penaltyRules.lateContributionPenalty;
    } else {
      // Percentage of contribution amount
      const contributionAmount = Number(contribution.amount);
      penaltyAmount = penaltyRules.compoundPenalties
        ? (contributionAmount * penaltyRules.lateContributionPenalty / 100) * effectiveDaysLate
        : contributionAmount * penaltyRules.lateContributionPenalty / 100;
    }

    // Apply maximum penalty cap if set
    if (penaltyRules.maxPenaltyAmount && penaltyAmount > penaltyRules.maxPenaltyAmount) {
      penaltyAmount = penaltyRules.maxPenaltyAmount;
    }

    return Math.round(penaltyAmount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate and apply penalties for overdue contributions
   * Requirements: 8.3
   */
  static async calculatePenalties(
    data: CalculatePenaltiesInput,
    userId: string
  ): Promise<{ contributionId: string; oldPenalty: number; newPenalty: number }[]> {


    // Verify user has permission (Treasurer, Chair, or Founder)
    let chamaId: string;

    if (data.contributionId) {
      const contribution = await prisma.contribution.findUnique({
        where: { id: data.contributionId },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      chamaId = contribution.chamaId;
    } else if (data.chamaId) {
      chamaId = data.chamaId;
    } else {
      throw new BadRequestError('Either contributionId or chamaId must be provided');
    }

    const userMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId,
        },
      },
    });

    const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!userMembership || !allowedRoles.includes(userMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to calculate penalties');
    }

    // Get overdue contributions
    const where: Prisma.ContributionWhereInput = {
      chamaId,
      status: { in: [ContributionStatus.PENDING, ContributionStatus.OVERDUE, ContributionStatus.PARTIAL] },
      dueDate: { lt: new Date() },
    };

    if (data.contributionId) {
      where.id = data.contributionId;
    }

    const overdueContributions = await prisma.contribution.findMany({
      where,
    });

    const results: { contributionId: string; oldPenalty: number; newPenalty: number }[] = [];

    // Calculate penalties for each contribution
    for (const contribution of overdueContributions) {
      const oldPenalty = Number(contribution.penalties);
      const newPenalty = await this.calculatePenaltyAmount(chamaId, contribution.id);

      results.push({
        contributionId: contribution.id,
        oldPenalty,
        newPenalty,
      });

      // Apply penalties if not a dry run
      if (!data.dryRun && newPenalty !== oldPenalty) {
        await prisma.contribution.update({
          where: { id: contribution.id },
          data: {
            penalties: newPenalty,
            status: ContributionStatus.OVERDUE,
            updatedAt: new Date(),
          },
        });

        // Create penalty transaction
        await prisma.transaction.create({
          data: {
            chamaId,
            type: TransactionType.PENALTY,
            amount: newPenalty - oldPenalty,
            fromMemberId: contribution.memberId,
            reference: `PENALTY-${contribution.id}-${Date.now()}`,
            idempotencyKey: uuidv4(),
            status: TransactionStatus.COMPLETED,
            metadata: {
              contributionId: contribution.id,
              oldPenalty,
              newPenalty,
              calculatedBy: userId,
            },
          },
        });

        // Notify member of penalty
        await notificationService.createNotification({
          recipientId: contribution.memberId,
          chamaId,
          type: NotificationType.GENERAL_UPDATE,
          priority: NotificationPriority.IMPORTANT,
          title: 'Late Contribution Penalty',
          message: `A penalty of ${newPenalty - oldPenalty} has been applied to your overdue contribution.`,
          channels: inAppChannel(contribution.memberId),
        });
      }
    }

    logger.info('Penalties calculated', {
      chamaId,
      contributionCount: results.length,
      dryRun: data.dryRun,
      calculatedBy: userId,
    });

    return results;
  }

  /**
   * Get contributions with filtering
   * Requirements: 8.1, 8.2
   */
  static async getContributions(
    filters: GetContributionsInput,
    userId: string
  ): Promise<{ contributions: Contribution[]; total: number; page: number; limit: number }> {
    // Build where clause
    const where: Prisma.ContributionWhereInput = {};

    if (filters.chamaId) {
      // Verify user has access to this Chama
      const membership = await prisma.chamaMembership.findUnique({
        where: {
          chamaId_userId: {
            chamaId: filters.chamaId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenError('Access denied to this Chama');
      }

      where.chamaId = filters.chamaId;
    }

    if (filters.memberId) {
      // Verify user can view this member's contributions
      if (filters.memberId !== userId) {
        // Check if user is leadership in the same Chama
        const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER, MemberRole.AUDITOR];
        const membership = await prisma.chamaMembership.findFirst({
          where: {
            userId,
            chamaId: filters.chamaId,
            role: { in: allowedRoles },
          },
        });

        if (!membership) {
          throw new ForbiddenError('Insufficient permissions to view other members\' contributions');
        }
      }

      where.memberId = filters.memberId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.dueDate = {};
      if (filters.fromDate) {
        where.dueDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.dueDate.lte = new Date(filters.toDate);
      }
    }

    // Get contributions with pagination
    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        include: {
          chama: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { dueDate: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      contributions,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  /**
   * Get contribution summary for a member or Chama
   * Requirements: 8.1, 8.2
   */
  static async getContributionSummary(
    data: ContributionSummaryInput,
    userId: string
  ): Promise<{
    totalContributions: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
    totalPenalties: number;
    contributionRate: number;
  }> {
    // Verify access
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: data.chamaId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError('Access denied to this Chama');
    }

    // If viewing another member's summary, check permissions
    if (data.memberId && data.memberId !== userId) {
      const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER, MemberRole.AUDITOR];
      if (!allowedRoles.includes(membership.role)) {
        throw new ForbiddenError('Insufficient permissions to view other members\' summaries');
      }
    }

    // Build where clause
    const where: Prisma.ContributionWhereInput = {
      chamaId: data.chamaId,
    };

    if (data.memberId) {
      where.memberId = data.memberId;
    }

    if (data.fromDate || data.toDate) {
      where.dueDate = {};
      if (data.fromDate) {
        where.dueDate.gte = new Date(data.fromDate);
      }
      if (data.toDate) {
        where.dueDate.lte = new Date(data.toDate);
      }
    }

    // Get aggregated data
    const [totalCount, paidCount, pendingCount, overdueCount, aggregates] = await Promise.all([
      prisma.contribution.count({ where }),
      prisma.contribution.count({ where: { ...where, status: ContributionStatus.PAID } }),
      prisma.contribution.count({ where: { ...where, status: ContributionStatus.PENDING } }),
      prisma.contribution.count({ where: { ...where, status: ContributionStatus.OVERDUE } }),
      prisma.contribution.aggregate({
        where,
        _sum: {
          amount: true,
          penalties: true,
        },
      }),
    ]);

    const totalPenalties = Number(aggregates._sum.penalties || 0);
    const contributionRate = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

    return {
      totalContributions: totalCount,
      totalPaid: paidCount,
      totalPending: pendingCount,
      totalOverdue: overdueCount,
      totalPenalties,
      contributionRate: Math.round(contributionRate * 100) / 100,
    };
  }

  /**
   * Update a contribution
   * Requirements: 8.1, 8.2
   */
  static async updateContribution(
    contributionId: string,
    data: UpdateContributionInput,
    userId: string
  ): Promise<Contribution> {
    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }



    // Verify user has permission (Treasurer, Chair, or Founder)
    const userMembership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: contribution.chamaId,
          userId,
        },
      },
    });

    const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!userMembership || !allowedRoles.includes(userMembership.role)) {
      throw new ForbiddenError('Insufficient permissions to update contribution');
    }

    const updatedContribution = await prisma.contribution.update({
      where: { id: contributionId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        updatedAt: new Date(),
      },
    });

    logger.info('Contribution updated', {
      contributionId,
      updates: data,
      updatedBy: userId,
    });

    return updatedContribution;
  }

  /**
   * Bulk record payments (for M-Pesa reconciliation)
   * Requirements: 8.2, 8.5
   */
  static async bulkRecordPayments(
    data: BulkRecordPaymentInput,
    recordedBy: string
  ): Promise<{ successful: string[]; failed: { contributionId: string; error: string }[] }> {
    const successful: string[] = [];
    const failed: { contributionId: string; error: string }[] = [];

    for (const payment of data.payments) {
      try {
        await this.recordPayment(
          {
            contributionId: payment.contributionId,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            transactionRef: payment.transactionRef,
            paidDate: payment.paidDate,
          },
          recordedBy
        );
        successful.push(payment.contributionId);
      } catch (error) {
        failed.push({
          contributionId: payment.contributionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk payments recorded', {
      total: data.payments.length,
      successful: successful.length,
      failed: failed.length,
      recordedBy,
    });

    return { successful, failed };
  }

  /**
   * Convert currency amount
   * Requirements: 8.4
   */
  static async convertCurrency(data: CurrencyConversionInput): Promise<{
    originalAmount: number;
    originalCurrency: string;
    convertedAmount: number;
    convertedCurrency: string;
    exchangeRate: number;
  }> {
    let exchangeRate = data.exchangeRate;

    // If exchange rate not provided, fetch from external API (placeholder)
    if (!exchangeRate) {
      // In a real implementation, this would call an external currency API
      // For now, we'll throw an error requiring manual rate input
      throw new BadRequestError('Exchange rate must be provided for currency conversion');
    }

    const convertedAmount = data.amount * exchangeRate;

    return {
      originalAmount: data.amount,
      originalCurrency: data.fromCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      convertedCurrency: data.toCurrency,
      exchangeRate,
    };
  }
}

