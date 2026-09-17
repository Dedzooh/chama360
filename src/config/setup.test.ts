import { config } from './environment';

describe('Project Setup', () => {
  it('should load environment configuration', () => {
    expect(config).toBeDefined();
    expect(config.server).toBeDefined();
    expect(config.server.port).toBe(3000);
    expect(['development', 'test', 'production']).toContain(config.server.nodeEnv);
  });

  it('should have required configuration sections', () => {
    expect(config.database).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.jwt).toBeDefined();
    expect(config.security).toBeDefined();
  });

  it('should have proper JWT configuration', () => {
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.refreshSecret).toBeDefined();
    expect(config.jwt.expiresIn).toBe('15m');
    expect(config.jwt.refreshExpiresIn).toBe('7d');
  });

  it('should have proper security configuration', () => {
    expect(config.security.bcryptRounds).toBe(12);
    expect(config.security.sessionSecret).toBeDefined();
  });
});