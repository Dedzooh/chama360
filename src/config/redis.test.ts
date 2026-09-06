import { redis, RedisService } from './redis';

describe('Redis Configuration', () => {
  beforeEach(async () => {
    // Clear test data
    await redis.flushdb();
  });

  it('should connect to Redis successfully', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });

  it('should set and get values correctly', async () => {
    await RedisService.set('test-key', 'test-value');
    const value = await RedisService.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should handle JSON objects', async () => {
    const testObject = { name: 'test', value: 123 };
    await RedisService.set('test-object', testObject);
    const retrieved = await RedisService.get('test-object', true);
    expect(retrieved).toEqual(testObject);
  });

  it('should handle expiration correctly', async () => {
    await RedisService.set('expiring-key', 'value', 1);
    
    // Should exist immediately
    const exists = await RedisService.exists('expiring-key');
    expect(exists).toBe(true);
    
    // Should expire after 1 second
    await new Promise(resolve => setTimeout(resolve, 1100));
    const existsAfter = await RedisService.exists('expiring-key');
    expect(existsAfter).toBe(false);
  });

  it('should handle sets correctly', async () => {
    await RedisService.sadd('test-set', 'member1', 'member2', 'member3');
    
    const members = await RedisService.smembers('test-set');
    expect(members).toHaveLength(3);
    expect(members).toContain('member1');
    expect(members).toContain('member2');
    expect(members).toContain('member3');
    
    const isMember = await RedisService.sismember('test-set', 'member1');
    expect(isMember).toBe(true);
    
    const isNotMember = await RedisService.sismember('test-set', 'member4');
    expect(isNotMember).toBe(false);
  });

  it('should handle hash operations correctly', async () => {
    await RedisService.hset('test-hash', 'field1', 'value1');
    await RedisService.hset('test-hash', 'field2', 'value2');
    
    const value1 = await RedisService.hget('test-hash', 'field1');
    expect(value1).toBe('value1');
    
    const allFields = await RedisService.hgetall('test-hash');
    expect(allFields).toEqual({
      field1: 'value1',
      field2: 'value2',
    });
  });

  it('should handle increment operations', async () => {
    const count1 = await RedisService.incr('counter');
    expect(count1).toBe(1);
    
    const count2 = await RedisService.incr('counter');
    expect(count2).toBe(2);
    
    const count3 = await RedisService.incrby('counter', 5);
    expect(count3).toBe(7);
  });
});