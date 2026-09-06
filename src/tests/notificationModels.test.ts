/**
 * Notification and System Models Tests
 * 
 * This test suite verifies the notification and system models implementation
 * according to the design specifications and requirements.
 * 
 * Requirements: 25.1, 25.2, 27.4
 */

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notificationService';
import { BackgroundJobService } from '../services/backgroundJobService';
import { AuditLogService } from '../services/auditLogService';
import { IdentityProtectionService } from '../services/identityProtectionService';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannelType,
  BackgroundJobType,
  AuditAction
} from '../types/notification';

describe('Notification and System Models', () => {
  let prisma: PrismaClient;
  let notificationService: NotificationService;
  let backgroundJobService: BackgroundJobService;
  let auditLogService: AuditLogService;
  let testUserId: string;
  let testChamaId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    notificationService = new NotificationService(prisma);
    backgroundJobService = new BackgroundJobService(prisma);
    auditLogService = new AuditLogService(prisma);

    // Create test user and chama
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        phone: '+254700000000',
        ...IdentityProtectionService.protect('TEST123456'),
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashedpassword'
      }
    });
    testUserId = testUser.id;

    const testChama = await prisma.chama.create({
      data: {
        name: 'Test Chama',
        createdById: testUserId,
        type: 'ROSCA',
        description: 'Test chama for notifications',
        maxMembers: 10,
        contributionAmount: 1000,
        contributionFrequency: 'MONTHLY',
        shareableLink: 'test-chama-link',
        qrCode: 'test-qr-code',
        settings: {}
      }
    });
    testChamaId = testChama.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({});
    await prisma.backgroundJob.deleteMany({});
    await prisma.notificationChannel.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.notificationPreferences.deleteMany({});
    await prisma.chama.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Notification Models', () => {
    it('should create notification with multiple channels', async () => {
      const notification = await notificationService.createNotification({
        recipientId: testUserId,
        chamaId: testChamaId,
        type: NotificationType.CONTRIBUTION_DUE,
        priority: NotificationPriority.IMPORTANT,
        title: 'Contribution Due',
        message: 'Your monthly contribution is due tomorrow',
        channels: [
          {
            type: NotificationChannelType.SMS,
            address: '+254700000000'
          },
          {
            type: NotificationChannelType.EMAIL,
            address: 'test@example.com'
          }
        ]
      });

      expect(notification.id).toBeDefined();
      expect(notification.recipientId).toBe(testUserId);
      expect(notification.chamaId).toBe(testChamaId);
      expect(notification.type).toBe(NotificationType.CONTRIBUTION_DUE);
      expect(notification.priority).toBe(NotificationPriority.IMPORTANT);
      expect(notification.channels).toHaveLength(2);
      expect(notification.channels[0]?.type).toBe(NotificationChannelType.SMS);
      expect(notification.channels[1]?.type).toBe(NotificationChannelType.EMAIL);
    });

    it('should create and update notification preferences', async () => {
      const preferences = await notificationService.updateUserPreferences(testUserId, {
        smsEnabled: true,
        emailEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        priorityOverride: true
      });

      expect(preferences.userId).toBe(testUserId);
      expect(preferences.smsEnabled).toBe(true);
      expect(preferences.emailEnabled).toBe(false);
      expect(preferences.quietHoursStart).toBe('22:00');
      expect(preferences.quietHoursEnd).toBe('06:00');
      expect(preferences.priorityOverride).toBe(true);
    });

    it('should filter channels based on user preferences', async () => {
      // Update preferences to disable SMS
      await notificationService.updateUserPreferences(testUserId, {
        smsEnabled: false,
        emailEnabled: true
      });

      const notification = await notificationService.createNotification({
        recipientId: testUserId,
        type: NotificationType.MEETING_REMINDER,
        title: 'Meeting Reminder',
        message: 'Chama meeting tomorrow at 2 PM',
        channels: [
          {
            type: NotificationChannelType.SMS,
            address: '+254700000000'
          },
          {
            type: NotificationChannelType.EMAIL,
            address: 'test@example.com'
          }
        ]
      });

      // Should only have email channel since SMS is disabled
      expect(notification.channels).toHaveLength(1);
      expect(notification.channels[0]?.type).toBe(NotificationChannelType.EMAIL);
    });

    it('should track notification delivery status', async () => {
      const notification = await notificationService.createNotification({
        recipientId: testUserId,
        type: NotificationType.LOAN_OVERDUE,
        priority: NotificationPriority.CRITICAL,
        title: 'Loan Overdue',
        message: 'Your loan payment is overdue',
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            address: 'test@example.com'
          }
        ]
      });

      const channelId = notification.channels[0]?.id;
      if (!channelId) throw new Error('Channel not found');

      // Update delivery status
      const updatedChannel = await notificationService.updateChannelStatus(channelId, {
        channelId,
        success: true,
        deliveredAt: new Date()
      });

      expect(updatedChannel.status).toBe('DELIVERED');
      expect(updatedChannel.deliveredAt).toBeDefined();
    });

    it('should acknowledge critical notifications', async () => {
      const notification = await notificationService.createNotification({
        recipientId: testUserId,
        type: NotificationType.DISPUTE_RAISED,
        priority: NotificationPriority.CRITICAL,
        title: 'Dispute Raised',
        message: 'A dispute has been raised against you',
        channels: [
          {
            type: NotificationChannelType.IN_APP,
            address: testUserId
          }
        ]
      });

      const acknowledged = await notificationService.acknowledgeNotification(notification.id);

      expect(acknowledged.acknowledgedAt).toBeDefined();
    });
  });

  describe('Background Job Models', () => {
    it('should create and process background jobs', async () => {
      const job = await backgroundJobService.createJob({
        type: BackgroundJobType.NOTIFICATION_DELIVERY,
        payload: { notificationId: 'test-notification-id' },
        maxRetries: 3
      });

      expect(job.id).toBeDefined();
      expect(job.type).toBe(BackgroundJobType.NOTIFICATION_DELIVERY);
      expect(job.status).toBe('PENDING');
      expect(job.maxRetries).toBe(3);
      expect(job.retryCount).toBe(0);
    });

    it('should handle job execution lifecycle', async () => {
      const job = await backgroundJobService.createJob({
        type: BackgroundJobType.PENALTY_CALCULATION,
        payload: { chamaId: testChamaId }
      });

      // Start job
      const startedJob = await backgroundJobService.startJob(job.id);
      expect(startedJob.status).toBe('RUNNING');
      expect(startedJob.startedAt).toBeDefined();

      // Complete job successfully
      const completedJob = await backgroundJobService.completeJob(job.id, {
        success: true,
        result: { penaltiesCalculated: 5 },
        duration: 1500
      });

      expect(completedJob.status).toBe('COMPLETED');
      expect(completedJob.result).toEqual({ penaltiesCalculated: 5 });
      expect(completedJob.completedAt).toBeDefined();
    });

    it('should handle job failures and retries', async () => {
      const job = await backgroundJobService.createJob({
        type: BackgroundJobType.DATA_RECONCILIATION,
        payload: { chamaId: testChamaId },
        maxRetries: 2
      });

      // Start and fail job
      await backgroundJobService.startJob(job.id);
      const failedJob = await backgroundJobService.completeJob(job.id, {
        success: false,
        error: 'Database connection failed',
        duration: 500
      });

      expect(failedJob.status).toBe('FAILED');
      expect(failedJob.error).toBe('Database connection failed');

      // Retry job
      const retriedJob = await backgroundJobService.retryJob(job.id);
      expect(retriedJob.status).toBe('PENDING');
      expect(retriedJob.retryCount).toBe(1);
      expect(retriedJob.scheduledAt).toBeDefined();
    });

    it('should prevent retries beyond max limit', async () => {
      const job = await backgroundJobService.createJob({
        type: BackgroundJobType.REPORT_GENERATION,
        maxRetries: 1
      });

      // Fail and retry once
      await backgroundJobService.startJob(job.id);
      await backgroundJobService.completeJob(job.id, {
        success: false,
        error: 'First failure',
        duration: 100
      });
      await backgroundJobService.retryJob(job.id);

      // Fail again
      await backgroundJobService.startJob(job.id);
      await backgroundJobService.completeJob(job.id, {
        success: false,
        error: 'Second failure',
        duration: 100
      });

      // Should not allow another retry
      await expect(backgroundJobService.retryJob(job.id))
        .rejects.toThrow('Job has exceeded maximum retry attempts');
    });
  });

  describe('Audit Log Models', () => {
    it('should create audit logs for entity operations', async () => {
      const auditLog = await auditLogService.logCreate(
        'User',
        testUserId,
        { email: 'test@example.com', firstName: 'Test' },
        testUserId,
        testChamaId,
        { source: 'registration' }
      );

      expect(auditLog.id).toBeDefined();
      expect(auditLog.action).toBe(AuditAction.CREATE);
      expect(auditLog.entityType).toBe('User');
      expect(auditLog.entityId).toBe(testUserId);
      expect(auditLog.userId).toBe(testUserId);
      expect(auditLog.chamaId).toBe(testChamaId);
      expect(auditLog.newValues).toEqual({ email: 'test@example.com', firstName: 'Test' });
    });

    it('should log authentication events', async () => {
      const loginLog = await auditLogService.logAuthentication(
        AuditAction.LOGIN,
        testUserId,
        '192.168.1.1',
        'Mozilla/5.0...',
        { loginMethod: 'email' }
      );

      expect(loginLog.action).toBe(AuditAction.LOGIN);
      expect(loginLog.entityType).toBe('User');
      expect(loginLog.entityId).toBe(testUserId);
      expect(loginLog.ipAddress).toBe('192.168.1.1');
      expect(loginLog.userAgent).toBe('Mozilla/5.0...');
    });

    it('should log financial transactions', async () => {
      const transactionId = 'test-transaction-id';
      const transactionLog = await auditLogService.logFinancialTransaction(
        AuditAction.PAYMENT_PROCESSED,
        transactionId,
        { amount: 1000, currency: 'KES', method: 'MPESA' },
        testUserId,
        testChamaId,
        { mpesaRef: 'ABC123' }
      );

      expect(transactionLog.action).toBe(AuditAction.PAYMENT_PROCESSED);
      expect(transactionLog.entityType).toBe('Transaction');
      expect(transactionLog.entityId).toBe(transactionId);
      expect(transactionLog.newValues).toEqual({
        amount: 1000,
        currency: 'KES',
        method: 'MPESA'
      });
    });

    it('should retrieve audit trail for entity', async () => {
      // Create multiple audit logs for the same entity
      await auditLogService.logCreate('Chama', testChamaId, { name: 'Test Chama' }, testUserId);
      await auditLogService.logUpdate(
        'Chama',
        testChamaId,
        { name: 'Test Chama' },
        { name: 'Updated Test Chama' },
        testUserId
      );

      const auditTrail = await auditLogService.getEntityAuditTrail('Chama', testChamaId);

      expect(auditTrail.length).toBeGreaterThanOrEqual(2);
      expect(auditTrail[0]?.action).toBe(AuditAction.UPDATE); // Most recent first
      expect(auditTrail[1]?.action).toBe(AuditAction.CREATE);
    });

    it('should get user activity logs', async () => {
      const userActivity = await auditLogService.getUserActivity(testUserId, testChamaId);

      expect(userActivity.length).toBeGreaterThan(0);
      expect(userActivity.every(log => log.userId === testUserId)).toBe(true);
      expect(userActivity.every(log => log.chamaId === testChamaId)).toBe(true);
    });

    it('should batch create audit logs', async () => {
      const logs = [
        {
          action: AuditAction.MEMBER_JOINED,
          entityType: 'ChamaMembership',
          entityId: 'membership-1',
          userId: testUserId,
          chamaId: testChamaId
        },
        {
          action: AuditAction.CONTRIBUTION_MADE,
          entityType: 'Contribution',
          entityId: 'contribution-1',
          userId: testUserId,
          chamaId: testChamaId
        }
      ];

      const count = await auditLogService.batchCreateAuditLogs(logs);

      expect(count).toBe(2);
    });
  });

  describe('Model Integration', () => {
    it('should handle notification with background job and audit logging', async () => {
      // Create notification
      const notification = await notificationService.createNotification({
        recipientId: testUserId,
        chamaId: testChamaId,
        type: NotificationType.PAYOUT_READY,
        priority: NotificationPriority.IMPORTANT,
        title: 'Payout Ready',
        message: 'Your ROSCA payout is ready for collection',
        channels: [
          {
            type: NotificationChannelType.SMS,
            address: '+254700000000'
          }
        ]
      });

      // Create background job for notification delivery
      const job = await backgroundJobService.createJob({
        type: BackgroundJobType.NOTIFICATION_DELIVERY,
        payload: { notificationId: notification.id }
      });

      // Log the notification creation
      const auditLog = await auditLogService.logCreate(
        'Notification',
        notification.id,
        {
          type: notification.type,
          priority: notification.priority,
          recipientId: notification.recipientId
        },
        testUserId,
        testChamaId
      );

      // Verify all components work together
      expect(notification.id).toBeDefined();
      expect(job.payload.notificationId).toBe(notification.id);
      expect(auditLog.entityId).toBe(notification.id);
      expect(auditLog.newValues.type).toBe(NotificationType.PAYOUT_READY);
    });

    it('should generate comprehensive statistics', async () => {
      const [notificationStats, jobStats, auditStats] = await Promise.all([
        notificationService.getNotificationStats(testChamaId),
        backgroundJobService.getJobStats(),
        auditLogService.getAuditStats(testChamaId)
      ]);

      expect(notificationStats.total).toBeGreaterThan(0);
      expect(notificationStats.byStatus).toBeDefined();
      expect(notificationStats.byPriority).toBeDefined();
      expect(notificationStats.byType).toBeDefined();

      expect(jobStats.total).toBeGreaterThan(0);
      expect(jobStats.byStatus).toBeDefined();
      expect(jobStats.byType).toBeDefined();

      expect(auditStats.total).toBeGreaterThan(0);
      expect(auditStats.byAction).toBeDefined();
      expect(auditStats.byEntityType).toBeDefined();
    });
  });
});
