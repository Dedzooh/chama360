/**
 * Notification Service
 * 
 * This service handles notification creation, delivery tracking, and user preferences
 * according to the comprehensive notification system requirements.
 * 
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5
 */

import { PrismaClient } from '@prisma/client';
import {
  NotificationData,
  NotificationChannelData,
  NotificationPreferencesData,
  CreateNotificationRequest,
  UpdateNotificationPreferencesRequest,
  NotificationDeliveryResult,
  NotificationPriority,
  NotificationChannelType,
  isInQuietHours
} from '../types/notification';
import {
  createNotificationSchema,
  updateNotificationPreferencesSchema,
  notificationQuerySchema
} from '../schemas/notification';
import { z } from 'zod';
import { sendTransactionalEmail, sendTransactionalSms } from './notificationDeliveryService';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification with multiple delivery channels
   * Requirement 25.1: Support multiple channels with member preference settings
   */
  async createNotification(data: CreateNotificationRequest): Promise<NotificationData> {
    // Validate input data
    const validatedData = createNotificationSchema.parse(data);

    // Get user notification preferences
    const preferences = await this.getUserPreferences(validatedData.recipientId);
    
    // Filter channels based on user preferences and quiet hours
    const enabledChannels = await this.filterChannelsByPreferences(
      validatedData.channels,
      preferences,
      validatedData.priority
    );

    if (enabledChannels.length === 0) {
      throw new Error('No enabled notification channels for user');
    }

    // Create notification with channels in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the notification
      const notification = await tx.notification.create({
        data: {
          recipientId: validatedData.recipientId,
          chamaId: validatedData.chamaId,
          type: validatedData.type,
          priority: validatedData.priority,
          title: validatedData.title,
          message: validatedData.message,
          scheduledFor: validatedData.scheduledFor,
          status: 'PENDING'
        }
      });

      // Create notification channels
      const channels = await Promise.all(
        enabledChannels.map(channel =>
          tx.notificationChannel.create({
            data: {
              notificationId: notification.id,
              type: channel.type,
              address: channel.address,
              status: 'PENDING'
            }
          })
        )
      );

      return { notification, channels };
    });

    return {
      ...result.notification,
      channels: result.channels
    } as NotificationData;
  }

  /**
   * Get user notification preferences, creating defaults if none exist
   * Requirement 25.1: Member preference settings
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferencesData> {
    let preferences = await this.prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    if (!preferences) {
      // Create default preferences
      preferences = await this.prisma.notificationPreferences.create({
        data: {
          userId,
          smsEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          priorityOverride: false
        }
      });
    }

    return preferences as NotificationPreferencesData;
  }

  /**
   * Update user notification preferences
   * Requirement 25.1: Member preference settings
   */
  async updateUserPreferences(
    userId: string,
    updates: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferencesData> {
    const validatedUpdates = updateNotificationPreferencesSchema.parse(updates);

    const preferences = await this.prisma.notificationPreferences.upsert({
      where: { userId },
      update: validatedUpdates,
      create: {
        userId,
        smsEnabled: true,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        priorityOverride: false,
        ...validatedUpdates
      }
    });

    return preferences as NotificationPreferencesData;
  }

  /**
   * Filter notification channels based on user preferences and quiet hours
   * Requirement 25.1: Member preference settings with quiet hours
   */
  private async filterChannelsByPreferences(
    channels: { type: NotificationChannelType; address: string }[],
    preferences: NotificationPreferencesData,
    priority: NotificationPriority
  ): Promise<{ type: NotificationChannelType; address: string }[]> {
    const now = new Date();
    
    // Check if we're in quiet hours
    const inQuietHours = preferences.quietHoursStart && preferences.quietHoursEnd
      ? isInQuietHours(now, {
          start: preferences.quietHoursStart,
          end: preferences.quietHoursEnd
        })
      : false;

    // If in quiet hours and not priority override, only allow critical notifications
    if (inQuietHours && !preferences.priorityOverride && priority !== NotificationPriority.CRITICAL) {
      return [];
    }

    // Filter channels based on user preferences
    return channels.filter(channel => {
      switch (channel.type) {
        case NotificationChannelType.SMS:
          return preferences.smsEnabled;
        case NotificationChannelType.EMAIL:
          return preferences.emailEnabled;
        case NotificationChannelType.PUSH:
          return preferences.pushEnabled;
        case NotificationChannelType.IN_APP:
          return preferences.inAppEnabled;
        default:
          return false;
      }
    });
  }

  /**
   * Update notification channel delivery status
   * Requirement 25.3: Track delivery status and acknowledgments
   */
  async updateChannelStatus(
    channelId: string,
    result: NotificationDeliveryResult
  ): Promise<NotificationChannelData> {
    const channel = await this.prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        status: result.success ? 'DELIVERED' : 'FAILED',
        deliveredAt: result.deliveredAt,
        errorMessage: result.errorMessage,
        retryCount: { increment: result.success ? 0 : 1 }
      }
    });

    return channel as NotificationChannelData;
  }

  /**
   * Mark notification as acknowledged by user
   * Requirement 25.3: Acknowledgment mechanisms for critical messages
   */
  async acknowledgeNotification(notificationId: string): Promise<NotificationData> {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { acknowledgedAt: new Date() },
      include: { channels: true }
    });

    return notification as NotificationData;
  }

  /**
   * Get notifications for a user with filtering and pagination
   * Requirement 25.4: Notification history for audit purposes
   */
  async getUserNotifications(
    recipientId: string,
    query: z.infer<typeof notificationQuerySchema>
  ): Promise<{ notifications: NotificationData[]; total: number }> {
    const validatedQuery = notificationQuerySchema.parse(query);

    const where = {
      recipientId,
      ...(validatedQuery.chamaId && { chamaId: validatedQuery.chamaId }),
      ...(validatedQuery.type && { type: validatedQuery.type }),
      ...(validatedQuery.priority && { priority: validatedQuery.priority }),
      ...(validatedQuery.status && { status: validatedQuery.status }),
      ...(validatedQuery.startDate && validatedQuery.endDate && {
        createdAt: {
          gte: validatedQuery.startDate,
          lte: validatedQuery.endDate
        }
      })
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { channels: true },
        orderBy: { createdAt: 'desc' },
        take: validatedQuery.limit,
        skip: validatedQuery.offset
      }),
      this.prisma.notification.count({ where })
    ]);

    return {
      notifications: notifications as NotificationData[],
      total
    };
  }

  /**
   * Get pending notifications for delivery processing
   * Requirement 25.5: Queue notifications for delivery when connectivity restored
   */
  async getPendingNotifications(limit: number = 100): Promise<NotificationData[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } }
        ]
      },
      include: { channels: true },
      orderBy: [
        { priority: 'desc' }, // Critical first
        { createdAt: 'asc' }   // Oldest first
      ],
      take: limit
    });

    return notifications as NotificationData[];
  }

  /**
   * Get channels that need retry delivery
   * Requirement 25.5: Retry failed deliveries
   */
  async getChannelsForRetry(maxRetries: number = 3): Promise<NotificationChannelData[]> {
    const channels = await this.prisma.notificationChannel.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: maxRetries }
      },
      include: { notification: true },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    return channels as NotificationChannelData[];
  }

  /**
   * Mark notification as sent (all channels processed)
   * Requirement 25.3: Track delivery status
   */
  async markNotificationSent(notificationId: string): Promise<NotificationData> {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date()
      },
      include: { channels: true }
    });

    return notification as NotificationData;
  }

  /**
   * Get notification statistics for monitoring
   * Requirement 25.4: Audit purposes and monitoring
   */
  async getNotificationStats(chamaId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    deliveryRate: number;
  }> {
    const where = chamaId ? { chamaId } : {};

    const [
      total,
      byStatus,
      byPriority,
      byType,
      deliveredChannels,
      totalChannels
    ] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.prisma.notification.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true }
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: { type: true }
      }),
      this.prisma.notificationChannel.count({
        where: {
          status: 'DELIVERED',
          ...(chamaId && { notification: { chamaId } })
        }
      }),
      this.prisma.notificationChannel.count({
        where: chamaId ? { notification: { chamaId } } : {}
      })
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.status])),
      byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p._count.priority])),
      byType: Object.fromEntries(byType.map(t => [t.type, t._count.type])),
      deliveryRate: totalChannels > 0 ? deliveredChannels / totalChannels : 0
    };
  }

  /**
   * Send email verification notification
   */
  static async sendEmailVerification(
    email: string,
    firstName: string,
    token: string
  ): Promise<void> {
    await sendTransactionalEmail(
      email,
      'Verify your CHAMA360 email',
      `Hello ${firstName}, your email verification code is ${token}. It expires in 24 hours. Never share this code with anyone.`
    );
  }

  /**
   * Send phone verification notification
   */
  static async sendPhoneVerification(
    phone: string,
    code: string
  ): Promise<void> {
    await sendTransactionalSms(phone, `Your CHAMA360 verification code is ${code}. It expires in 24 hours. Never share this code.`);
  }

  /**
   * Send welcome notification
   */
  static async sendWelcomeNotification(userId: string): Promise<void> {
    // In a real implementation, this would create a welcome notification
    // For now, we'll just log it
    console.log(`Welcome notification sent to user: ${userId}`);
  }

  /**
   * Send profile update notification
   */
  static async sendProfileUpdateNotification(
    userId: string,
    changedFields: string[],
    requiresReVerification: boolean
  ): Promise<void> {
    // In a real implementation, this would create a profile update notification
    // For now, we'll just log it
    console.log(`Profile update notification sent to user: ${userId}, fields: ${changedFields.join(', ')}, reVerification: ${requiresReVerification}`);
  }

  /**
   * Send KYC approval notification
   */
  static async sendKycApprovalNotification(userId: string): Promise<void> {
    // In a real implementation, this would create a KYC approval notification
    // For now, we'll just log it
    console.log(`KYC approval notification sent to user: ${userId}`);
  }
}
