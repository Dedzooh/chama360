import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';

type ReportsRouteContext = {
  db: any;
  getOrganizationAccess: (organizationId: string, userId: string) => Promise<any>;
  canViewAllFinancials: (membership: any) => boolean;
  hasOrganizationPermission: (membership: any, permissionKey: string) => boolean;
};

export function registerReportsRoutes(router: Router, context: ReportsRouteContext): void {
  const { db, getOrganizationAccess, canViewAllFinancials, hasOrganizationPermission } = context;

  router.get(
    '/:id/vault',
    authenticate,
    requireSubscriptionFeature('ADVANCED_EXPORTS'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id) throw new BadRequestError('User not authenticated');
      const { id } = req.params as { id: string };
      const access = await getOrganizationAccess(id, req.user.id);
      if (!canViewAllFinancials(access) && !hasOrganizationPermission(access, 'VIEW_FINANCIAL_REPORTS')) {
        throw new ForbiddenError('Only authorized finance and audit roles can export the Chama Vault');
      }

      const [organization, members, contributions, loans, welfareClaims, meetings, votes, transactions, auditLogs] = await Promise.all([
        db.organization.findUnique({ where: { id }, select: { id: true, name: true, organizationType: true, chamaType: true, slug: true, status: true, createdAt: true, updatedAt: true } }),
        db.organizationMember.findMany({ where: { organizationId: id }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, role: true } }),
        db.contribution.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'asc' } }),
        db.loan.findMany({ where: { organizationId: id }, include: { repayments: true, guarantors: true }, orderBy: { createdAt: 'asc' } }),
        db.welfareClaim.findMany({ where: { organizationId: id }, include: { approvals: true }, orderBy: { createdAt: 'asc' } }),
        db.meeting.findMany({ where: { organizationId: id }, include: { attendance: true }, orderBy: { dateTime: 'asc' } }),
        db.vote.findMany({ where: { organizationId: id }, include: { options: true, responses: true }, orderBy: { createdAt: 'asc' } }),
        db.transaction.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'asc' } }),
        db.organizationAuditLog.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'asc' } }),
      ]);

      if (!organization) throw new BadRequestError('Organization not found');
      res.setHeader('Content-Disposition', `attachment; filename="${organization.slug}-chama-vault.json"`);
      res.json({
        format: 'CHAMA360_VAULT',
        version: 1,
        generatedAt: new Date().toISOString(),
        organization,
        records: { members, contributions, loans, welfareClaims, meetings, votes, transactions, auditLogs },
      });
    }),
  );

  router.get(
    '/:id/report-export-access',
    authenticate,
    requireSubscriptionFeature('ADVANCED_EXPORTS'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id) throw new BadRequestError('User not authenticated');
      const { id } = req.params as { id: string };
      const access = await getOrganizationAccess(id, req.user.id);
      if (!canViewAllFinancials(access) && !hasOrganizationPermission(access, 'VIEW_FINANCIAL_REPORTS')) {
        throw new ForbiddenError('Only authorized finance roles can export reports');
      }
      res.json({ allowed: true, planFeature: 'ADVANCED_EXPORTS' });
    }),
  );

  router.get(
    '/:id/financial-exceptions',
    authenticate,
    requireSubscriptionFeature('ADMIN_CONTROLS'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id) throw new BadRequestError('User not authenticated');

      const { id } = req.params as { id: string };
      const access = await getOrganizationAccess(id, req.user.id);
      if (!canViewAllFinancials(access) && !hasOrganizationPermission(access, 'VIEW_FINANCIALS')) {
        throw new ForbiddenError('Only authorized finance roles can view financial exceptions');
      }

      const [transactions, callbacks] = await Promise.all([
        db.transaction.findMany({
          where: {
            organizationId: id,
            status: { in: ['RECONCILIATION_REQUIRED', 'FAILED', 'PENDING'] },
          },
          include: {
            fromMember: { select: { id: true, firstName: true, lastName: true, email: true } },
            toMember: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        db.mpesaCallbackInbox.findMany({
          where: { status: { in: ['PENDING', 'PROCESSING'] } },
          orderBy: { receivedAt: 'desc' },
          take: 200,
        }),
      ]);

      const exceptions = transactions.map((transaction: any) => {
        const metadata = transaction.metadata && typeof transaction.metadata === 'object' ? transaction.metadata : {};
        const reasons = Array.isArray(metadata.reconciliationReasons) ? metadata.reconciliationReasons : [];
        const reasonText = String(metadata.reconciliationError ?? metadata.reason ?? reasons[0] ?? '').toUpperCase();
        const type = reasonText.includes('AMOUNT') || reasonText.includes('MISMATCH')
          ? 'AMOUNT_MISMATCH'
          : reasonText.includes('REFERENCE') || reasonText.includes('MEMBER')
            ? 'UNKNOWN_MEMBER_REFERENCE'
            : reasonText.includes('DUPLICATE')
              ? 'DUPLICATE_RECEIPT_ATTEMPT'
              : transaction.status === 'FAILED'
                ? 'FAILED_RECONCILIATION'
                : transaction.type === 'CONTRIBUTION_REVERSAL'
                  ? 'REVERSAL_REQUEST'
                  : transaction.status === 'PENDING'
                    ? 'NEGATIVE_BALANCE_PREVENTION'
                    : 'UNMATCHED_MPESA_RECEIPT';

        return {
          id: transaction.id,
          source: 'TRANSACTION',
          type,
          status: transaction.status,
          amount: transaction.amount,
          reference: transaction.reference,
          member: transaction.fromMember ?? transaction.toMember,
          reason: reasons.length ? reasons.join(', ') : metadata.reconciliationError ?? metadata.reason ?? 'Requires finance review',
          createdAt: transaction.createdAt,
          metadata,
        };
      });

      const staleThreshold = Date.now() - 15 * 60 * 1000;
      const pendingCallbacks = callbacks.map((callback: any) => ({
        id: callback.id,
        source: 'MPESA_CALLBACK',
        type: new Date(callback.receivedAt).getTime() < staleThreshold ? 'STALE_STK_REQUEST' : 'PENDING_WEBHOOK_PROCESSING',
        status: callback.status,
        amount: null,
        reference: callback.checkoutRequestId,
        member: null,
        reason: callback.lastError ?? 'M-Pesa callback is awaiting processing',
        createdAt: callback.receivedAt,
        metadata: { attempts: callback.attempts, nextAttemptAt: callback.nextAttemptAt },
      }));

      res.json({ exceptions: [...exceptions, ...pendingCallbacks] });
    }),
  );

  router.get(
    '/:id/audit-logs',
    authenticate,
    requireSubscriptionFeature('AUDIT_LOGS'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params as { id: string };
      const access = await getOrganizationAccess(id, req.user.id as string);
      if (!canViewAllFinancials(access) && !hasOrganizationPermission(access, 'VIEW_AUDIT_LOGS')) {
        throw new ForbiddenError('Only authorized finance and audit roles can view audit logs');
      }

      const logs = await db.organizationAuditLog.findMany({
        where: { organizationId: id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ logs });
    }),
  );
}
