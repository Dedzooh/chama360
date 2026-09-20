import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const runFinancialTransaction = <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(operation, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 });
