import api from '../config/api';
import type { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  acceptTerms: true;
}

export interface AuthTokensResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user?: Partial<User>;
}

export interface MfaRequiredResponse {
  message: string;
  requiresMfa: true;
  tempToken: string;
}

export interface VerificationRequiredResponse {
  message: string;
  verificationRequired: true;
  verificationDelivery: 'PENDING' | 'SENT' | 'PROVIDER_NOT_CONFIGURED';
  email: string;
  verificationCode?: string;
}

export interface RegisterResponse {
  message: string;
  user: Partial<User>;
  verificationRequired?: boolean;
  emailVerificationCode?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export interface MfaSetupResponse {
  message: string;
  secret?: string;
  qrCode?: string;
  requiresReauthentication?: boolean;
  recoveryCodes?: string[];
}

export type LoginResponse = AuthTokensResponse | MfaRequiredResponse | VerificationRequiredResponse;

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  logoutAll: async () => {
    const response = await api.post('/auth/logout-all');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokensResponse> => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  verifyMfa: async (tempToken: string, mfaCode: string): Promise<AuthTokensResponse> => {
    const response = await api.post('/auth/mfa/verify', { tempToken, mfaCode });
    return response.data;
  },

  configureMfa: async (enable: boolean, mfaCode?: string): Promise<MfaSetupResponse> => {
    const response = await api.post('/auth/mfa/setup', { enable, mfaCode });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/auth/sessions');
    return response.data;
  },

  revokeSession: async (sessionId: string) => {
    const response = await api.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
    return response.data;
  },

  verifyEmail: async (email: string, verificationCode: string) => {
    const response = await api.post('/user/verify-email', { email, verificationCode });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/user/resend-verification', { type: 'email', email });
    return response.data;
  },
};
