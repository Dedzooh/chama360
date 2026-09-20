import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from '../services/authService';
import { PermissionService, Permission } from '../services/permissionService';
import { RoleSwitchingService } from '../services/roleSwitchingService';
import { UnauthorizedAccessService } from '../services/unauthorizedAccessService';
import { AppError, UnauthorizedError, ForbiddenError } from './errorHandler';
import { prisma } from '../config/database';
import { RedisService } from '../config/redis';
import { MemberRole } from '@prisma/client';
import { config } from '../config/environment';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        sessionId: string;
        kycStatus: string;
        isActive: boolean;
        platformRole?: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | null;
      };
      currentChama?: {
        id: string;
        role: MemberRole;
        status: string;
        permissions?: Permission[];
      };
      accessAttempt?: {
        action: string;
        permission?: Permission;
        blocked: boolean;
      };
    }
  }
}

/**
 * Authentication middleware - verifies JWT token and loads user
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload: JwtPayload = await AuthService.verifyAccessToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        kycStatus: true,
        isActive: true,
        platformRole: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    let platformRole = user.platformRole;
    if (!platformRole && config.systemAdminEmails.includes(user.email.trim().toLowerCase())) {
      await prisma.user.updateMany({ where: { id: user.id, platformRole: null }, data: { platformRole: 'PLATFORM_OWNER' } });
      platformRole = 'PLATFORM_OWNER';
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      sessionId: payload.sessionId,
      kycStatus: user.kycStatus,
      isActive: user.isActive,
      platformRole,
    };

    // Update session activity
    await AuthService.updateSessionActivity(payload.sessionId);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware - doesn't throw if no token
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    // Use the authenticate middleware logic
    await authenticate(req, _res, next);
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};

/**
 * KYC verification middleware - requires verified KYC status
 */
export const requireKyc = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (req.user.kycStatus !== 'VERIFIED') {
    throw new ForbiddenError('KYC verification required');
  }

  next();
};

/**
 * Chama context middleware - loads current Chama membership with role switching support
 */
