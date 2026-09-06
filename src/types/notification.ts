/**
 * Notification and System Model Types
 * 
 * This file defines TypeScript interfaces for notification and system models
 * as specified in the design document for the Chama Management System.
 * 
 * Requirements: 25.1, 25.2, 27.4
 */

// Notification Types
export interface NotificationData {
  id: string;
  recipientId: string;
  chamaId?: string;
  organizationId?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  acknowledgedAt?: Date;
  createdAt: Date;
  channels: NotificationChannelData[];
}

export interface NotificationChannelData {
  id: string;
  notificationId: string;
  type: NotificationChannelType;
  address: string;
  status: NotificationChannelStatus;
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferencesData {
  id: string;
  userId: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string; // Format: "HH:MM"
  quietHoursEnd?: string;   // Format: "HH:MM"
  priorityOverride: boolean; // Allow critical notifications during quiet hours
  createdAt: Date;
  updatedAt: Date;
}

// Background Job Types
export interface BackgroundJobData {
  id: string;
  type: BackgroundJobType;
  status: BackgroundJobStatus;
  payload?: any; // Job parameters
  result?: any;  // Job result data
  error?: string; // Error message if failed
  retryCount: number;
  maxRetries: number;
  scheduledAt?: Date; // When job should run
  startedAt?: Date;   // When job execution started
  completedAt?: Date; // When job finished (success or failure)
  createdAt: Date;
  updatedAt: Date;
}

// Audit Log Types
export interface AuditLogData {
  id: string;
  action: AuditAction;
  entityType: string; // e.g., "User", "Chama", "Transaction"
  entityId: string;   // ID of the affected entity
  userId?: string;    // User who performed the action (null for system actions)
  chamaId?: string;   // Related Chama if applicable
  oldValues?: any;    // Previous state (for updates)
  newValues?: any;    // New state (for creates/updates)
  metadata?: any;     // Additional context data
  ipAddress?: string; // Client IP address
  userAgent?: string; // Client user agent
  createdAt: Date;
}

// Enum Types (matching Prisma enums)
export enum NotificationType {
  CONTRIBUTION_DUE = 'CONTRIBUTION_DUE',
  MEETING_REMINDER = 'MEETING_REMINDER',
  LOAN_OVERDUE = 'LOAN_OVERDUE',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  VOTE_STARTED = 'VOTE_STARTED',
  PAYOUT_READY = 'PAYOUT_READY',
  GENERAL_UPDATE = 'GENERAL_UPDATE'
}

export enum NotificationPriority {
  CRITICAL = 'CRITICAL',
  IMPORTANT = 'IMPORTANT',
  INFO = 'INFO'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export enum NotificationChannelType {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

export enum NotificationChannelStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export enum BackgroundJobType {
  NOTIFICATION_DELIVERY = 'NOTIFICATION_DELIVERY',
  CONTRIBUTION_REMINDER = 'CONTRIBUTION_REMINDER',
  PENALTY_CALCULATION = 'PENALTY_CALCULATION',
  LOAN_INTEREST_CALCULATION = 'LOAN_INTEREST_CALCULATION',
  PAYOUT_PROCESSING = 'PAYOUT_PROCESSING',
  SHARE_OUT_CALCULATION = 'SHARE_OUT_CALCULATION',
  DATA_RECONCILIATION = 'DATA_RECONCILIATION',
  AUDIT_CLEANUP = 'AUDIT_CLEANUP',
  REPORT_GENERATION = 'REPORT_GENERATION'
}

export enum BackgroundJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  LOAN_APPROVED = 'LOAN_APPROVED',
  LOAN_DISBURSED = 'LOAN_DISBURSED',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  VOTE_CAST = 'VOTE_CAST',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_SUSPENDED = 'MEMBER_SUSPENDED',
  CHAMA_CREATED = 'CHAMA_CREATED',
  CONTRIBUTION_MADE = 'CONTRIBUTION_MADE',
  PAYOUT_PROCESSED = 'PAYOUT_PROCESSED'
}

// Request/Response Types for API
export interface CreateNotificationRequest {
  recipientId: string;
  chamaId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  channels: {
    type: NotificationChannelType;
    address: string;
  }[];
  scheduledFor?: Date;
}

export interface UpdateNotificationPreferencesRequest {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  priorityOverride?: boolean;
}

export interface CreateBackgroundJobRequest {
  type: BackgroundJobType;
  payload?: any;
  scheduledAt?: Date;
  maxRetries?: number;
}

export interface CreateAuditLogRequest {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  chamaId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Utility Types
export interface NotificationDeliveryResult {
  channelId: string;
  success: boolean;
  deliveredAt?: Date;
  errorMessage?: string;
}

export interface JobExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number; // milliseconds
}

export interface QuietHours {
  start: string; // Format: "HH:MM"
  end: string;   // Format: "HH:MM"
}

// Validation helpers
export const isValidQuietHoursFormat = (time: string): boolean => {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

export const isInQuietHours = (
  currentTime: Date,
  quietHours: QuietHours
): boolean => {
  const current = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startParts = quietHours.start.split(':').map(Number);
  const endParts = quietHours.end.split(':').map(Number);
  
  if (startParts.length !== 2 || endParts.length !== 2) {
    return false;
  }
  
  const [startHour, startMin] = startParts;
  const [endHour, endMin] = endParts;
  
  if (startHour === undefined || startMin === undefined || 
      endHour === undefined || endMin === undefined) {
    return false;
  }
  
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  
  if (start <= end) {
    // Same day range (e.g., 09:00 to 17:00)
    return current >= start && current <= end;
  } else {
    // Overnight range (e.g., 22:00 to 06:00)
    return current >= start || current <= end;
  }
};
