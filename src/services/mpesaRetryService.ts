import { prisma } from '../config/database';
import { logger } from '../config/logger';

type RetryInput = {
  contributionId: string;
  memberId: string;
  chamaId: string;
  amount: number;
  phoneNumber: string;
  retryCount: number;
};

export const scheduleMpesaRetry = async (data: RetryInput): Promise<void> => {
  const delayMinutes = Math.min(60, 5 * Math.pow(2, data.retryCount - 1));
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  await prisma.backgroundJob.create({
    data: {
      type: 'NOTIFICATION_DELIVERY',
      status: 'PENDING',
      payload: { type: 'MPESA_PAYMENT_RETRY', ...data },
      scheduledAt,
      maxRetries: 1,
    },
  });
  logger.info('Payment retry scheduled', { contributionId: data.contributionId, retryCount: data.retryCount, scheduledAt });
};
