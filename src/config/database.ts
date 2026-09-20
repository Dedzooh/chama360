import { PrismaClient } from '@prisma/client';
import { redactAuditValue } from '../utils/auditRedaction';
import { currentRequestId } from '../middleware/requestContext';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

prisma.$use(async (params, next) => {
  if ((params.model === 'AuditLog' || params.model === 'OrganizationAuditLog' || params.model === 'Transaction' || params.model === 'Notification') && (params.action === 'create' || params.action === 'createMany')) {
    const sanitize = (data: Record<string, unknown>) => ({
      ...data,
      requestId: data.requestId ?? currentRequestId(),
      ...(params.model === 'AuditLog' || params.model === 'OrganizationAuditLog' ? {
        oldValues: redactAuditValue(data.oldValues),
        newValues: redactAuditValue(data.newValues),
        metadata: redactAuditValue(data.metadata),
        approvalChain: redactAuditValue(data.approvalChain),
      } : {}),
    });

    params.args.data = Array.isArray(params.args.data)
      ? params.args.data.map((data: Record<string, unknown>) => sanitize(data))
      : sanitize(params.args.data as Record<string, unknown>);
  }

  return next(params);
});

if (process.env.NODE_ENV === 'development') {
  // Query logging can be enabled here when needed for debugging.
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
