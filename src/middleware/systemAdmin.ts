import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/environment';
import { ForbiddenError, UnauthorizedError } from './errorHandler';

export const isSystemAdminEmail = (email: string, allowlist = config.systemAdminEmails) => allowlist.includes(email.trim().toLowerCase());

export const requireSystemAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!isSystemAdminEmail(req.user.email)) {
    return next(new ForbiddenError('CHAMA360 platform administrator access is required.'));
  }
  return next();
};
