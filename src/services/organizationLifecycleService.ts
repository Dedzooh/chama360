import { ForbiddenError, BadRequestError } from '../middleware/errorHandler';

type LifecycleContext = {
  requireOrganizationStatus: (organizationId: string) => Promise<any>;
  getOrganizationAccess: (organizationId: string, userId: string) => Promise<any>;
  canManageOrganizationLifecycle: (membership: any) => boolean;
  updateOrganization: (organizationId: string, status: string) => Promise<any>;
  writeAudit: (params: { organizationId: string; userId?: string; action: string; entityType: string; entityId: string; oldValues?: unknown; newValues?: unknown; metadata?: unknown }) => Promise<void>;
};

export const updateOrganizationLifecycle = async (params: { organizationId: string; userId: string; targetStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED' }, context: LifecycleContext) => {
  const organization = await context.requireOrganizationStatus(params.organizationId);
  const membership = await context.getOrganizationAccess(params.organizationId, params.userId);
  if (!context.canManageOrganizationLifecycle(membership)) throw new ForbiddenError('Insufficient permissions to change organization lifecycle');

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['ACTIVE'], ACTIVE: ['SUSPENDED', 'CLOSED'], SUSPENDED: ['ACTIVE', 'CLOSED'], CLOSED: ['ARCHIVED'], ARCHIVED: [],
  };
  if (!allowedTransitions[organization.status]?.includes(params.targetStatus)) throw new BadRequestError(`Cannot transition organization from ${organization.status} to ${params.targetStatus}`);

  const before = await context.requireOrganizationStatus(params.organizationId);
  const updated = await context.updateOrganization(params.organizationId, params.targetStatus);
  await context.writeAudit({ organizationId: params.organizationId, userId: params.userId, action: 'UPDATE', entityType: 'Organization', entityId: params.organizationId, oldValues: before, newValues: updated, metadata: { targetStatus: params.targetStatus } });
  return updated;
};
