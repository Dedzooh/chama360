import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Download, FileUp, RefreshCw, Share2, Signal, Wifi, WifiOff } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { useAuthStore } from '../store/authStore';

type CapturedFile = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const readAsDataUrl = (file: File) =>
  new Promise<CapturedFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

export const MobileTools = () => {
  const { currentOrganization, refreshOrganizations } = useOrganizationWorkspace();
  const user = useAuthStore((state) => state.user);
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState('');
  const [captured, setCaptured] = useState<CapturedFile | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const shareText = useMemo(
    () =>
      [
        'CHAMA360 mobile share',
        currentOrganization ? `Workspace: ${currentOrganization.name}` : null,
        user ? `User: ${user.firstName} ${user.lastName}` : null,
        note.trim() ? `Note: ${note.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    [currentOrganization, note, user]
  );

  const shareCurrent = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'CHAMA360',
          text: shareText,
        });
        setMessage('Share sheet opened.');
      } else {
        await navigator.clipboard.writeText(shareText);
        setMessage('Share text copied to clipboard.');
      }
    } catch {
      setMessage('Share canceled.');
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    const file = target.files?.[0];
    if (!file) return;
    try {
      const next = await readAsDataUrl(file);
      setCaptured(next);
      setMessage(`${file.name} loaded for capture.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load file');
    }
  };

  const exportWorkspaceSummary = () => {
    const content = [
      'CHAMA360 workspace summary',
      `Organization: ${currentOrganization?.name ?? 'None'}`,
      `User: ${user ? `${user.firstName} ${user.lastName}` : 'Guest'}`,
      `Connectivity: ${online ? 'Online' : 'Offline'}`,
      `Captured file: ${captured?.name ?? 'None'}`,
      `Note: ${note.trim() || 'None'}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chama360-mobile-summary.txt';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Workspace summary downloaded.');
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-mobiletools">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Mobile</span>
            <strong>{online ? 'Online' : 'Offline'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization?.name ?? 'Android workspace'}</p>
            <h1>Android tools</h1>
            <small>Use camera-style uploads, native sharing, exports, and offline-aware tools from the packaged app.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#mobile-capture">
              <Camera className="h-4 w-4" />
              Capture
            </a>
            <a href="#mobile-share">
              <Share2 className="h-4 w-4" />
              Share
            </a>
            <button type="button" onClick={() => void refreshOrganizations()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green">{online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</span>
            <p>Connectivity</p>
            <strong>{online ? 'Online' : 'Offline'}</strong>
            <small>{online ? 'Live mode' : 'Cached mode'}</small>
          </article>
          <article>
            <span className="blue"><Signal className="h-5 w-5" /></span>
            <p>Workspace</p>
            <strong>{currentOrganization ? 'Linked' : 'None'}</strong>
            <small>Sync target</small>
          </article>
          <article>
            <span className="gold"><Camera className="h-5 w-5" /></span>
            <p>Capture</p>
            <strong>{captured ? 'Loaded' : 'Ready'}</strong>
            <small>Image or PDF</small>
          </article>
        </div>
      </section>

      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div id="mobile-capture" className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-slate-500">Capture</p>
            <h2 className="text-xl font-semibold">Receipt and file picker</h2>
          </div>
          <div className="section-body space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Pick an image or document</span>
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                onChange={(event) => void handleFile(event)}
                className="mt-1 w-full input"
              />
            </label>
            {captured ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-(--secondary)">{captured.name}</p>
                    <p className="text-sm text-slate-600">{captured.type || 'unknown type'} - {Math.round(captured.size / 1024)} KB</p>
                  </div>
                  <a href={captured.dataUrl} download={captured.name} className="btn btn-outline">
                    <Download className="h-4 w-4" />
                    Save
                  </a>
                </div>
                {captured.type.startsWith('image/') ? (
                  <img src={captured.dataUrl} alt={captured.name} className="mt-4 max-h-64 w-full rounded-xl object-contain" />
                ) : null}
              </div>
            ) : (
              <div className="empty-state p-6 text-center text-(--muted)">
                No file captured yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section id="mobile-share" className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-slate-500">Share</p>
              <h2 className="text-xl font-semibold">Native share sheet</h2>
            </div>
            <div className="section-body space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Note</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void shareCurrent()} className="btn btn-primary">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button type="button" onClick={exportWorkspaceSummary} className="btn btn-outline">
                  <FileUp className="h-4 w-4" />
                  Export summary
                </button>
                <button type="button" onClick={() => void refreshOrganizations()} className="btn btn-outline">
                  <RefreshCw className="h-4 w-4" />
                  Sync data
                </button>
              </div>
            </div>
          </section>

          <section className="section-shell overflow-hidden">
            <div className="section-header">
              <p className="text-sm text-slate-500">Deep links</p>
              <h2 className="text-xl font-semibold">Android entry points</h2>
            </div>
            <div className="section-body space-y-3 text-sm text-slate-600">
              <p className="leading-6">Use the packaged app icon to open the workspace, then jump into chamas, payments, or shared files from the normal navigation.</p>
              <p className="leading-6">The app is configured for offline caching and cleartext development transport so the emulator can reach the local API.</p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
