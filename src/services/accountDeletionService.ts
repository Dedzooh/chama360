import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger, auditLog } from '../config/logger';
import { DocumentService } from './documentService';

export class AccountDeletionService {
  async anonymizeDueAccounts(now = new Date()): Promise<{ anonymized: number }> {
    const due = await prisma.user.findMany({
      where: {
        isActive: false,
        deletionRequestedAt: { not: null },
        deletionScheduledFor: { lte: now },
        anonymizedAt: null,
      },
      select: { id: true },
      take: 100,
    });

    for (const { id } of due) {
      await this.anonymizeAccount(id, now);
    }

    if (due.length) logger.info('Account anonymization completed', { count: due.length });
    return { anonymized: due.length };
  }

  private async anonymizeAccount(userId: string, anonymizedAt: Date): Promise<void> {
    const suffix = randomBytes(12).toString('hex');
    const passwordHash = randomBytes(48).toString('hex');

    await DocumentService.deleteUserDocuments(userId);

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { recipientId: userId } });
      await tx.notificationPreferences.deleteMany({ where: { userId } });
      await tx.auditLog.updateMany({
        where: {
          userId,
          entityType: 'KYC_DATA',
        },
        data: {
          oldValues: Prisma.DbNull,
          newValues: Prisma.DbNull,
          metadata: { redactedForAccountDeletion: true },
          ipAddress: null,
          userAgent: null,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${suffix}@invalid.chama360`,
          phone: `deleted-${suffix}`,
          nationalId: null,
          nationalIdHash: null,
          nationalIdLast4: null,
          firstName: 'Deleted',
          lastName: 'User',
          passwordHash,
          mfaSecret: null,
          mfaEnabled: false,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          deletionReason: null,
          anonymizedAt,
        },
      });
    });

    auditLog('DELETE', userId, undefined, {
      action: 'ACCOUNT_PERSONAL_DATA_ANONYMIZED',
      anonymizedAt: anonymizedAt.toISOString(),
    });
  }
}

export const accountDeletionService = new AccountDeletionService();
