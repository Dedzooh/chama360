import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SessionTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface SecureSessionStoragePlugin {
  setTokens(options: { accessToken: string; refreshToken: string }): Promise<void>;
  getTokens(): Promise<SessionTokens>;
  clear(): Promise<void>;
}

const nativeStorage = registerPlugin<SecureSessionStoragePlugin>('SecureSessionStorage');
const ACCESS_TOKEN = 'chama360.accessToken';
const REFRESH_TOKEN = 'chama360.refreshToken';

const removeLegacyStorage = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('auth-storage');
};

export const secureSessionStorage = {
  setTokens: async (accessToken: string, refreshToken: string) => {
    removeLegacyStorage();
    if (Capacitor.isNativePlatform()) {
      await nativeStorage.setTokens({ accessToken, refreshToken });
      return;
    }
    sessionStorage.setItem(ACCESS_TOKEN, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN, refreshToken);
  },

  getTokens: async (): Promise<SessionTokens> => {
    removeLegacyStorage();
    if (Capacitor.isNativePlatform()) return nativeStorage.getTokens();
    return {
      accessToken: sessionStorage.getItem(ACCESS_TOKEN),
      refreshToken: sessionStorage.getItem(REFRESH_TOKEN),
    };
  },

  clear: async () => {
    removeLegacyStorage();
    if (Capacitor.isNativePlatform()) {
      await nativeStorage.clear();
      return;
    }
    sessionStorage.removeItem(ACCESS_TOKEN);
    sessionStorage.removeItem(REFRESH_TOKEN);
  },
};
