import { useEffect, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHealthUrl, normalizeReleaseInfo, type AppUpdateState } from '../config/appUpdate';
import { ROUTES } from '../config/routes';
import { Card } from '../design-system';
import { PublicPageFrame } from '../components/PublicPageFrame';

export const DownloadApp = () => {
  const [release, setRelease] = useState<AppUpdateState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(getHealthUrl(), { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Release service unavailable (${response.status})`);
        const payload = (await response.json()) as { release?: Parameters<typeof normalizeReleaseInfo>[0] };
        if (active) setRelease(normalizeReleaseInfo(payload.release));
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Release information is unavailable.');
      });
    return () => { active = false; };
  }, []);

  return (
    <PublicPageFrame
      width="narrow"
      eyebrow="Official release"
      title="Download CHAMA360 for Android"
      description="Install CHAMA360 only from this official page. Android will ask you to approve installation from your browser."
    >
        {error ? <Card className="mt-5 border-rose-200 bg-rose-50 p-5 text-rose-800">{error}</Card> : null}

        <Card className="mt-5 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">CHAMA360 for Android</h2>
              <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Version {release?.latestVersion ?? '—'}{release?.releasedAt ? ` · Released ${new Date(release.releasedAt).toLocaleDateString()}` : ''}</p>
              {release?.releaseNotes ? <p className="mt-3 text-sm text-[var(--ds-text-muted)]">{release.releaseNotes}</p> : null}
            </div>
          </div>

          {release?.apkSha256 ? (
            <div className="mt-5 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--ds-secondary)]">SHA-256 checksum</p>
              <code className="mt-2 block break-all text-xs text-[var(--ds-text-muted)]">{release.apkSha256}</code>
            </div>
          ) : null}

          <a href={release?.updateUrl} aria-disabled={!release?.updateUrl} className={`btn mt-5 flex w-full items-center justify-center gap-2 ${!release?.updateUrl ? 'pointer-events-none opacity-50' : ''}`}>
            <Download className="h-4 w-4" />
            {release?.apkSizeBytes ? `Download APK (${(release.apkSizeBytes / 1024 / 1024).toFixed(1)} MB)` : 'Download APK'}
          </a>

          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[var(--ds-text-muted)]">
            <li>Download the APK from this page.</li>
            <li>When Android asks, allow your browser to install this app.</li>
            <li>Confirm the app name is CHAMA360 before installing.</li>
            <li>Turn off the browser's install permission again after installation.</li>
          </ol>
        </Card>

        <p className="mt-5 text-center text-sm"><Link className="font-bold text-[var(--ds-primary)]" to={ROUTES.legal.centre}>Privacy, terms and support</Link></p>
    </PublicPageFrame>
  );
};
