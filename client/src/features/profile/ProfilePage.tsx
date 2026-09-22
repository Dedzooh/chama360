import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Trash2, UserCircle } from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, Card, ConfirmDialog, EmptyState, TextField } from '../../design-system';
import { userService } from '../../services/userService';

interface SessionRecord {
  sessionId?: string;
  createdAt?: string;
  lastActivity?: string;
  ipAddress?: string;
  userAgent?: string;
  current?: boolean;
}

interface MfaEnrollment {
  secret: string;
  qrCode: string;
}

export const Profile = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletionConfirmationOpen, setDeletionConfirmationOpen] = useState(false);
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    authService
      .getSessions()
      .then((response) => {
        if (active) setSessions(response.sessions ?? []);
      })
      .catch(() => {
        if (active) setSessions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const updatePasswordField = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (passwordForm.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      clearAuth();
      navigate(ROUTES.auth.login, {
        replace: true,
        state: { message: 'Password changed. Sign in with your new password.' },
      });
    } catch (changeError) {
      setError(getApiErrorMessage(changeError, 'Unable to change password.'));
    } finally {
      setSaving(false);
    }
  };

  const logoutAllDevices = async () => {
    setError('');
    setSigningOutAll(true);
    try {
      await authService.logoutAll();
      clearAuth();
      navigate(ROUTES.auth.login, {
        replace: true,
        state: { message: 'All sessions were signed out.' },
      });
    } catch (logoutError) {
      setError(getApiErrorMessage(logoutError, 'Unable to sign out all devices.'));
    } finally {
      setSigningOutAll(false);
    }
  };

  const sessionCount = sessions.length;

  const beginMfaEnrollment = async () => {
    setError('');
    setMfaBusy(true);
    try {
      const response = await authService.configureMfa(true);
      if (!response.secret || !response.qrCode) throw new Error('MFA setup details were not returned.');
      setMfaEnrollment({ secret: response.secret, qrCode: response.qrCode });
      setMfaCode('');
    } catch (setupError) {
      setError(getApiErrorMessage(setupError, 'Unable to start MFA setup.'));
    } finally {
      setMfaBusy(false);
    }
  };

  const finishMfaChange = async (enable: boolean) => {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Enter the current 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setMfaBusy(true);
    try {
      const response = await authService.configureMfa(enable, mfaCode);
      setMfaCode('');
      setMfaEnrollment(null);
      if (enable && response.recoveryCodes?.length) {
        setMfaRecoveryCodes(response.recoveryCodes);
        return;
      }
      clearAuth();
      navigate(ROUTES.auth.login, {
        replace: true,
        state: { message: `Multi-factor authentication was ${enable ? 'enabled' : 'disabled'}. Sign in again.` },
      });
    } catch (setupError) {
      setError(getApiErrorMessage(setupError, `Unable to ${enable ? 'enable' : 'disable'} MFA.`));
      setMfaCode('');
    } finally {
      setMfaBusy(false);
    }
  };

  const finishRecoveryCodeDisplay = () => {
    setMfaRecoveryCodes([]);
    clearAuth();
    navigate(ROUTES.auth.login, {
      replace: true,
      state: { message: 'Multi-factor authentication was enabled. Sign in again.' },
    });
  };

  const revokeDeviceSession = async (sessionId: string) => {
    setError('');
    setRevokingSessionId(sessionId);
    try {
      await authService.revokeSession(sessionId);
      setSessions((current) => current.filter((session) => session.sessionId !== sessionId));
    } catch (revokeError) {
      setError(getApiErrorMessage(revokeError, 'Unable to sign out that device.'));
    } finally {
      setRevokingSessionId(null);
    }
  };

  const requestAccountDeletion = async () => {
    if (!deletionPassword) {
      setError('Enter your current password to delete your account.');
      return;
    }
    setError('');
    setDeletingAccount(true);
    try {
      await userService.requestAccountDeletion(deletionPassword, deletionReason);
      clearAuth();
      navigate(ROUTES.auth.login, {
        replace: true,
        state: { message: 'Your account deletion request was received and access has been disabled.' },
      });
    } catch (deletionError) {
      setError(getApiErrorMessage(deletionError, 'Unable to request account deletion.'));
      setDeletingAccount(false);
    } finally {
      setDeletionPassword('');
    }
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-profile">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Account</span>
            <strong>{user?.kycStatus ?? 'Pending'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{user ? `${user.firstName} ${user.lastName}` : 'Your profile'}</p>
            <h1>Profile and security</h1>
            <small>Manage your CHAMAZ360 identity, password, and active device sessions.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#profile-password">
              <KeyRound className="h-4 w-4" />
              Password
            </a>
            <a href="#profile-sessions">
              <MonitorSmartphone className="h-4 w-4" />
              Sessions
            </a>
            <a href="#profile-mfa">
              <ShieldCheck className="h-4 w-4" />
              MFA
            </a>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><MonitorSmartphone className="h-5 w-5" /></span>
            <p>Sessions</p>
            <strong>{sessionCount}</strong>
            <small>Active devices</small>
          </article>
          <article>
            <span className="blue"><ShieldCheck className="h-5 w-5" /></span>
            <p>Password</p>
            <strong>Protected</strong>
            <small>Change anytime</small>
          </article>
          <article>
            <span className="gold"><UserCircle className="h-5 w-5" /></span>
            <p>Security</p>
            <strong>{user?.mfaEnabled ? 'MFA on' : 'Password'}</strong>
            <small>{user?.mfaEnabled ? 'Authenticator protected' : 'MFA available'}</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card id="profile-password" className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] text-[var(--ds-secondary)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Account details</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Primary login and verification profile.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <p className="text-[var(--ds-text-muted)]">Name</p>
              <p className="font-semibold text-[var(--ds-secondary)]">{user ? `${user.firstName} ${user.lastName}` : 'Not loaded'}</p>
            </div>
            <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <p className="text-[var(--ds-text-muted)]">Email</p>
              <p className="font-semibold text-[var(--ds-secondary)]">{user?.email ?? 'Not loaded'}</p>
            </div>
            <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <p className="text-[var(--ds-text-muted)]">Phone</p>
              <p className="font-semibold text-[var(--ds-secondary)]">{user?.phone ?? 'Not loaded'}</p>
            </div>
            <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <p className="text-[var(--ds-text-muted)]">KYC status</p>
              <p className="font-semibold text-[var(--ds-secondary)]">{user?.kycStatus ?? 'Pending'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] text-[var(--ds-secondary)]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Change password</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Changing password signs you back in with the new credentials.</p>
            </div>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={submitPasswordChange}>
            <TextField label="Current password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="New password" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} />
              <TextField label="Confirm password" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => updatePasswordField('confirmPassword', event.target.value)} />
            </div>
            <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <KeyRound className="h-4 w-4" /> : undefined}>
              Update password
            </Button>
          </form>
        </Card>
      </section>

      <Card id="profile-mfa" className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] text-[var(--ds-secondary)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Authenticator security</p>
              <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
                {user?.mfaEnabled
                  ? 'MFA is enabled. A current authenticator code is required to disable it.'
                  : 'Add a time-based code from Google Authenticator, Microsoft Authenticator, Authy, or another compatible app.'}
              </p>
            </div>
          </div>
          {!user?.mfaEnabled && !mfaEnrollment && mfaRecoveryCodes.length === 0 ? (
            <Button type="button" loading={mfaBusy} onClick={() => void beginMfaEnrollment()}>
              Enable MFA
            </Button>
          ) : null}
        </div>

        {mfaRecoveryCodes.length > 0 ? (
          <div className="mt-5 rounded-[var(--ds-radius-lg)] border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Save these recovery codes now</p>
            <p className="mt-1 text-sm text-amber-900">Each code works once. They will not be shown again. Store them somewhere separate from this device.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {mfaRecoveryCodes.map(code => <code key={code} className="rounded-md bg-white px-3 py-2 text-center text-sm text-[var(--ds-secondary)]">{code}</code>)}
            </div>
            <Button type="button" className="mt-4" onClick={finishRecoveryCodeDisplay}>I have saved these codes</Button>
          </div>
        ) : mfaEnrollment ? (
          <div className="mt-5 grid gap-5 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] p-4 md:grid-cols-[auto_1fr]">
            <img src={mfaEnrollment.qrCode} alt="Authenticator setup QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ds-secondary)]">1. Scan the QR code</p>
                <p className="mt-1 text-xs text-[var(--ds-text-muted)]">If scanning is unavailable, enter this secret manually. Do not share it.</p>
                <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-sm text-[var(--ds-secondary)]">{mfaEnrollment.secret}</code>
              </div>
              <TextField label="2. Enter the current 6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" loading={mfaBusy} onClick={() => void finishMfaChange(true)}>Confirm and enable</Button>
                <Button type="button" variant="outline" disabled={mfaBusy} onClick={() => { setMfaEnrollment(null); setMfaCode(''); }}>Cancel</Button>
              </div>
            </div>
          </div>
        ) : null}

        {user?.mfaEnabled && mfaRecoveryCodes.length === 0 ? (
          <div className="mt-5 max-w-md space-y-3">
            <TextField label="Current 6-digit authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button type="button" variant="outline" className="border-rose-300 text-rose-800" loading={mfaBusy} onClick={() => void finishMfaChange(false)}>
              Disable MFA
            </Button>
          </div>
        ) : null}
      </Card>

      <Card id="profile-sessions" className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] text-[var(--ds-secondary)]">
              <MonitorSmartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Active sessions</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Current authenticated device sessions.</p>
            </div>
          </div>
          <Button variant="outline" disabled={signingOutAll} onClick={() => void logoutAllDevices()} startIcon={!signingOutAll ? <LogOut className="h-4 w-4" /> : undefined}>
            Logout all devices
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {sessions.length === 0 ? (
            <EmptyState title="No active session details available." description="Session data will appear here when the backend returns active devices." />
          ) : (
            sessions.map((session) => (
              <div key={session.sessionId ?? session.createdAt} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-[var(--ds-secondary)]">
                    {session.ipAddress ?? 'Unknown network'}{session.current ? ' · Current device' : ''}
                  </p>
                  <p className="text-[var(--ds-text-muted)]">{session.lastActivity ? new Date(session.lastActivity).toLocaleString() : 'Active now'}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-[var(--ds-text-muted)]">{session.userAgent ?? 'CHAMAZ360 app session'}</p>
                  {!session.current && session.sessionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={revokingSessionId === session.sessionId}
                      onClick={() => void revokeDeviceSession(session.sessionId!)}
                    >
                      {revokingSessionId === session.sessionId ? 'Signing out…' : 'Sign out device'}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card id="profile-delete-account" className="border-rose-200 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-lg)] bg-rose-50 text-rose-700">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-rose-800">Delete account</p>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
              Request deletion of your account and personal data. Access is disabled immediately. Financial, dispute, security, and audit records may be retained only where required by law and will no longer be used for ordinary account activity.
            </p>
          </div>
        </div>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Reason (optional)</span>
          <textarea
            value={deletionReason}
            onChange={(event) => setDeletionReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="input min-h-24 w-full"
            placeholder="You do not have to provide a reason."
          />
        </label>
        <div className="mt-4 max-w-md">
          <TextField
            label="Current password"
            type="password"
            value={deletionPassword}
            onChange={(event) => setDeletionPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <p className="mt-2 text-xs text-[var(--ds-text-muted)]">Required to confirm that you own this account.</p>
        </div>
        <Button type="button" variant="outline" className="mt-4 border-rose-300 text-rose-800" disabled={deletingAccount} onClick={() => deletionPassword ? setDeletionConfirmationOpen(true) : void requestAccountDeletion()} startIcon={!deletingAccount ? <Trash2 className="h-4 w-4" /> : undefined}>
          {deletingAccount ? 'Submitting request…' : 'Delete my account'}
        </Button>
      </Card>
      <ConfirmDialog
        open={deletionConfirmationOpen}
        title="Permanently delete your account?"
        description="You will be signed out immediately. Personal data will be deleted or anonymized, while financial, dispute, security, and audit records may be retained where legally required."
        confirmLabel="Delete my account"
        destructive
        busy={deletingAccount}
        onClose={() => setDeletionConfirmationOpen(false)}
        onConfirm={() => void requestAccountDeletion()}
      />
    </div>
  );
};
