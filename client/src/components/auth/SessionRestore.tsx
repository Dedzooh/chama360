import { useEffect, useState, type ReactNode } from 'react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { Card, Skeleton } from '../../design-system';
import { BrandMark } from '../BrandLogo';
import { secureSessionStorage } from '../../services/secureSessionStorage';

interface SessionRestoreProps {
  children: ReactNode;
}

export const SessionRestore = ({ children }: SessionRestoreProps) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated && auth.user) {
        if (active) setReady(true);
        return;
      }

      try {
        const { accessToken, refreshToken } = await secureSessionStorage.getTokens();
        if (!accessToken || !refreshToken) {
          if (active) setReady(true);
          return;
        }

        useAuthStore.getState().setTokens(accessToken, refreshToken);
        const response = await authService.getCurrentUser();
        if (active) useAuthStore.getState().setUser(response.user);
      } catch {
        if (active) useAuthStore.getState().clearAuth();
      } finally {
        if (active) setReady(true);
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="auth-page flex min-h-screen items-center justify-center px-4">
        <Card className="flex items-center gap-3 px-5 py-4">
          <BrandMark />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--ds-secondary)]">Restoring session</p>
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
