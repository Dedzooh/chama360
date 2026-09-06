import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, Clock3, Download, RefreshCw } from 'lucide-react';
import { Button, Dialog } from '../design-system';
import { getHealthUrl, isUpdateAvailable, normalizeReleaseInfo, shouldForceUpdate, type AppUpdateState } from '../config/appUpdate';

interface AppUpdateGateProps {
  children: ReactNode;
}

const snoozeKey = (version?: string) => `chama360:update:snoozed:${version ?? 'unknown'}`;
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export const AppUpdateGate = ({ children }: AppUpdateGateProps) => {
  const [state, setState] = useState<AppUpdateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const response = await fetch(getHealthUrl(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Health check failed (${response.status})`);
        const payload = (await response.json()) as { release?: unknown };
        const nextState = normalizeReleaseInfo((payload.release as Parameters<typeof normalizeReleaseInfo>[0]) ?? null);
        if (active) {
          setError(null);
          setState(nextState);
          setSnoozed(Boolean(nextState.latestVersion && localStorage.getItem(snoozeKey(nextState.latestVersion))));
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Unable to check for updates');
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), UPDATE_CHECK_INTERVAL_MS);
    const checkOnFocus = () => void load();
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', checkOnFocus);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkOnFocus);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, []);

  const forceUpdate = useMemo(() => (state ? shouldForceUpdate(state) : false), [state]);
  const updateAvailable = useMemo(() => (state ? isUpdateAvailable(state) : false), [state]);

  const openUpdate = () => {
    if (!state?.updateUrl) return;
    window.location.assign(state.updateUrl);
  };

  const snoozeUpdate = () => {
    if (state?.latestVersion) {
      localStorage.setItem(snoozeKey(state.latestVersion), '1');
      setSnoozed(true);
    }
  };

  const shouldShowPrompt = Boolean(state?.updateUrl && updateAvailable && !snoozed);
  const title = forceUpdate ? 'Update required' : 'Update available';
  const description = forceUpdate
    ? `Version ${state?.latestVersion ?? 'newer'} is required to continue.`
    : `Version ${state?.latestVersion ?? 'newer'} is available.`;

  return (
    <>
      {children}

      {error ? (
        <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,420px)] -translate-x-1/2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-[var(--ds-shadow-card)]">
            {error}
          </div>
        </div>
      ) : null}

      <Dialog open={forceUpdate || shouldShowPrompt} title={title} description={description} onClose={forceUpdate ? () => undefined : snoozeUpdate}>
        <div className="space-y-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm ${forceUpdate ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            <div className="flex items-center gap-2 font-semibold">
              {forceUpdate ? <AlertTriangle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              <span>Installed version: {state?.currentVersion}</span>
            </div>
            {state?.latestVersion ? <p className="mt-2">Latest version: {state.latestVersion}</p> : null}
            {state?.releasedAt ? <p className="mt-1">Released: {new Date(state.releasedAt).toLocaleDateString()}</p> : null}
            {state?.apkSizeBytes ? <p className="mt-1">Download size: {(state.apkSizeBytes / 1024 / 1024).toFixed(1)} MB</p> : null}
          </div>
          {state?.releaseNotes ? <p className="text-sm text-[var(--ds-text-muted)]">{state.releaseNotes}</p> : null}
          {state?.apkSha256 ? (
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--ds-secondary)]">APK SHA-256</p>
              <code className="mt-1 block break-all text-xs text-[var(--ds-text-muted)]">{state.apkSha256}</code>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="w-full" startIcon={<Download className="h-4 w-4" />} onClick={openUpdate} disabled={!state?.updateUrl}>
              Update now
            </Button>
            {!forceUpdate ? (
              <Button variant="outline" className="w-full" startIcon={<Clock3 className="h-4 w-4" />} onClick={snoozeUpdate}>
                Later
              </Button>
            ) : null}
          </div>
          {state?.updateUrl ? <p className="text-xs text-[var(--ds-text-muted)]">The APK link is hosted by your backend. Older installs will be sent here when a new build is published.</p> : null}
        </div>
      </Dialog>
    </>
  );
};
