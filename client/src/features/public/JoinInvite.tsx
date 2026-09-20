import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { chamaService } from '../../services/chamaService';
import { Users, CheckCircle2, XCircle, LogIn, UserPlus } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { BrandLockup } from '../../components/BrandLogo';
import { Button, Card } from '../../design-system';

const INVITE_STORAGE_KEY = 'pending_invite_link';

export const JoinInvite = () => {
  const { shareableLink } = useParams<{ shareableLink: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteChama, setInviteChama] = useState<any>(null);

  useEffect(() => {
    if (!shareableLink) {
      setError('Invalid invitation link.');
      setLoading(false);
      return;
    }

    localStorage.setItem(INVITE_STORAGE_KEY, shareableLink);
    sessionStorage.setItem(INVITE_STORAGE_KEY, ROUTES.invitations.join(shareableLink));

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    void loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareableLink, isAuthenticated]);

  const loadInvite = async () => {
    if (!shareableLink) return;
    try {
      setLoading(true);
      const chama = await chamaService.getChamaByInviteLink(shareableLink);
      setInviteChama(chama);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'This invitation link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!shareableLink || !inviteChama?.id) return;
    try {
      setJoining(true);
      setError('');
      await chamaService.joinChama(inviteChama.id, shareableLink);
      localStorage.removeItem(INVITE_STORAGE_KEY);
      sessionStorage.removeItem(INVITE_STORAGE_KEY);
      setSuccess('Join request submitted successfully.');
      setTimeout(() => navigate(ROUTES.app.myChamas), 1200);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Unable to join this chama.');
    } finally {
      setJoining(false);
    }
  };

  const invitePath = ROUTES.invitations.join(shareableLink || '');

  return (
    <main className="invite-page">
      <Card className="invite-card">
        <Link to={ROUTES.auth.splash} className="invite-brand" aria-label="CHAMA360 home"><BrandLockup /></Link>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-3">
            <Users className="w-8 h-8 text-[var(--ds-primary)]" />
          </div>
          <h1 className="text-3xl font-bold">Chama Invitation</h1>
          <p className="text-(--muted) mt-2">You were invited to join a chama.</p>
        </div>

        {!isAuthenticated && (
          <div className="space-y-4">
            <p className="text-sm text-(--muted)">
              Sign in or create an account first. After authentication, you will be asked if you want to join this chama.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link to={ROUTES.auth.login} state={{ from: invitePath }} className="btn btn-primary justify-center">
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link to={ROUTES.auth.register} state={{ from: invitePath }} className="btn btn-outline justify-center">
                <UserPlus className="w-4 h-4" />
                Create Account
              </Link>
            </div>
          </div>
        )}

        {isAuthenticated && loading && (
          <p className="text-(--muted)">Loading invitation details...</p>
        )}

        {isAuthenticated && !loading && error && (
          <div className="px-4 py-3 rounded-2xl border border-red-200 bg-red-50 text-red-700">
            {error}
          </div>
        )}

        {isAuthenticated && !loading && !error && inviteChama && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-(--border) bg-white/70">
              <p className="text-sm text-(--muted)">Invitation to join</p>
              <h2 className="text-xl font-semibold mt-1">{inviteChama.name}</h2>
              <p className="text-sm text-(--muted) mt-2">{inviteChama.description}</p>
            </div>

            {success && (
              <div className="px-4 py-3 rounded-2xl border border-green-200 bg-green-50 text-green-700 flex gap-2 items-center">
                <CheckCircle2 className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}

            <p className="text-sm">Do you want to join this chama?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={() => void handleJoin()} loading={joining} className="w-full">
                <CheckCircle2 className="w-4 h-4" />
                {joining ? 'Joining...' : 'Yes, Join'}
              </Button>
              <Button variant="outline" onClick={() => navigate(ROUTES.app.myChamas)} className="w-full">
                <XCircle className="w-4 h-4" />
                No, Not Now
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
};

