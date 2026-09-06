module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/subscriptionLifecycle.unit.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testTimeout: 10000,
  maxWorkers: 1,
};