export const loadChamaContext = (chamaIdParam = 'chamaId') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const chamaId = req.params[chamaIdParam] || req.body.chamaId || req.query.chamaId;
      if (!chamaId) {
        throw new ForbiddenError('Chama ID required');
      }

      // Try to get or create active Chama context with role switching support
      const activeContext = await RoleSwitchingService.validateAndRefreshContext(
        req.user.id,
        req.user.sessionId,
        chamaId as string
      );

      if (!activeContext) {
        // Log unauthorized access attempt
        await UnauthorizedAccessService.logUnauthorizedAccess({
          userId: req.user.id,
          sessionId: req.user.sessionId,
          chamaId: chamaId as string,
          attemptedAction: `${req.method} ${req.path}`,
          reason: 'Not a member of this Chama or membership not active',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestPath: req.path,
          requestMethod: req.method,
          severity: 'MEDIUM',
          blocked: true,
        });

        throw new ForbiddenError('Not a member of this Chama or membership not active');
      }

      // Get user permissions for this Chama
      const permissions = await PermissionService.getUserPermissions(req.user.id, chamaId as string);

      // Attach Chama context to request
      req.currentChama = {
        id: activeContext.chamaId,
        role: activeContext.role,
        status: 'ACTIVE', // Active context means active membership
        permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...allowedRoles: MemberRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Backward-compatible fallback:
      // if no explicit chama context middleware was used, resolve membership from request payload.
      if (!req.currentChama) {
        if (!req.user) {
          throw new ForbiddenError('Authentication required');
        }

        const chamaId = (req.params.chamaId || req.body.chamaId || req.query.chamaId) as string | undefined;
        if (!chamaId) {
          throw new ForbiddenError('Chama context required');
        }

        const membership = await prisma.chamaMembership.findUnique({
          where: {
            chamaId_userId: {
              chamaId,
              userId: req.user.id,
            },
          },
        });

        if (!membership || membership.status !== 'ACTIVE') {
          throw new ForbiddenError('Not a member of this Chama or membership not active');
        }

        req.currentChama = {
          id: chamaId,
          role: membership.role,
          status: membership.status,
        };
      }

      if (!allowedRoles.includes(req.currentChama.role)) {
        // Log unauthorized access attempt
        await UnauthorizedAccessService.logUnauthorizedAccess({
          userId: req.user?.id,
          sessionId: req.user?.sessionId,
          chamaId: req.currentChama.id,
          attemptedAction: `${req.method} ${req.path}`,
          currentRole: req.currentChama.role,
          requiredRole: allowedRoles,
          reason: `Role ${req.currentChama.role} not in allowed roles: ${allowedRoles.join(', ')}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestPath: req.path,
          requestMethod: req.method,
          severity: 'MEDIUM',
          blocked: true,
        });

        throw new ForbiddenError(`Requires one of the following roles: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (...permissions: Permission[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.currentChama) {
        throw new ForbiddenError('Authentication and Chama context required');
      }

      // Check if access is blocked
      const userBlocked = await UnauthorizedAccessService.isAccessBlocked('user', req.user.id);
      const ipBlocked = req.ip ? await UnauthorizedAccessService.isAccessBlocked('ip', req.ip) : false;

      if (userBlocked || ipBlocked) {
        await UnauthorizedAccessService.logUnauthorizedAccess({
          userId: req.user.id,
          sessionId: req.user.sessionId,
          chamaId: req.currentChama.id,
          attemptedAction: `${req.method} ${req.path}`,
          attemptedPermission: permissions[0], // Log first permission for simplicity
          currentRole: req.currentChama.role,
          reason: userBlocked ? 'User access blocked' : 'IP access blocked',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestPath: req.path,
          requestMethod: req.method,
          severity: 'HIGH',
          blocked: true,
        });

        throw new ForbiddenError('Access blocked due to security restrictions');
      }

      // Check each required permission
      for (const permission of permissions) {
        const result = await PermissionService.hasPermission(
          req.user.id,
          req.currentChama.id,
          permission
        );

        if (!result.granted) {
          // Log unauthorized access attempt
          await UnauthorizedAccessService.logUnauthorizedAccess({
            userId: req.user.id,
            sessionId: req.user.sessionId,
            chamaId: req.currentChama.id,
            attemptedAction: `${req.method} ${req.path}`,
            attemptedPermission: permission,
            currentRole: req.currentChama.role,
            requiredRole: result.requiredRole,
            reason: result.reason || 'Permission denied',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            requestPath: req.path,
            requestMethod: req.method,
            severity: 'MEDIUM',
            blocked: true,
          });

          throw new ForbiddenError(
            result.reason || `Permission ${permission} required`
          );
        }
      }

      // Store access attempt info for successful access
      req.accessAttempt = {
        action: `${req.method} ${req.path}`,
        permission: permissions[0],
        blocked: false,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Administrative roles middleware (Chair, Treasurer, Secretary, Auditor)
 */
export const requireAdminRole = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const adminRoles: MemberRole[] = ['FOUNDER', 'CHAIR', 'TREASURER', 'SECRETARY', 'AUDITOR'];
  return requireRole(...adminRoles)(req, _res, next);
};

/**
 * Financial roles middleware (Founder, Chair, Treasurer)
 */
export const requireFinancialRole = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const financialRoles: MemberRole[] = ['FOUNDER', 'CHAIR', 'TREASURER'];
  return requireRole(...financialRoles)(req, _res, next);
};

/**
 * Leadership roles middleware (Founder, Chair)
 */
export const requireLeadershipRole = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const leadershipRoles: MemberRole[] = ['FOUNDER', 'CHAIR'];
  return requireRole(...leadershipRoles)(req, _res, next);
};

/**
 * Permission-based middleware for member management
 */
export const requireMemberManagement = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  return requirePermission(Permission.MANAGE_MEMBERS)(req, _res, next);
};

/**
 * Permission-based middleware for financial operations
 */
export const requireFinancialAccess = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  return requirePermission(Permission.VIEW_FINANCIAL_REPORTS)(req, _res, next);
};

/**
 * Permission-based middleware for loan management
 */
export const requireLoanManagement = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  return requirePermission(Permission.APPROVE_LOANS, Permission.DISBURSE_LOANS)(req, _res, next);
};

/**
 * Permission-based middleware for governance operations
 */
export const requireGovernanceAccess = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  return requirePermission(Permission.MANAGE_VOTES, Permission.RESOLVE_DISPUTES)(req, _res, next);
};

/**
 * Multi-factor authentication middleware
 */
