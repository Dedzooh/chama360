import { MemberRole, KycStatus } from '@prisma/client';

// Core authentication interfaces
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface UserSession {
  userId: string;
  email: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  mfaVerified: boolean;
}

// User authentication context
export interface AuthUser {
  id: string;
  email: string;
  sessionId: string;
  kycStatus: KycStatus;
  isActive: boolean;
}

// Chama context for authenticated users
export interface ChamaContext {
  id: string;
  role: MemberRole;
  status: string;
}

// Multi-factor authentication interfaces
export interface MfaVerification {
  userId: string;
  tempToken: string;
  expiresAt: Date;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// Authentication request/response types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  message: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  requiresMfa?: boolean;
  tempToken?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    kycStatus: KycStatus;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  acceptTerms: boolean;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    kycStatus: KycStatus;
    createdAt: Date;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface MfaVerifyRequest {
  tempToken: string;
  mfaCode: string;
}

export interface MfaSetupRequest {
  enable: boolean;
  mfaCode?: string;
}

// Security and audit types
export interface SecurityEvent {
  userId?: string;
  event: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export interface AccountLockout {
  identifier: string;
  attempts: number;
  lockedUntil?: Date;
  reason: string;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number; // Number of previous passwords to check
  maxAge: number; // Days before password expires
}

// Session management types
export interface ActiveSession {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  isCurrent: boolean;
}

export interface SessionRevocationRequest {
  sessionId?: string;
  revokeAll?: boolean;
}

// Role and permission types
export interface UserPermissions {
  chamaId: string;
  role: MemberRole;
  permissions: Permission[];
}

export enum Permission {
  // Member permissions
  VIEW_CHAMA_INFO = 'VIEW_CHAMA_INFO',
  VIEW_OWN_CONTRIBUTIONS = 'VIEW_OWN_CONTRIBUTIONS',
  MAKE_CONTRIBUTIONS = 'MAKE_CONTRIBUTIONS',
  REQUEST_LOANS = 'REQUEST_LOANS',
  VIEW_OWN_LOANS = 'VIEW_OWN_LOANS',
  ATTEND_MEETINGS = 'ATTEND_MEETINGS',
  CAST_VOTES = 'CAST_VOTES',
  RAISE_DISPUTES = 'RAISE_DISPUTES',
  
  // Administrative permissions
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  APPROVE_MEMBERS = 'APPROVE_MEMBERS',
  SUSPEND_MEMBERS = 'SUSPEND_MEMBERS',
  VIEW_ALL_CONTRIBUTIONS = 'VIEW_ALL_CONTRIBUTIONS',
  MANAGE_CONTRIBUTIONS = 'MANAGE_CONTRIBUTIONS',
  
  // Financial permissions
  APPROVE_LOANS = 'APPROVE_LOANS',
  DISBURSE_LOANS = 'DISBURSE_LOANS',
  MANAGE_PAYOUTS = 'MANAGE_PAYOUTS',
  VIEW_FINANCIAL_REPORTS = 'VIEW_FINANCIAL_REPORTS',
  PROCESS_PAYMENTS = 'PROCESS_PAYMENTS',
  
  // Governance permissions
  CREATE_VOTES = 'CREATE_VOTES',
  MANAGE_VOTES = 'MANAGE_VOTES',
  SCHEDULE_MEETINGS = 'SCHEDULE_MEETINGS',
  MANAGE_MEETINGS = 'MANAGE_MEETINGS',
  RESOLVE_DISPUTES = 'RESOLVE_DISPUTES',
  
  // System permissions
  MANAGE_CHAMA_SETTINGS = 'MANAGE_CHAMA_SETTINGS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  EXPORT_DATA = 'EXPORT_DATA',
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Token blacklist types
export interface BlacklistedToken {
  token: string;
  userId: string;
  reason: string;
  blacklistedAt: Date;
  expiresAt: Date;
}

// Authentication middleware options
export interface AuthMiddlewareOptions {
  required?: boolean;
  requireKyc?: boolean;
  requireMfa?: boolean;
  allowedRoles?: MemberRole[];
  requireChamaContext?: boolean;
  rateLimitConfig?: RateLimitConfig;
}

// Password strength assessment
export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  estimatedCrackTime: string;
  hasCommonPatterns: boolean;
}

// Account recovery types
export interface RecoveryMethod {
  type: 'email' | 'sms' | 'security_questions' | 'backup_codes';
  identifier: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface RecoveryAttempt {
  userId: string;
  method: string;
  token: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  isUsed: boolean;
}

// Device and location tracking
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  isKnownDevice: boolean;
  lastSeen: Date;
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  timezone: string;
  isKnownLocation: boolean;
}

// Authentication audit trail
export interface AuthAuditEntry {
  id: string;
  userId: string;
  action: string;
  result: 'success' | 'failure' | 'blocked';
  ipAddress: string;
  userAgent: string;
  deviceInfo?: DeviceInfo;
  locationInfo?: LocationInfo;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Error types for authentication
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class MfaRequiredError extends Error {
  constructor(
    public tempToken: string,
    message: string = 'Multi-factor authentication required'
  ) {
    super(message);
    this.name = 'MfaRequiredError';
  }
}

export class AccountLockedError extends Error {
  constructor(
    public lockedUntil: Date,
    message: string = 'Account is temporarily locked'
  ) {
    super(message);
    this.name = 'AccountLockedError';
  }
}

// Utility types
export type AuthenticatedRequest = Request & {
  user: AuthUser;
  currentChama?: ChamaContext;
  permissions?: Permission[];
  rateLimit?: RateLimitInfo;
};

export type OptionalAuthRequest = Request & {
  user?: AuthUser;
  currentChama?: ChamaContext;
};

// Configuration types
export interface AuthConfig {
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };
  password: PasswordPolicy;
  mfa: {
    enabled: boolean;
    issuer: string;
    window: number;
  };
  session: {
    maxAge: number;
    maxConcurrent: number;
    extendOnActivity: boolean;
  };
  security: {
    maxFailedAttempts: number;
    lockoutDuration: number;
    bcryptRounds: number;
    requireHttps: boolean;
  };
  rateLimit: {
    login: RateLimitConfig;
    register: RateLimitConfig;
    passwordReset: RateLimitConfig;
    general: RateLimitConfig;
  };
}
