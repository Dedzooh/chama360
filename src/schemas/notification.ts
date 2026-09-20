/**
 * Notification and System Model Validation Schemas
 * 
 * This file defines Zod validation schemas for notification and system models
 * to ensure type safety and business rule compliance.
 * 
 * Requirements: 18.1, 25.1, 25.2, 27.4
 */

import { z } from 'zod';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannelType,
  BackgroundJobType,
  AuditAction,
  isValidQuietHoursFormat
} from '../types/notification';

// Base validation schemas
const cuidSchema = z.string().cuid();
const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
const quietHoursTimeSchema = z.string().refine(isValidQuietHoursFormat, {
  message: 'Time must be in HH:MM format (24-hour)'
});

// Notification Schemas
export const createNotificationSchema = z.object({
  recipientId: cuidSchema,
  chamaId: cuidSchema.optional(),
  type: z.nativeEnum(NotificationType),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.INFO),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  channels: z.array(z.object({
    type: z.nativeEnum(NotificationChannelType),
    address: z.string().min(1, 'Channel address is required')
  })).min(1, 'At least one notification channel is required'),
  scheduledFor: z.date().optional()
}).refine((data) => {
  // Validate channel addresses based on type
  return data.channels.every(channel => {
    switch (channel.type) {
      case NotificationChannelType.EMAIL:
        return z.string().email().safeParse(channel.address).success;
      case NotificationChannelType.SMS:
        return phoneSchema.safeParse(channel.address).success;
      case NotificationChannelType.PUSH:
      case NotificationChannelType.IN_APP:
        return cuidSchema.safeParse(channel.address).success;
      default:
        return false;
    }
  });
}, {
  message: 'Invalid channel address format for channel type'
});

export const updateNotificationPreferencesSchema = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  quietHoursStart: quietHoursTimeSchema.optional(),
  quietHoursEnd: quietHoursTimeSchema.optional(),
  priorityOverride: z.boolean().optional()
}).refine((data) => {
  // If quiet hours are provided, both start and end must be provided
  const hasStart = data.quietHoursStart !== undefined;
  const hasEnd = data.quietHoursEnd !== undefined;
  return hasStart === hasEnd;
}, {
  message: 'Both quietHoursStart and quietHoursEnd must be provided together'
});

export const notificationPreferencesSchema = z.object({
  id: cuidSchema,
  userId: cuidSchema,
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  quietHoursStart: quietHoursTimeSchema.nullable(),
  quietHoursEnd: quietHoursTimeSchema.nullable(),
  priorityOverride: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
}).refine((data) => {
  // Validate quiet hours consistency
  const hasStart = data.quietHoursStart !== null;
  const hasEnd = data.quietHoursEnd !== null;
  return hasStart === hasEnd;
}, {
  message: 'Quiet hours start and end must both be set or both be null'
});

// Background Job Schemas
export const createBackgroundJobSchema = z.object({
  type: z.nativeEnum(BackgroundJobType),
  payload: z.any().optional(),
  scheduledAt: z.date().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3)
});

export const backgroundJobSchema = z.object({
  id: cuidSchema,
  type: z.nativeEnum(BackgroundJobType),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  payload: z.any().nullable(),
  result: z.any().nullable(),
  error: z.string().nullable(),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0),
  scheduledAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const updateBackgroundJobSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  retryCount: z.number().int().min(0).optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional()
});

// Audit Log Schemas
export const createAuditLogSchema = z.object({
  action: z.nativeEnum(AuditAction),
  entityType: z.string().min(1, 'Entity type is required').max(50, 'Entity type too long'),
  entityId: cuidSchema,
  userId: cuidSchema.optional(),
  chamaId: cuidSchema.optional(),
  oldValues: z.any().optional(),
  newValues: z.any().optional(),
  metadata: z.any().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500, 'User agent too long').optional(),
  requestId: z.string().max(128).optional(),
  reason: z.string().max(1000).optional(),
  transactionId: cuidSchema.optional(),
  approvalChain: z.any().optional()
});

export const auditLogSchema = z.object({
  id: cuidSchema,
  action: z.nativeEnum(AuditAction),
  entityType: z.string(),
  entityId: cuidSchema,
  userId: cuidSchema.nullable(),
  chamaId: cuidSchema.nullable(),
  oldValues: z.any().nullable(),
  newValues: z.any().nullable(),
  metadata: z.any().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.date()
});

// Query parameter schemas
export const notificationQuerySchema = z.object({
  recipientId: cuidSchema.optional(),
  chamaId: cuidSchema.optional(),
  type: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional()
}).refine((data) => {
  // Validate date range
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date'
});

export const backgroundJobQuerySchema = z.object({
  type: z.nativeEnum(BackgroundJobType).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

export const auditLogQuerySchema = z.object({
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().optional(),
  entityId: cuidSchema.optional(),
  userId: cuidSchema.optional(),
  chamaId: cuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

// Notification channel validation
export const notificationChannelSchema = z.object({
  id: cuidSchema,
  notificationId: cuidSchema,
  type: z.nativeEnum(NotificationChannelType),
  address: z.string(),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']),
  deliveredAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const updateNotificationChannelSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  deliveredAt: z.date().optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().min(0).optional()
});

// Batch operation schemas
export const batchNotificationSchema = z.object({
  notifications: z.array(createNotificationSchema).min(1).max(100)
});

export const batchAuditLogSchema = z.object({
  auditLogs: z.array(createAuditLogSchema).min(1).max(100)
});

// Export all schemas for easy import
export const notificationSchemas = {
  create: createNotificationSchema,
  updatePreferences: updateNotificationPreferencesSchema,
  preferences: notificationPreferencesSchema,
  query: notificationQuerySchema,
  channel: notificationChannelSchema,
  updateChannel: updateNotificationChannelSchema,
  batch: batchNotificationSchema
};

export const backgroundJobSchemas = {
  create: createBackgroundJobSchema,
  update: updateBackgroundJobSchema,
  schema: backgroundJobSchema,
  query: backgroundJobQuerySchema
};

export const auditLogSchemas = {
  create: createAuditLogSchema,
  schema: auditLogSchema,
  query: auditLogQuerySchema,
  batch: batchAuditLogSchema
};