import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { requireSystemAdmin } from '../middleware/systemAdmin';

const MAX_SESSION_MINUTES = 30;
const impersonationStartSchema = z.object({
  targetUserId: z.string().cuid(),
  reason: z.string().min(10).max(500),
  organizationId: z.string().cuid().optional(),
  minutes: z.number().int().min(5).max(MAX_SESSION_MINUTES).default(15),
});

export function registerPlatformImpersonationRoutes(router: Router, context: any): void {
  const { auditLog } = context;

  // Start a time-boxed impersonation session. Platform admins only. The
  // session is recorded with reason + expiry; it does NOT auto-act — it only
  // authorizes subsequent requests that carry the session id, which are
  // audited with the admin identity alongside the target user.
  router.post(
    '/platform/impersonation/start',
    requireSystemAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id || !req.user.email) {
        throw new BadRequestError('Administrator not authenticated');
      }
      const adminId = req.user.id;
      const adminEmail = req.user.email;
      const payload = impersonationStartSchema.parse(req.body);
      const target = await (context.db).user.findUnique({
        where: { id: payload.targetUserId },
        select: { id: true, email: true, firstName: true, lastName: true, platformRole: true },
      });
      if (!target) throw new NotFoundError('Target user not found');
      if (target.platformRole) throw new ForbiddenError('Cannot impersonate another platform administrator');

      const expiresAt = new Date(Date.now() + payload.minutes * 60 * 1000);
      const session = await context.db.impersonationSession.create({
        data: {
          adminId,
          adminEmail,
          targetUserId: target.id,
          reason: payload.reason,
          organizationId: payload.organizationId ?? null,
          expiresAt,
        },
      });

      auditLog({
        action: 'IMPERSONATION_START',
        entityType: 'ImpersonationSession',
        entityId: session.id,
        userId: adminId,
        newValues: { targetUserId: target.id, targetEmail: target.email, reason: payload.reason, expiresAt },
        metadata: { adminEmail },
      });

      res.json({
        session: { id: session.id, expiresAt },
        target: { id: target.id, email: target.email, name: `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() },
        message: `Impersonation authorized until ${expiresAt.toISOString()}. All actions during this session are attributed to ${adminEmail} on behalf of ${target.email}.`,
      });
    })
  );

  // End a session early (voluntary or on completion of the support task).
  router.post(
    '/platform/impersonation/:sessionId/end',
    requireSystemAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user?.id) {
        throw new BadRequestError('Administrator not authenticated');
      }
      const session = await context.db.impersonationSession.findUnique({ where: { id: req.params.sessionId } });
      if (!session) throw new NotFoundError('Impersonation session not found');
      if (session.adminId !== req.user.id) throw new ForbiddenError('Only the originating admin can end this session');
      if (session.endedAt) throw new BadRequestError('Session already ended');

      const ended = await context.db.impersonationSession.update({
        where: { id: session.id },
        data: { endedAt: new Date(), endedReason: (req.body?.reason as string) ?? 'Support task completed' },
      });

      auditLog({
        action: 'IMPERSONATION_END',
        entityType: 'ImpersonationSession',
        entityId: session.id,
        userId: req.user.id,
        newValues: { endedAt: ended.endedAt, endedReason: ended.endedReason },
        metadata: { targetUserId: session.targetUserId },
      });

      res.json({ message: 'Impersonation session ended and recorded.' });
    })
  );

  // List recent sessions (platform admins reviewing support activity).
  router.get(
    '/platform/impersonation',
    requireSystemAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      const sessions = await context.db.impersonationSession.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
      });
      res.json({ sessions });
    })
  );
}
