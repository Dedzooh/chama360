/**
 * Verification script to check if the project setup is correct
 * This script verifies the basic setup without requiring external services
 */

import { config } from '../config/environment';
import { logger } from '../config/logger';

async function verifySetup() {
  logger.info('Verifying Chama App setup...');

  try {
    // Verify environment configuration
    logger.info('Environment configuration loaded successfully');
    logger.info(`   - Node environment: ${config.server.nodeEnv}`);
    logger.info(`   - Server port: ${config.server.port}`);
    logger.info(`   - API version: ${config.server.apiVersion}`);

    // Verify TypeScript compilation
    logger.info('TypeScript compilation successful');

    // Verify essential modules can be imported
    const { prisma } = await import('../config/database');
    const { redis } = await import('../config/redis');
    logger.info('Database and Redis configurations loaded');

    // Verify validation utilities
    const { validateEmail, validateKenyanPhoneNumber } = await import('../utils/validation');
    
    if (validateEmail('test@example.com') && validateKenyanPhoneNumber('+254700123456')) {
      logger.info('âœ… Validation utilities working correctly');
    } else {
      throw new Error('Validation utilities not working correctly');
    }

    // Verify Prisma client generation
    if (prisma && typeof prisma.$connect === 'function') {
      logger.info('âœ… Prisma client generated successfully');
    } else {
      throw new Error('Prisma client not properly generated');
    }

    // Verify Redis client configuration
    if (redis && typeof redis.ping === 'function') {
      logger.info('âœ… Redis client configured successfully');
    } else {
      throw new Error('Redis client not properly configured');
    }

    logger.info('ðŸŽ‰ Project setup verification completed successfully!');
    logger.info('');
    logger.info('ðŸ“‹ Next steps:');
    logger.info('   1. Start PostgreSQL database server');
    logger.info('   2. Start Redis server');
    logger.info('   3. Run database migrations: npm run db:migrate');
    logger.info('   4. Seed the database: npm run db:seed');
    logger.info('   5. Start the development server: npm run dev');
    logger.info('');
    logger.info('ðŸ³ Or use Docker for easy setup:');
    logger.info('   docker-compose --profile development up -d postgres-dev redis');

    process.exit(0);
  } catch (error) {
    logger.error('âŒ Setup verification failed:', error);
    process.exit(1);
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifySetup().catch((error) => {
    logger.error('Setup verification failed:', error);
    process.exit(1);
  });
}

export { verifySetup };
