import type { PrismaClient } from '@prisma/client';

type OrganizationAuditParams = {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
};

export const writeOrganizationAudit = async (db: PrismaClient, params: OrganizationAuditParams) => {
  await db.organizationAuditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action as any,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues as any,
      newValues: params.newValues as any,
      metadata: params.metadata as any,
    },
  });
};
