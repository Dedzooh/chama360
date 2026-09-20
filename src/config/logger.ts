import winston from 'winston';
import path from 'path';
import { currentRequestId } from '../middleware/requestContext';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const sensitiveKey = /(authorization|cookie|password|passkey|secret|token|apiKey|verificationCode|frontImage|backImage|nationalId)/i;
const personalKey = /(email|phone|address|street|postalCode|ip|ipAddress|userAgent)$/i;

const redactLogValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value as object)) return '[CIRCULAR]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    value.forEach((item, index) => { value[index] = redactLogValue(item, seen); });
    return value;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKey.test(key)) {
      (value as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (personalKey.test(key)) {
      (value as Record<string, unknown>)[key] = child ? '[PERSONAL_DATA]' : child;
    } else {
      (value as Record<string, unknown>)[key] = redactLogValue(child, seen);
    }
  }
  return value;
};

const redactSensitiveData = winston.format((info) => redactLogValue(info) as typeof info);
const addRequestId = winston.format((info) => {
  info.requestId = currentRequestId() ?? 'no-request';
  return info;
});

// Define different log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  redactSensitiveData(),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level} [${currentRequestId() ?? 'no-request'}]: ${info.message}`
  )
);

const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  addRequestId(),
  winston.format.errors({ stack: true }),
  redactSensitiveData(),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: level(),
    format: logFormat,
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileLogFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileLogFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileLogFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logError = (message: string, error?: Error, metadata?: object) => {
  logger.error(message, {
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : undefined,
    ...metadata,
  });
};

export const logInfo = (message: string, metadata?: object) => {
  logger.info(message, metadata);
};

export const logWarn = (message: string, metadata?: object) => {
  logger.warn(message, metadata);
};

export const logDebug = (message: string, metadata?: object) => {
  logger.debug(message, metadata);
};

// Audit logging for financial transactions
export const auditLog = (action: string, userId: string, chamaId?: string, metadata?: object) => {
  logger.info('AUDIT', {
    action,
    userId,
    chamaId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

export default logger;
