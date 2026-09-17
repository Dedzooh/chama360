import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

type Level = 'PASS' | 'WARN' | 'FAIL';
type Result = { area: string; level: Level; message: string };
const strict = process.argv.includes('--production');
const root = process.cwd();
const environmentFile = strict ? path.join(root, '.env.production') : path.join(root, '.env');
dotenv.config({ path: environmentFile });
const env = process.env;
const results: Result[] = [];
const add = (area: string, level: Level, message: string) => results.push({ area, level, message });
const present = (...names: string[]) => names.every((name) => Boolean(env[name]?.trim()));
const https = (value?: string) => Boolean(value && /^https:\/\//i.test(value));
const placeholder = (value?: string) => !value || /example|localhost|username|password|change-this|your-|test_/i.test(value);
const requireCheck = (area: string, condition: boolean, pass: string, fail: string) => add(area, condition ? 'PASS' : 'FAIL', condition ? pass : fail);

if (strict) requireCheck('Production environment', fs.existsSync(environmentFile), '.env.production is available to the release check.', 'Create .env.production from .env.example and store real values outside source control.');

requireCheck('Runtime', env.NODE_ENV === 'production', 'NODE_ENV is production.', 'Set NODE_ENV=production.');
requireCheck('Public URL', https(env.APP_WEB_URL), 'Public web URL uses HTTPS.', 'APP_WEB_URL must be the deployed HTTPS address.');
requireCheck('CORS', Boolean(env.CORS_ORIGIN?.split(',').some(https)), 'CORS includes an HTTPS origin.', 'CORS_ORIGIN must include the deployed HTTPS client origin.');
requireCheck('Database', Boolean(env.DATABASE_URL && !placeholder(env.DATABASE_URL) && !/localhost|127\.0\.0\.1/i.test(env.DATABASE_URL)), 'Production database is configured.', 'Replace the local/example DATABASE_URL with the managed production database.');
requireCheck('Redis', Boolean((env.REDIS_URL && !/localhost|127\.0\.0\.1/i.test(env.REDIS_URL)) || (env.REDIS_HOST && !/localhost|127\.0\.0\.1/i.test(env.REDIS_HOST))), 'Production Redis is configured.', 'Configure a managed production Redis service.');

const secrets = [env.JWT_SECRET, env.JWT_REFRESH_SECRET, env.SESSION_SECRET];
requireCheck('Secrets', secrets.every((value) => Boolean(value && value.length >= 48 && !placeholder(value))) && new Set(secrets).size === 3, 'Independent high-entropy application secrets are configured.', 'JWT_SECRET, JWT_REFRESH_SECRET and SESSION_SECRET must be unique, non-placeholder values of at least 48 characters.');
requireCheck('MFA encryption', Boolean(env.MFA_ENCRYPTION_KEY && /^[a-fA-F0-9]{64}$/.test(env.MFA_ENCRYPTION_KEY) && !secrets.includes(env.MFA_ENCRYPTION_KEY)), 'A dedicated MFA encryption key is configured.', 'Set MFA_ENCRYPTION_KEY to a unique 64-character hexadecimal value and retain it in the production secret manager.');
requireCheck('Identity protection', Boolean(env.IDENTITY_HASH_SECRET && env.IDENTITY_HASH_SECRET.length >= 32 && !placeholder(env.IDENTITY_HASH_SECRET) && ![...secrets, env.DOCUMENT_HASH_SECRET, env.MFA_ENCRYPTION_KEY].includes(env.IDENTITY_HASH_SECRET)), 'A dedicated identity fingerprint secret is configured.', 'Set IDENTITY_HASH_SECRET to a unique high-entropy value of at least 32 characters.');
requireCheck('M-Pesa', env.MPESA_ENVIRONMENT === 'production' && present('MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY') && https(env.MPESA_CALLBACK_URL) && https(env.MPESA_SUBSCRIPTION_CALLBACK_URL), 'Production M-Pesa credentials and HTTPS callbacks are configured.', 'Configure production M-Pesa credentials and both HTTPS callback URLs.');
requireCheck('Email', present('EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'), 'Transactional email is configured.', 'Configure EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM.');
add('SMS', present('SMS_API_KEY', 'SMS_SENDER_ID', 'SMS_BASE_URL') ? 'PASS' : 'WARN', present('SMS_API_KEY', 'SMS_SENDER_ID', 'SMS_BASE_URL') ? 'Transactional SMS is configured.' : 'SMS is optional at launch, but phone notifications will remain unavailable.');
requireCheck('Documents', present('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET') && Boolean(env.DOCUMENT_HASH_SECRET && env.DOCUMENT_HASH_SECRET.length >= 32 && !placeholder(env.DOCUMENT_HASH_SECRET)), 'Encrypted document storage and document-number hashing are configured.', 'Configure private S3 storage and a unique DOCUMENT_HASH_SECRET of at least 32 characters before accepting KYC documents.');
requireCheck('Administrators', Boolean(env.SYSTEM_ADMIN_EMAILS && !placeholder(env.SYSTEM_ADMIN_EMAILS)), 'Platform administrator allowlist is configured.', 'Replace the example SYSTEM_ADMIN_EMAILS allowlist.');
requireCheck('Business identity', present('BILLING_BUSINESS_NAME', 'BILLING_BUSINESS_ADDRESS', 'BILLING_TAX_PIN') && env.BILLING_BUSINESS_NAME !== 'CHAMA360' && env.BILLING_BUSINESS_ADDRESS !== 'Nairobi, Kenya', 'Registered billing identity is configured.', 'Add the registered business name, complete address and tax PIN.');
requireCheck('Support', Boolean(env.SUPPORT_EMAIL && !placeholder(env.SUPPORT_EMAIL)), 'Production support address is configured.', 'Set SUPPORT_EMAIL to the monitored customer-support mailbox.');

const clientProductionEnv = path.join(root, 'client', '.env.production');
const clientEnvText = fs.existsSync(clientProductionEnv) ? fs.readFileSync(clientProductionEnv, 'utf8') : '';
requireCheck('Client API', /VITE_API_URL\s*=\s*["']?https:\/\//i.test(clientEnvText) && /VITE_ANDROID_API_URL\s*=\s*["']?https:\/\//i.test(clientEnvText), 'Web and Android production API URLs are configured.', 'Create client/.env.production with HTTPS VITE_API_URL and VITE_ANDROID_API_URL.');
requireCheck('Client support', /VITE_SUPPORT_EMAIL\s*=\s*["']?[^\s"']+@/i.test(clientEnvText), 'Client support address is configured.', 'Add VITE_SUPPORT_EMAIL to client/.env.production.');

const keystorePropertiesPath = path.join(root, 'client', 'android', 'keystore.properties');
let signingReady = false;
if (fs.existsSync(keystorePropertiesPath)) {
  const properties = Object.fromEntries(fs.readFileSync(keystorePropertiesPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }));
  const storeFile = properties.storeFile ? path.resolve(path.dirname(keystorePropertiesPath), properties.storeFile) : '';
  signingReady = Boolean(storeFile && fs.existsSync(storeFile) && properties.storePassword && properties.keyAlias && properties.keyPassword);
}
requireCheck('Android signing', signingReady, 'Android release signing key is configured.', 'Create client/android/keystore.properties and provide the protected production keystore.');
requireCheck('Android updates', present('ANDROID_LATEST_VERSION', 'ANDROID_MIN_SUPPORTED_VERSION') && https(env.ANDROID_UPDATE_URL), 'Android release metadata and HTTPS update URL are configured.', 'Set Android version metadata and an HTTPS update/download URL.');
requireCheck('Android checksum', Boolean(env.ANDROID_APK_SHA256 && /^[a-fA-F0-9]{64}$/.test(env.ANDROID_APK_SHA256)), 'Android APK SHA-256 is configured.', 'Set ANDROID_APK_SHA256 to the 64-character SHA-256 digest of the signed APK.');
add('Deletion retention', /^\d+$/.test(env.ACCOUNT_DELETION_GRACE_DAYS || '') ? 'PASS' : 'WARN', /^\d+$/.test(env.ACCOUNT_DELETION_GRACE_DAYS || '') ? 'Account anonymization schedule is configured.' : 'Automated anonymization is paused until ACCOUNT_DELETION_GRACE_DAYS is approved and configured.');

console.table(results);
const failures = results.filter((result) => result.level === 'FAIL');
const warnings = results.filter((result) => result.level === 'WARN');
console.log(`\nRelease preflight: ${results.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} blocking failure(s).`);
if (failures.length) console.log(strict ? 'Production release is BLOCKED.' : 'Local audit complete. Run with --production to enforce blocking failures.');
if (strict && failures.length) process.exitCode = 1;
