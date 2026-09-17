import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';

export const healthRouter = Router();

// Basic health check
healthRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    version: config.server.apiVersion,
    release: {
      androidLatestVersion: config.mobileRelease.androidLatestVersion,
      androidMinSupportedVersion: config.mobileRelease.androidMinSupportedVersion,
      androidUpdateUrl: config.mobileRelease.androidUpdateUrl,
      androidForceUpdate: config.mobileRelease.androidForceUpdate,
      androidApkSha256: config.mobileRelease.androidApkSha256,
      androidApkSizeBytes: config.mobileRelease.androidApkSizeBytes,
      androidReleasedAt: config.mobileRelease.androidReleasedAt,
      androidReleaseNotes: config.mobileRelease.androidReleaseNotes,
    },
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'healthy';
  } catch (error) {
    healthCheck.services.database = 'unhealthy';
    healthCheck.status = 'ERROR';
  }

  try {
    // Check Redis connection
    await redis.ping();
    healthCheck.services.redis = 'healthy';
  } catch (error) {
    healthCheck.services.redis = 'unhealthy';
    healthCheck.status = 'ERROR';
  }

  const statusCode = healthCheck.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}));

// Detailed health check
healthRouter.get('/detailed', asyncHandler(async (_req: Request, res: Response) => {
  const detailedHealth = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    version: config.server.apiVersion,
    release: {
      androidLatestVersion: config.mobileRelease.androidLatestVersion,
      androidMinSupportedVersion: config.mobileRelease.androidMinSupportedVersion,
      androidUpdateUrl: config.mobileRelease.androidUpdateUrl,
      androidForceUpdate: config.mobileRelease.androidForceUpdate,
      androidApkSha256: config.mobileRelease.androidApkSha256,
      androidApkSizeBytes: config.mobileRelease.androidApkSizeBytes,
      androidReleasedAt: config.mobileRelease.androidReleasedAt,
      androidReleaseNotes: config.mobileRelease.androidReleaseNotes,
    },
    services: {
      database: {
        status: 'unknown',
        responseTime: 0,
        details: {},
      },
      redis: {
        status: 'unknown',
        responseTime: 0,
        details: {},
      },
    },
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
    },
  };

  // Check database
  try {
    const dbStart = Date.now();
    const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database, current_user as user`;
    const dbEnd = Date.now();
    
    detailedHealth.services.database = {
      status: 'healthy',
      responseTime: dbEnd - dbStart,
      details: result as Record<string, any>,
    };
  } catch (error) {
    detailedHealth.services.database = {
      status: 'unhealthy',
      responseTime: 0,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    detailedHealth.status = 'ERROR';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    const redisEnd = Date.now();
    
    const info = await redis.info();
    const redisInfo = info.split('\r\n').reduce((acc, line) => {
      const [key, value] = line.split(':');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    detailedHealth.services.redis = {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      responseTime: redisEnd - redisStart,
      details: {
        version: redisInfo.redis_version,
        mode: redisInfo.redis_mode,
        connectedClients: redisInfo.connected_clients,
        usedMemory: redisInfo.used_memory_human,
      },
    };
  } catch (error) {
    detailedHealth.services.redis = {
      status: 'unhealthy',
      responseTime: 0,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
    detailedHealth.status = 'ERROR';
  }

  const statusCode = detailedHealth.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(detailedHealth);
}));

// Readiness probe (for Kubernetes)
healthRouter.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Check if all critical services are available
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// Liveness probe (for Kubernetes)
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
