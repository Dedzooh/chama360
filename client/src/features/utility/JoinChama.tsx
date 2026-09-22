import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Link2, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { chamaService } from '../../services/chamaService';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';

export const JoinChama = () => {
  const navigate = useNavigate();
  const { refreshOrganizations } = useOrganizationWorkspace();
  const [inviteCode, setInviteCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [publicChamas, setPublicChamas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPublicChamas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await chamaService.discoverChamas();
      setPublicChamas(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load public Chamas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicChamas();
  }, [loadPublicChamas]);

  const filteredChamas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return publicChamas.filter((chama) => {
      if (!term) return true;
      return (
        chama.name?.toLowerCase().includes(term) ||
        chama.description?.toLowerCase().includes(term) ||
        chama.organizationType?.toLowerCase().includes(term) ||
        chama.slug?.toLowerCase().includes(term)
      );
    });
  }, [publicChamas, searchTerm]);

  const joinByInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const code = inviteCode.trim();
    if (!code) {
      setError('Enter an invite code or invitation link.');
      return;
    }

    setJoiningId('invite');
    try {
      const invite = code.startsWith('http') ? await chamaService.getChamaByInviteLink(code) : null;
      const targetId = invite?.id ?? code;
      await chamaService.joinChama(targetId, code);
      await refreshOrganizations();
      setMessage('Join request submitted successfully.');
      navigate(ROUTES.app.myChamas, { replace: true });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join this Chama.');
    } finally {
      setJoiningId(null);
    }
  };

  const joinPublic = async (chamaId: string) => {
    setJoiningId(chamaId);
    setError('');
    setMessage('');
    try {
      await chamaService.joinChama(chamaId);
      await refreshOrganizations();
      setMessage('Join request submitted successfully.');
      navigate(ROUTES.app.myChamas, { replace: true });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to send join request.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-join">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Membership</span>
            <strong>{loading ? 'Loading' : `${publicChamas.length} public`}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>CHAMAZ360 access</p>
            <h1>Join Chama</h1>
            <small>Use an invite code or browse public Chamas to request membership.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#invite-join">
              <Link2 className="h-4 w-4" />
              Invite code
            </a>
            <a href="#public-chamas">
              <Search className="h-4 w-4" />
              Browse
            </a>
            <button type="button" onClick={() => void loadPublicChamas()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Users className="h-5 w-5" /></span>
            <p>Public</p>
            <strong>{loading ? '...' : publicChamas.length}</strong>
            <small>Available Chamas</small>
          </article>
          <article>
            <span className="blue"><Search className="h-5 w-5" /></span>
            <p>Matches</p>
            <strong>{loading ? '...' : filteredChamas.length}</strong>
            <small>Current filter</small>
          </article>
          <article>
            <span className="gold"><Link2 className="h-5 w-5" /></span>
            <p>Invite</p>
            <strong>{inviteCode.trim() ? 'Ready' : 'Paste'}</strong>
            <small>Code or link</small>
          </article>
        </div>
      </section>

      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}
      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}

      <section id="invite-join" className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-slate-500">Invite link</p>
          <h2 className="mt-1 text-xl font-semibold">Join with a code or link</h2>
        </div>
        <div className="section-body">
          <form onSubmit={joinByInvite} className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Invite code or link</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="mt-1 w-full input"
                placeholder="Paste invite link or code"
              />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={joiningId === 'invite'} className="btn btn-primary w-full justify-center disabled:opacity-60">
                {joiningId === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Join
              </button>
            </div>
          </form>
        </div>
      </section>

      <section id="public-chamas" className="section-shell overflow-hidden">
        <div className="section-header space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Public Chamas</p>
              <h2 className="text-xl font-semibold">Browse and request access</h2>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-(--border) bg-white px-4 py-3 lg:w-[26rem]">
              <Search className="h-4 w-4 text-(--muted)" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search public Chamas"
              />
            </label>
          </div>
        </div>

        <div className="section-body">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : filteredChamas.length === 0 ? (
            <div className="empty-state p-8 text-center text-(--muted)">
              <Users className="mx-auto h-10 w-10" />
              <p className="mt-3">No public Chamas matched your search.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredChamas.map((chama) => (
                <div key={chama.id} className="dashboard-tile p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">Public Chama</p>
                  <h3 className="mt-2 text-xl font-bold text-(--secondary)">{chama.name}</h3>
                  <p className="mt-3 line-clamp-3 text-sm text-(--muted)">{chama.description || 'No description provided.'}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-(--muted)">
                    <span>{chama.organizationType ?? 'CHAMA'}</span>
                    <span>{chama.currency ?? 'KES'} {Number(chama.contributionAmount ?? 0).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void joinPublic(chama.id)}
                    disabled={joiningId === chama.id}
                    className="btn btn-primary mt-4 w-full justify-center disabled:opacity-60"
                  >
                    {joiningId === chama.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Request to join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

