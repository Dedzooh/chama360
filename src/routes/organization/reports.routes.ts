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
