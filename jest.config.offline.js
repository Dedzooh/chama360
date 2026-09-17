module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/config/database.test.ts$',
    '/src/config/redis.test.ts$',
    '/src/tests/memberInvitationApproval.test.ts$',
    '/src/tests/mpesa.integration.test.ts$',
    '/src/tests/notificationModels.test.ts$',
    '/src/tests/userRoutes.integration.test.ts$',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  maxWorkers: 1,
};
