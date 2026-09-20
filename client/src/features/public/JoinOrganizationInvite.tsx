import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicPageFrame } from '../../components/PublicPageFrame';
import { Button, Card } from '../../design-system';
import { ROUTES } from '../../config/routes';
import { organizationService } from '../../services/organizationService';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';

type Preview = Awaited<ReturnType<typeof organizationService.getInvitePreview>>;
const PENDING_ORGANIZATION_INVITE = 'pending_organization_invite';

export const JoinOrganizationInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [organization, setOrganization] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid invitation link.'); setLoading(false); return; }
    if (!isAuthenticated) {
      sessionStorage.setItem(PENDING_ORGANIZATION_INVITE, ROUTES.invitations.organization(token));
    }
    let active = true;
    organizationService.getInvitePreview(token)
      .then((result) => { if (active) setOrganization(result); })
      .catch((caught) => { if (active) setError(getApiErrorMessage(caught, 'This invitation link is unavailable.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const requestToJoin = async () => {
    if (!token) return;
    setJoining(true);
    setError('');
    try {
      const membership = await organizationService.joinByInvite(token);
      sessionStorage.removeItem(PENDING_ORGANIZATION_INVITE);
      if (membership.status === 'ACTIVE') {
        navigate(ROUTES.chama.dashboard(organization!.id), { replace: true });
      } else {
        setJoined(true);
      }
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to request membership.'));
    } finally {
      setJoining(false);
    }
  };

  const returnTo = ROUTES.invitations.organization(token ?? '');
  return <PublicPageFrame width="narrow" eyebrow="Group invitation" title="Join a group on CHAMA360" description="Review the group before requesting to join. Joining is free.">
    <Card className="mt-5 space-y-4 p-6">
      {loading ? <p>Loading invitation…</p> : null}
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      {organization ? <>
        <div><p className="text-sm text-[var(--ds-text-muted)]">{organization.organizationType.replaceAll('_', ' ')}</p><h2 className="text-xl font-black text-[var(--ds-secondary)]">{organization.name}</h2>{organization.description ? <p className="mt-2 text-sm">{organization.description}</p> : null}</div>
        {joined ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Your request is with the group’s leaders for approval. <Link className="underline" to={ROUTES.app.myChamas}>View my groups</Link></p>
          : isAuthenticated ? <Button onClick={() => void requestToJoin()} loading={joining} className="w-full">Request to join free</Button>
            : <div className="space-y-3"><p className="rounded-xl bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">New to CHAMA360? Create your account first and we will bring you back here to join this Chama.</p><div className="grid gap-3 sm:grid-cols-2"><Link className="btn btn-primary justify-center" to={ROUTES.auth.login} state={{ from: returnTo }}>Sign in to join</Link><Link className="btn btn-outline justify-center" to={ROUTES.auth.register} state={{ from: returnTo }}>Create account</Link></div></div>}
      </> : null}
    </Card>
  </PublicPageFrame>;
};

