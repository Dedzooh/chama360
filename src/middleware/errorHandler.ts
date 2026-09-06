import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { config } from '../config/environment';

// Custom error class for application errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    code?: string | undefined;
    details?: any;
    stack?: string | undefined;
  };
  timestamp: string;
  path: string;
  method: string;
}

// Global error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code: string | undefined;
  let details: any;

  // Handle different types of errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma database errors
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Unique constraint violation';
        code = 'DUPLICATE_ENTRY';
        details = {
          target: error.meta?.target,
        };
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint violation';
        code = 'FOREIGN_KEY_VIOLATION';
        break;
      case 'P2014':
        statusCode = 400;
        message = 'Invalid ID provided';
        code = 'INVALID_ID';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
        code = 'DATABASE_ERROR';
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 500;
    message = 'Database connection error';
    code = 'DATABASE_CONNECTION_ERROR';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    code = 'FILE_UPLOAD_ERROR';
    details = { type: error.message };
  }

  // Log error
  logger.error('Request error:', {
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
      details,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Include stack trace in development
  if (config.server.isDevelopment && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create specific error types
export class ValidationError extends AppError {
  constructor(message: string, _details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

export class UpgradeRequiredError extends AppError {
  constructor(feature: string, requiredPlan: string) {
    super(`Upgrade to ${requiredPlan} to access this feature.`, 402, 'UPGRADE_REQUIRED', { feature, requiredPlan });
    this.name = 'UpgradeRequiredError';
  }
}
