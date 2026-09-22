import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid database URL'),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(val => parseInt(val)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(val => parseInt(val)).default('0'),
  REDIS_QUEUE_DB: z.string().transform(val => parseInt(val)).default('1'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Server
  PORT: z.string().transform(val => parseInt(val)).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_VERSION: z.string().default('v1'),
  APP_WEB_URL: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(0).max(10)).default('1'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val)).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val)).default('100'),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(val => parseInt(val)).default('10485760'),
  UPLOAD_PATH: z.string().default('uploads'),
  
  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
  AWS_S3_FORCE_PATH_STYLE: z.string().transform(val => val === 'true').default('false'),
  AWS_S3_KMS_KEY_ID: z.string().optional(),
  DOCUMENT_HASH_SECRET: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().min(32).optional(),
  ),
  
  // M-Pesa
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().url().optional().or(z.literal('')),
  MPESA_SUBSCRIPTION_CALLBACK_URL: z.string().url().optional().or(z.literal('')),
  MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  
  // SMS Gateway
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_BASE_URL: z.string().url().optional().or(z.literal('')),
  
  // Email
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().transform(val => parseInt(val)).default('587'),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')),
  
  // KYC Provider
  KYC_API_KEY: z.string().optional(),
  KYC_BASE_URL: z.string().url().optional().or(z.literal('')),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/app.log'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val)).default('12'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  MFA_ENCRYPTION_KEY: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().regex(/^[a-fA-F0-9]{64}$/, 'MFA encryption key must be exactly 32 bytes encoded as 64 hexadecimal characters').optional(),
  ),
  IDENTITY_HASH_SECRET: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().min(32, 'Identity hash secret must be at least 32 characters').optional(),
  ),
  ACCOUNT_DELETION_GRACE_DAYS: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().transform(val => parseInt(val)).pipe(z.number().int().min(0)).optional(),
  ),
  
  // Background Jobs
  BULL_REDIS_URL: z.string().optional(),
  
  // Monitoring
  HEALTH_CHECK_INTERVAL: z.string().transform(val => parseInt(val)).default('30000'),
  METRICS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  SYSTEM_ADMIN_EMAILS: z.string().default(''),
  BILLING_BUSINESS_NAME: z.string().default('CHAMAZ360'),
  BILLING_BUSINESS_ADDRESS: z.string().default('Nairobi, Kenya'),
  BILLING_TAX_PIN: z.string().default(''),
  BILLING_VAT_RATE: z.string().transform(val => parseFloat(val)).default('0'),

  // Mobile release metadata
  ANDROID_LATEST_VERSION: z.string().optional(),
  ANDROID_MIN_SUPPORTED_VERSION: z.string().optional(),
  ANDROID_UPDATE_URL: z.string().url().optional().or(z.literal('')),
  ANDROID_FORCE_UPDATE: z.string().transform(val => val === 'true').default('false'),
  ANDROID_APK_SHA256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional().or(z.literal('')),
  ANDROID_APK_SIZE_BYTES: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().transform(val => parseInt(val)).pipe(z.number().int().positive()).optional(),
  ),
  ANDROID_RELEASED_AT: z.preprocess(
    value => value === '' || value === undefined ? undefined : value,
    z.string().datetime().optional(),
  ),
  ANDROID_RELEASE_NOTES: z.string().max(1000).optional(),
});

// Validate and parse environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    throw error;
  }
};

export const env = parseEnv();

// Type-safe environment configuration
export const config = {
  database: {
    url: env.DATABASE_URL,
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    queueDb: env.REDIS_QUEUE_DB,
    url: env.REDIS_URL,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  server: {
    port: env.PORT,
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
    apiVersion: env.API_VERSION,
    webUrl: env.APP_WEB_URL,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    uploadPath: env.UPLOAD_PATH,
  },
  
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    s3Bucket: env.AWS_S3_BUCKET,
    s3Endpoint: env.AWS_S3_ENDPOINT || undefined,
    s3ForcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
    s3KmsKeyId: env.AWS_S3_KMS_KEY_ID,
    documentHashSecret: env.DOCUMENT_HASH_SECRET,
  },
  
  mpesa: {
    consumerKey: env.MPESA_CONSUMER_KEY,
    consumerSecret: env.MPESA_CONSUMER_SECRET,
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY,
    callbackUrl: env.MPESA_CALLBACK_URL,
    subscriptionCallbackUrl: env.MPESA_SUBSCRIPTION_CALLBACK_URL,
    environment: env.MPESA_ENVIRONMENT,
  },
  
  sms: {
    apiKey: env.SMS_API_KEY,
    senderId: env.SMS_SENDER_ID,
    baseUrl: env.SMS_BASE_URL,
  },
  
  email: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM,
  },
  billing: { businessName: env.BILLING_BUSINESS_NAME, businessAddress: env.BILLING_BUSINESS_ADDRESS, taxPin: env.BILLING_TAX_PIN, vatRate: env.BILLING_VAT_RATE },
  
  kyc: {
    apiKey: env.KYC_API_KEY,
    baseUrl: env.KYC_BASE_URL,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionSecret: env.SESSION_SECRET,
    mfaEncryptionKey: env.MFA_ENCRYPTION_KEY,
    identityHashSecret: env.IDENTITY_HASH_SECRET,
    accountDeletionGraceDays: env.ACCOUNT_DELETION_GRACE_DAYS,
  },
  
  queue: {
    redisUrl: env.BULL_REDIS_URL || env.REDIS_URL || `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
  },
  
  monitoring: {
    healthCheckInterval: env.HEALTH_CHECK_INTERVAL,
    metricsEnabled: env.METRICS_ENABLED,
  },

  systemAdminEmails: env.SYSTEM_ADMIN_EMAILS.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),

  mobileRelease: {
    androidLatestVersion: env.ANDROID_LATEST_VERSION,
    androidMinSupportedVersion: env.ANDROID_MIN_SUPPORTED_VERSION,
    androidUpdateUrl: env.ANDROID_UPDATE_URL || undefined,
    androidForceUpdate: env.ANDROID_FORCE_UPDATE,
    androidApkSha256: env.ANDROID_APK_SHA256 || undefined,
    androidApkSizeBytes: env.ANDROID_APK_SIZE_BYTES,
    androidReleasedAt: env.ANDROID_RELEASED_AT,
    androidReleaseNotes: env.ANDROID_RELEASE_NOTES,
  },
} as const;

export default config;
