import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { getApiBaseUrl } from './apiBase';

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = typeof originalRequest?.url === 'string' ? originalRequest.url : '';
    const isAuthenticationRequest = ['/auth/login', '/auth/register', '/auth/refresh'].some((path) => requestUrl.endsWith(path));

    if (error.response?.status === 402 && error.response?.data?.error?.code === 'UPGRADE_REQUIRED') {
      window.dispatchEvent(new CustomEvent('chama360:upgrade-required', { detail: error.response.data.error.details }));
    }

    if (error.response?.status === 401 && !isAuthenticationRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) return Promise.reject(error);

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: nextRefreshToken } = response.data;
        useAuthStore.getState().setTokens(accessToken, nextRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        window.location.hash = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
