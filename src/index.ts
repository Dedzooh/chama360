import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import expressWinston from 'express-winston';

import { config } from './config/environment';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { roleManagementRouter } from './routes/roleManagement';
import { userRouter } from './routes/user';
import { chamaRouter } from './routes/chama';
import { organizationRouter } from './routes/organization';
import { membershipRouter } from './routes/membership';
import { contributionRouter } from './routes/contribution';
import { mpesaRouter } from './routes/mpesa';
import { loanRouter } from './routes/loan';
import { subscriptionRouter } from './routes/subscription';
import { platformSubscriptionRouter } from './routes/platformSubscription';
import { subscriptionLifecycleService } from './services/subscriptionLifecycleService';
import { notificationDeliveryService } from './services/notificationDeliveryService';
import { billingDocumentService } from './services/billingDocumentService';
import { monthlyContributionService } from './services/monthlyContributionService';
import { contributionPenaltyService } from './services/contributionPenaltyService';
import { contributionReminderService } from './services/contributionReminderService';
import { accountDeletionService } from './services/accountDeletionService';

// Create Express application
const app = express();

app.set('etag', false);

// Trust proxy for rate limiting and security headers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.path}}',
  expressFormat: true,
  colorize: false,
  requestWhitelist: ['method', 'path', 'httpVersion'],
  responseWhitelist: ['statusCode', 'responseTime'],
  headerBlacklist: ['authorization', 'cookie', 'set-cookie', 'x-api-key'],
  ignoreRoute: (req) => req.url === '/health',
}));

// Health check route (before authentication)
app.use('/health', healthRouter);

// Authentication routes
app.use('/api/v1/auth', authRouter);

// User management routes
app.use('/api/v1/user', userRouter);

// Role management routes
app.use('/api/v1/role-management', roleManagementRouter);

// Chama management routes
app.use('/api/v1/chama', chamaRouter);

// Organization / Chama foundation routes
app.use('/api/organizations', organizationRouter);
app.use('/api/v1/organizations', organizationRouter);

// Membership management routes
app.use('/api/v1/membership', membershipRouter);

// Contribution management routes
app.use('/api/v1/contribution', contributionRouter);

// Loan management routes
app.use('/api/v1/loan', loanRouter);

// M-Pesa payment integration routes
app.use('/api/v1/mpesa', mpesaRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);
app.use('/api/v1/platform/subscriptions', platformSubscriptionRouter);

// API routes will be added here as we build them
app.get('/', (_req, res) => {
  res.json({
    message: 'Chama App API',
    version: config.server.apiVersion,
    environment: config.server.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await prisma.$disconnect();
    logger.info('Database connections closed');
    
    // Close Redis connections
    await redis.quit();
    logger.info('Redis connections closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');
    await subscriptionLifecycleService.reconcileAll();
    await billingDocumentService.backfill();
    await notificationDeliveryService.processPending();
    await monthlyContributionService.reconcile();
    await contributionPenaltyService.reconcile();
    await contributionReminderService.reconcile();
    if (config.security.accountDeletionGraceDays !== undefined) {
      await accountDeletionService.anonymizeDueAccounts();
    }
    const subscriptionTimer = setInterval(() => void subscriptionLifecycleService.reconcileAll().catch((error) => logger.error('Subscription reconciliation failed', { error })), 60 * 60 * 1000);
    subscriptionTimer.unref();
    const notificationTimer = setInterval(() => void notificationDeliveryService.processPending().catch((error) => logger.error('Notification delivery failed', { error })), 60 * 1000);
    notificationTimer.unref();
    const contributionTimer = setInterval(() => void monthlyContributionService.reconcile().catch((error) => logger.error('Monthly contribution reconciliation failed', { error })), 60 * 60 * 1000);
    contributionTimer.unref();
    const penaltyTimer = setInterval(() => void contributionPenaltyService.reconcile().catch((error) => logger.error('Contribution penalty reconciliation failed', { error })), 60 * 60 * 1000);
    penaltyTimer.unref();
    const reminderTimer = setInterval(() => void contributionReminderService.reconcile().catch((error) => logger.error('Contribution reminder reconciliation failed', { error })), 60 * 60 * 1000);
    reminderTimer.unref();
    if (config.security.accountDeletionGraceDays !== undefined) {
      const deletionTimer = setInterval(() => void accountDeletionService.anonymizeDueAccounts().catch((error) => logger.error('Account anonymization failed', { error })), 60 * 60 * 1000);
      deletionTimer.unref();
    }
    
    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Server running on ${config.server.host}:${config.server.port} in ${config.server.nodeEnv} mode`);
      logger.info(`API version: ${config.server.apiVersion}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default app;


