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

  if (params.targetStatus === 'ACTIVE' && organization.status === 'DRAFT') {
    const metadata = (organization.metadata ?? {}) as Record<string, any>;
    const settings = (organization.settings ?? {}) as Record<string, any>;
    const modules = (organization.enabledModules ?? {}) as Record<string, boolean>;
    const contributionRules = settings.contributionRules ?? metadata.contributionRules ?? {};
    const loanRules = settings.loanRules ?? metadata.loanRules ?? {};
    const welfareRules = settings.welfareRules ?? metadata.welfareRules ?? {};
    const payment = metadata.paymentSettings ?? {};
    const committee = Array.isArray(metadata.committeeRoles) ? metadata.committeeRoles : [];
    const missing: string[] = [];
    if (!organization.name?.trim()) missing.push('Chama name');
    if (!(Number(contributionRules.amount) > 0) || !contributionRules.dueDate) missing.push('contribution amount and schedule');
    if (!['chairperson', 'treasurer', 'secretary'].every((role) => committee.some((member: any) => member.role === role && String(member.name ?? '').trim()))) missing.push('Chairperson, Treasurer, and Secretary contacts');
    if (!payment.isEnabled || (payment.mode === 'PAYBILL' ? !payment.paybillNumber || !payment.accountNumber : !payment.mpesaNumber)) missing.push('M-Pesa payment instructions');
    if (modules.loans && (!(Number(loanRules.repaymentPeriodMonths) > 0) || !Number.isFinite(Number(loanRules.guarantorsRequired)) || Number(loanRules.guarantorsRequired) < 0)) missing.push('loan rules');
    if (modules.welfare && !(welfareRules.categories ?? []).some((category: any) => category.enabled)) missing.push('at least one welfare category');
    if (missing.length) throw new BadRequestError(`Complete the setup before activation: ${missing.join(', ')}. Save the group as a draft and finish setup in Settings.`);
  }

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['ACTIVE'], ACTIVE: ['SUSPENDED', 'CLOSED'], SUSPENDED: ['ACTIVE', 'CLOSED'], CLOSED: ['ARCHIVED'], ARCHIVED: [],
  };
  if (!allowedTransitions[organization.status]?.includes(params.targetStatus)) throw new BadRequestError(`Cannot transition organization from ${organization.status} to ${params.targetStatus}`);

  const before = await context.requireOrganizationStatus(params.organizationId);
  const updated = await context.updateOrganization(params.organizationId, params.targetStatus);
  await context.writeAudit({ organizationId: params.organizationId, userId: params.userId, action: 'UPDATE', entityType: 'Organization', entityId: params.organizationId, oldValues: before, newValues: updated, metadata: { targetStatus: params.targetStatus } });
  return updated;
};
