import { create } from 'zustand';
import type { User } from '../types/index';
import { secureSessionStorage } from '../services/secureSessionStorage';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken?: string | null) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

const persistTokens = (accessToken: string, refreshToken: string) => {
  void secureSessionStorage.setTokens(accessToken, refreshToken).catch(() => {
    // Keep the session in memory for this run. Restoration will safely fail closed.
  });
};

export const useAuthStore = create<AuthState>()(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        persistTokens(accessToken, refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      setTokens: (accessToken, refreshToken) => {
        set((state) => ({
          accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
          isAuthenticated: true,
        }));
        const storedRefreshToken = refreshToken ?? useAuthStore.getState().refreshToken;
        if (storedRefreshToken) persistTokens(accessToken, storedRefreshToken);
      },
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      clearAuth: () => {
        void secureSessionStorage.clear().catch(() => {
          // In-memory credentials are still cleared even if device storage is unavailable.
        });
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    })
);