export const requireMfa = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Check if user has MFA enabled
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      throw new ForbiddenError('Multi-factor authentication required');
    }

    const session = await AuthService.getSession(req.user.sessionId);
    if (!session || session.userId !== req.user.id || session.mfaVerified !== true) {
      throw new ForbiddenError('This session has not completed multi-factor authentication');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting middleware for sensitive operations
 */
export const rateLimitSensitive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const limit = 10;
    const windowSeconds = 60;
    const routePath = typeof req.route?.path === 'string' ? req.route.path : req.path;
    const action = `${req.user.id}:${req.method}:${req.baseUrl}${routePath}`;
    const key = `sensitive_rate:${AuthService.fingerprintToken(action)}`;
    const { count, ttl } = await RedisService.incrementWithExpiry(key, windowSeconds);
    const retryAfter = Math.max(ttl, 1);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(limit - count, 0)));
    res.setHeader('RateLimit-Reset', String(retryAfter));

    if (count > limit) {
      res.setHeader('Retry-After', String(retryAfter));
      throw new AppError('Too many sensitive operations; try again later', 429, 'RATE_LIMITED', {
        retryAfter,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Audit logging middleware for sensitive operations
 */
export const auditSensitiveOperation = (action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Store audit information in request for later logging
    (req as any).auditAction = action;
    (req as any).auditMetadata = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      chamaId: req.currentChama?.id,
    };

    next();
  };
};

/**
 * Middleware to check if user can switch roles within a Chama
 */
export const allowRoleSwitch = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { chamaId, newRole } = req.body;

    if (!chamaId || !newRole) {
      throw new ForbiddenError('Chama ID and new role required');
    }

    // Check if user has multiple roles in this Chama (if supported)
    // For now, users have one role per Chama, so this would require admin approval
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId: req.user.id,
        },
      },
      select: { role: true, status: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      await UnauthorizedAccessService.logUnauthorizedAccess({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        chamaId,
        attemptedAction: 'ROLE_SWITCH',
        currentRole: membership?.role,
        reason: 'Active membership required for role switching',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestPath: req.path,
        requestMethod: req.method,
        severity: 'MEDIUM',
        blocked: true,
      });

      throw new ForbiddenError('Active membership required');
    }

    // Only founders and chairs can switch roles (simplified logic)
    if (!['FOUNDER', 'CHAIR'].includes(membership.role)) {
      await UnauthorizedAccessService.logUnauthorizedAccess({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        chamaId,
        attemptedAction: 'ROLE_SWITCH',
        currentRole: membership.role,
        reason: 'Insufficient permissions to switch roles',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestPath: req.path,
        requestMethod: req.method,
        severity: 'HIGH',
        blocked: true,
      });

      throw new ForbiddenError('Insufficient permissions to switch roles');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware for Chama context switching
 */
export const allowChamaSwitch = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { chamaId } = req.body;

    if (!chamaId) {
      throw new ForbiddenError('Chama ID required for context switching');
    }

    // Validate that user is a member of the target Chama
    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId,
          userId: req.user.id,
        },
      },
      select: { 
        role: true, 
        status: true,
        chama: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!membership) {
      await UnauthorizedAccessService.logUnauthorizedAccess({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        chamaId,
        attemptedAction: 'CHAMA_CONTEXT_SWITCH',
        reason: 'Not a member of target Chama',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestPath: req.path,
        requestMethod: req.method,
        severity: 'MEDIUM',
        blocked: true,
      });

      throw new ForbiddenError('Not a member of the target Chama');
    }

    if (membership.status !== 'ACTIVE') {
      await UnauthorizedAccessService.logUnauthorizedAccess({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        chamaId,
        attemptedAction: 'CHAMA_CONTEXT_SWITCH',
        currentRole: membership.role,
        reason: `Membership status is ${membership.status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestPath: req.path,
        requestMethod: req.method,
        severity: 'MEDIUM',
        blocked: true,
      });

      throw new ForbiddenError(`Membership status is ${membership.status}`);
    }

    if (membership.chama.status !== 'ACTIVE') {
      await UnauthorizedAccessService.logUnauthorizedAccess({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        chamaId,
        attemptedAction: 'CHAMA_CONTEXT_SWITCH',
        currentRole: membership.role,
        reason: `Chama status is ${membership.chama.status}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestPath: req.path,
        requestMethod: req.method,
        severity: 'MEDIUM',
        blocked: true,
      });

      throw new ForbiddenError(`Chama status is ${membership.chama.status}`);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate session and refresh if needed
 */
export const validateSession = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.sessionId) {
      return next();
    }

    // Get session from Redis
    const session = await AuthService.getSession(req.user.sessionId);
    
    if (!session) {
      throw new UnauthorizedError('Session expired');
    }

    // Check if session is too old (optional security measure)
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    
    if (sessionAge > maxSessionAge) {
      await AuthService.revokeSession(req.user.sessionId);
      throw new UnauthorizedError('Session expired due to age');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require session-level MFA assurance when the account has opted into MFA.
 * This supports a gradual rollout without locking out users who have not yet
 * enrolled, while preventing enrolled accounts from bypassing their second factor.
 */
export const requireMfaIfEnabled = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedError('User not found');

    if (user.mfaEnabled) {
      const session = await AuthService.getSession(req.user.sessionId);
      if (!session || session.userId !== req.user.id || session.mfaVerified !== true) {
        throw new ForbiddenError('Complete multi-factor authentication before this action');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
