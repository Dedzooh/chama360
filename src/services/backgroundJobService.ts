/**
 * Background Job Service
 * 
 * This service handles background job creation, execution tracking, and retry logic
 * for system reliability and performance requirements.
 * 
 * Requirements: 27.3, 27.4, 27.5
 */

import { PrismaClient } from '@prisma/client';
import {
  BackgroundJobData,
  CreateBackgroundJobRequest,
  JobExecutionResult,
  BackgroundJobType,
  BackgroundJobStatus
} from '../types/notification';
import {
  createBackgroundJobSchema,
  updateBackgroundJobSchema,
  backgroundJobQuerySchema
} from '../schemas/notification';
import { z } from 'zod';

export class BackgroundJobService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new background job
   * Requirement 27.3: Job queues for reconciliation, penalty calculations, and notification delivery
   */
  async createJob(data: CreateBackgroundJobRequest): Promise<BackgroundJobData> {
    const validatedData = createBackgroundJobSchema.parse(data);

    const job = await this.prisma.backgroundJob.create({
      data: {
        type: validatedData.type,
        payload: validatedData.payload,
        scheduledAt: validatedData.scheduledAt,
        maxRetries: validatedData.maxRetries,
        status: 'PENDING'
      }
    });

    return job as BackgroundJobData;
  }

  /**
   * Get next pending job for processing
   * Requirement 27.3: Job queue processing
   */
  async getNextPendingJob(jobTypes?: BackgroundJobType[]): Promise<BackgroundJobData | null> {
    const where = {
      status: 'PENDING' as BackgroundJobStatus,
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: new Date() } }
      ],
      ...(jobTypes && { type: { in: jobTypes } })
    };

    const job = await this.prisma.backgroundJob.findFirst({
      where,
      orderBy: [
        { scheduledAt: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return job as BackgroundJobData | null;
  }

  /**
   * Mark job as started
   * Requirement 27.4: Event logs for debugging and monitoring
   */
  async startJob(jobId: string): Promise<BackgroundJobData> {
    const job = await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    return job as BackgroundJobData;
  }

  /**
   * Complete job with result
   * Requirement 27.4: Event logs for debugging and monitoring
   */
  async completeJob(
    jobId: string,
    result: JobExecutionResult
  ): Promise<BackgroundJobData> {
    const updateData = updateBackgroundJobSchema.parse({
      status: result.success ? 'COMPLETED' : 'FAILED',
      result: result.result,
      error: result.error,
      completedAt: new Date()
    });

    const job = await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: updateData
    });

    return job as BackgroundJobData;
  }

  /**
   * Retry failed job with exponential backoff
   * Requirement 27.5: Retry policies with exponential backoff
   */
  async retryJob(jobId: string): Promise<BackgroundJobData> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error('Job not found');
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error('Job has exceeded maximum retry attempts');
    }

    // Calculate exponential backoff delay (2^retryCount minutes)
    const delayMinutes = Math.pow(2, job.retryCount);
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const updatedJob = await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        scheduledAt,
        error: null,
        startedAt: null,
        completedAt: null
      }
    });

    return updatedJob as BackgroundJobData;
  }

  /**
   * Cancel a pending or running job
   * Requirement 27.4: Job management and monitoring
   */
  async cancelJob(jobId: string): Promise<BackgroundJobData> {
    const job = await this.prisma.backgroundJob.update({
      where: { 
        id: jobId,
        status: { in: ['PENDING', 'RUNNING'] }
      },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    return job as BackgroundJobData;
  }

  /**
   * Get jobs with filtering and pagination
   * Requirement 27.4: Monitoring and debugging support
   */
  async getJobs(
    query: z.infer<typeof backgroundJobQuerySchema>
  ): Promise<{ jobs: BackgroundJobData[]; total: number }> {
    const validatedQuery = backgroundJobQuerySchema.parse(query);

    const where = {
      ...(validatedQuery.type && { type: validatedQuery.type }),
      ...(validatedQuery.status && { status: validatedQuery.status }),
      ...(validatedQuery.startDate && validatedQuery.endDate && {
        createdAt: {
          gte: validatedQuery.startDate,
          lte: validatedQuery.endDate
        }
      })
    };

    const [jobs, total] = await Promise.all([
      this.prisma.backgroundJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: validatedQuery.limit,
        skip: validatedQuery.offset
      }),
      this.prisma.backgroundJob.count({ where })
    ]);

    return {
      jobs: jobs as BackgroundJobData[],
      total
    };
  }

  /**
   * Get failed jobs that can be retried
   * Requirement 27.5: Error handling and retry policies
   */
  async getRetryableJobs(limit: number = 100): Promise<BackgroundJobData[]> {
    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: this.prisma.backgroundJob.fields.maxRetries }
      },
      orderBy: { completedAt: 'asc' },
      take: limit
    });

    return jobs as BackgroundJobData[];
  }

  /**
   * Clean up old completed jobs
   * Requirement 27.4: System maintenance and monitoring
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.backgroundJob.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        completedAt: { lt: cutoffDate }
      }
    });

    return result.count;
  }

  /**
   * Get job statistics for monitoring
   * Requirement 27.4: System monitoring and debugging
   */
  async getJobStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    avgExecutionTime: number;
    successRate: number;
    retryRate: number;
  }> {
    const [
      total,
      byStatus,
      byType,
      executionTimes,
      successCount,
      retryCount
    ] = await Promise.all([
      this.prisma.backgroundJob.count(),
      this.prisma.backgroundJob.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      this.prisma.backgroundJob.groupBy({
        by: ['type'],
        _count: { type: true }
      }),
      this.prisma.backgroundJob.findMany({
        where: {
          status: 'COMPLETED',
          startedAt: { not: null },
          completedAt: { not: null }
        },
        select: {
          startedAt: true,
          completedAt: true
        }
      }),
      this.prisma.backgroundJob.count({
        where: { status: 'COMPLETED' }
      }),
      this.prisma.backgroundJob.count({
        where: { retryCount: { gt: 0 } }
      })
    ]);

    // Calculate average execution time
    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, job) => {
          const duration = job.completedAt!.getTime() - job.startedAt!.getTime();
          return sum + duration;
        }, 0) / executionTimes.length
      : 0;

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.status])),
      byType: Object.fromEntries(byType.map(t => [t.type, t._count.type])),
      avgExecutionTime,
      successRate: total > 0 ? successCount / total : 0,
      retryRate: total > 0 ? retryCount / total : 0
    };
  }

  /**
   * Schedule recurring jobs (e.g., daily reconciliation)
   * Requirement 27.3: Background tasks for reconciliation and calculations
   */
  async scheduleRecurringJob(
    type: BackgroundJobType,
    payload: any,
    cronExpression: string
  ): Promise<BackgroundJobData> {
    // This is a simplified version - in production, you'd use a proper cron scheduler
    // For now, we'll schedule the next occurrence based on the cron expression
    const nextRun = this.calculateNextRun(cronExpression);

    return this.createJob({
      type,
      payload: {
        ...payload,
        isRecurring: true,
        cronExpression
      },
      scheduledAt: nextRun
    });
  }

  /**
   * Simple cron expression parser for basic scheduling
   * In production, use a proper cron library like node-cron
   */
  private calculateNextRun(cronExpression: string): Date {
    // Simplified implementation for common patterns
    const now = new Date();
    
    switch (cronExpression) {
      case '0 0 * * *': // Daily at midnight
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
        
      case '0 * * * *': // Every hour
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        return nextHour;
        
      case '*/15 * * * *': // Every 15 minutes
        const next15Min = new Date(now);
        const minutes = Math.ceil(next15Min.getMinutes() / 15) * 15;
        next15Min.setMinutes(minutes, 0, 0);
        if (minutes >= 60) {
          next15Min.setHours(next15Min.getHours() + 1, 0, 0, 0);
        }
        return next15Min;
        
      default:
        // Default to 1 hour from now
        const defaultNext = new Date(now);
        defaultNext.setHours(defaultNext.getHours() + 1);
        return defaultNext;
    }
  }
}