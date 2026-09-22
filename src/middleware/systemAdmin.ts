import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/environment';
import { ForbiddenError, UnauthorizedError } from './errorHandler';

export const isSystemAdminEmail = (email: string, allowlist = config.systemAdminEmails) => allowlist.includes(email.trim().toLowerCase());

export const isPlatformRole = (role: string | null | undefined) => ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'].includes(role ?? '');

export const isSelfPlatformOwnerDemotion = (actor: { id: string; email: string; platformRole?: string | null }, targetId: string, nextRole: string | null, allowlist = config.systemAdminEmails) => actor.id === targetId && nextRole !== 'PLATFORM_OWNER' && (actor.platformRole === 'PLATFORM_OWNER' || isSystemAdminEmail(actor.email, allowlist));

export const requireSystemAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!isPlatformRole(req.user.platformRole) && !isSystemAdminEmail(req.user.email)) {
    return next(new ForbiddenError('CHAMAZ360 platform administrator access is required.'));
  }
  return next();
};

export const requirePlatformOwner = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new UnauthorizedError());
  if (req.user.platformRole !== 'PLATFORM_OWNER' && !isSystemAdminEmail(req.user.email)) {
    return next(new ForbiddenError('CHAMAZ360 platform owner access is required.'));
  }
  return next();
};
