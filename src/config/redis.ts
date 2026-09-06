import Redis from 'ioredis';
import { logger } from './logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

export const redis = new Redis({
  ...redisConfig,
  password: redisConfig.password || undefined,
});

export const queueRedis = new Redis({
  ...redisConfig,
  db: parseInt(process.env.REDIS_QUEUE_DB || '1'),
  password: redisConfig.password || undefined,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('Redis ready to accept commands');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

queueRedis.on('connect', () => {
  logger.info('Queue Redis connected successfully');
});

queueRedis.on('error', (error) => {
  logger.error('Queue Redis connection error:', error);
});

export class RedisService {
  static async set(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serializedValue);
    } else {
      await redis.set(key, serializedValue);
    }
  }

  static async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  static async get<T = string>(key: string, parseJson = false): Promise<T | null> {
    const value = await redis.get(key);

    if (!value) return null;

    if (parseJson) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }

    return value as T;
  }

  static async del(key: string): Promise<number> {
    return await redis.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  }

  static async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await redis.expire(key, ttlSeconds);
    return result === 1;
  }

  static async incr(key: string): Promise<number> {
    return await redis.incr(key);
  }

  static async incrby(key: string, increment: number): Promise<number> {
    return await redis.incrby(key, increment);
  }

  static async incrementWithExpiry(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
    const result = await redis.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('TTL', KEYS[1])}",
      1,
      key,
      ttlSeconds,
    ) as [number, number];
    return { count: Number(result[0]), ttl: Number(result[1]) };
  }

  static async sadd(key: string, ...members: string[]): Promise<number> {
    return await redis.sadd(key, ...members);
  }

  static async smembers(key: string): Promise<string[]> {
    return await redis.smembers(key);
  }

  static async sismember(key: string, member: string): Promise<boolean> {
    const result = await redis.sismember(key, member);
    return result === 1;
  }

  static async srem(key: string, ...members: string[]): Promise<number> {
    return await redis.srem(key, ...members);
  }

  static async hget(key: string, field: string): Promise<string | null> {
    return await redis.hget(key, field);
  }

  static async hset(key: string, field: string, value: string | number): Promise<number> {
    return await redis.hset(key, field, value);
  }

  static async hgetall(key: string): Promise<Record<string, string>> {
    return await redis.hgetall(key);
  }

  static async hdel(key: string, ...fields: string[]): Promise<number> {
    return await redis.hdel(key, ...fields);
  }
}

process.on('beforeExit', async () => {
  await redis.quit();
  await queueRedis.quit();
});

export default redis;
