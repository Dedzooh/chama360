import { useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, Share2 } from 'lucide-react';
import { organizationService } from '../services/organizationService';
import { ROUTES } from '../config/routes';
import { getApiErrorMessage } from '../utils/apiError';
import { createPublicHashUrl } from '../config/publicWebUrl';

export const OrganizationInviteLink = ({ organizationId, organizationName }: { organizationId: string; organizationName: string }) => {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setToken('');
    organizationService.getInviteToken(organizationId)
      .then((value) => { if (active) setToken(value); })
      .catch((caught) => { if (active) setMessage(getApiErrorMessage(caught, 'Could not load the invitation link.')); });
    return () => { active = false; };
  }, [organizationId]);

  const url = token ? createPublicHashUrl(ROUTES.invitations.organization(token)) : '';
  const copy = async () => {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.getElementById('organization-invite-url') as HTMLInputElement | null;
        input?.select();
        if (!document.execCommand('copy')) throw new Error('Copy failed');
      }
      setMessage('Invite link copied. Anyone with the link can request to join.');
    } catch { setMessage('Select and copy the link shown below.'); }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      setToken(await organizationService.rotateInviteToken(organizationId));
      setMessage('New link created. The previous link no longer works.');
    } catch (caught) { setMessage(getApiErrorMessage(caught, 'Could not replace the link.')); }
    finally { setBusy(false); }
  };

  const share = async () => {
    if (!url) return;
    if (!navigator.share) {
      setMessage('Use Copy link or Share on WhatsApp to send this invitation.');
      return;
    }
    try {
      await navigator.share({
        title: `Join ${organizationName} on CHAMAZ360`,
        text: `You are invited to join ${organizationName} on CHAMAZ360. Open this link to get started:`,
        url,
      });
      setMessage('Invitation shared successfully.');
    } catch (caught) {
      if ((caught as DOMException).name !== 'AbortError') setMessage('Sharing was not completed. You can copy the link instead.');
    }
  };

  return <section className="section-shell mb-5 overflow-hidden">
    <div className="section-header"><p className="text-sm text-[var(--ds-text-muted)]">Free on every plan</p><h2 className="flex items-center gap-2 text-xl font-black text-[var(--ds-secondary)]"><Link2 className="h-5 w-5" /> Invite members by link</h2></div>
    <div className="section-body space-y-3">
      <p className="text-sm text-[var(--ds-text-muted)]">Share this link in WhatsApp, SMS, email, or any other channel. New members can sign up first and will return here to request access.</p>
      <input id="organization-invite-url" className="input w-full" aria-label="Invitation link" readOnly value={url} placeholder="Loading link…" onFocus={(event) => event.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="button" disabled={!url} onClick={() => void copy()}><Copy className="h-4 w-4" /> Copy link</button>
        {url && 'share' in navigator ? <button className="btn btn-outline" type="button" onClick={() => void share()}><Share2 className="h-4 w-4" /> Share</button> : null}
        {url ? <a className="btn btn-outline" href={`https://wa.me/?text=${encodeURIComponent(`Join ${organizationName} on CHAMAZ360: ${url}`)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a> : null}
        <button className="btn btn-outline" type="button" disabled={busy} onClick={() => void rotate()}><RefreshCw className="h-4 w-4" /> Replace link</button>
      </div>
      {message ? <p role="status" className="text-sm text-[var(--ds-text-muted)]">{message}</p> : null}
    </div>
  </section>;
};
