import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, KeyRound, ShieldCheck } from 'lucide-react';
import { AuthFrame } from '../../components/auth/AuthFrame';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, OtpInput, TextField } from '../../design-system';

type OtpMode = 'mfa' | 'reset' | 'email';

interface OtpLocationState {
  mode?: OtpMode;
  tempToken?: string;
  email?: string;
  password?: string;
  verificationCode?: string;
  resetToken?: string;
  message?: string;
  from?: string;
}

const copy = {
  mfa: {
    title: 'OTP verification',
    subtitle: 'Confirm access with your one-time authentication code.',
    button: 'Verify and continue',
    icon: ShieldCheck,
  },
  email: {
    title: 'Verify email',
    subtitle: 'Enter the verification code sent to your registered email.',
    button: 'Verify account',
    icon: BadgeCheck,
  },
  reset: {
    title: 'Reset password',
    subtitle: 'Enter your reset token and choose a new password.',
    button: 'Reset password',
    icon: KeyRound,
  },
} as const;

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as OtpLocationState | null;
  const mode: OtpMode = state?.mode ?? 'reset';
  const details = copy[mode];
  const Icon = details.icon;
  const setAuth = useAuthStore((store) => store.setAuth);
  const setTokens = useAuthStore((store) => store.setTokens);
  const [code, setCode] = useState(state?.verificationCode ?? state?.resetToken ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(state?.message ?? '');

  const signInAfterVerification = async (email: string, password: string) => {
    const login = await authService.login({ email, password });
    if ('requiresMfa' in login && login.requiresMfa) {
      navigate(ROUTES.auth.otpVerification, {
        state: { mode: 'mfa', tempToken: login.tempToken, email },
      });
      return;
    }

    if (!('accessToken' in login)) {
      throw new Error('Login did not return an authenticated session.');
    }

    setTokens(login.accessToken, login.refreshToken);
    const profile = await authService.getCurrentUser();
    setAuth(profile.user, login.accessToken, login.refreshToken);
      navigate(state?.from ?? ROUTES.app.myChamas, { replace: true });
  };

  const submitOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!code.trim()) {
      setError(mode === 'reset' ? 'Enter your reset token.' : 'Enter your verification code.');
      return;
    }

    if (mode === 'reset') {
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'mfa') {
        if (!state?.tempToken) throw new Error('Missing MFA session. Start login again.');
        const response = await authService.verifyMfa(state.tempToken, code.trim());
        setTokens(response.accessToken, response.refreshToken);
        const profile = await authService.getCurrentUser();
        setAuth(profile.user, response.accessToken, response.refreshToken);
        navigate(state?.from ?? ROUTES.app.myChamas, { replace: true });
        return;
      }

      if (mode === 'email') {
        if (!state?.email) throw new Error('Missing email address. Start registration again.');
        await authService.verifyEmail(state.email, code.trim());
        if (state.password) {
          await signInAfterVerification(state.email, state.password);
        } else {
          navigate(ROUTES.auth.login, {
            replace: true,
            state: { message: 'Email verified. Sign in to continue.' },
          });
        }
        return;
      }

      await authService.resetPassword(code.trim(), newPassword);
      navigate(ROUTES.auth.login, {
        replace: true,
        state: { message: 'Password reset successful. Sign in with your new password.' },
      });
    } catch (otpError) {
      setError(getApiErrorMessage(otpError, 'Verification failed. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (!state?.email) return;
    setLoading(true); setError(''); setMessage('');
    try { await authService.resendVerification(state.email); setMessage('A new verification code has been requested. Please check your email.'); }
    catch (resendError) { setError(getApiErrorMessage(resendError, 'Unable to resend the verification code.')); }
    finally { setLoading(false); }
  };

  return (
    <AuthFrame
      eyebrow="Verification"
      title={details.title}
      subtitle={details.subtitle}
      icon={<Icon className="h-5 w-5" />}
      footer={<Link to={ROUTES.auth.login} className="text-sm font-semibold text-[var(--ds-secondary)]">Back to login</Link>}
    >
      <form className="space-y-4" onSubmit={submitOtp}>
        {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}
        {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}
        {state?.email ? <p className="text-sm text-[var(--ds-text-muted)]">Account: <span className="font-semibold text-[var(--ds-secondary)]">{state.email}</span></p> : null}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--ds-secondary)]">{mode === 'reset' ? 'Reset token' : mode === 'mfa' ? 'Authenticator or recovery code' : 'One-time code'}</p>
          {mode === 'mfa' ? (
            <TextField value={code} onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 19))} autoComplete="one-time-code" placeholder="123456 or XXXX-XXXX-XXXX-XXXX" />
          ) : (
            <OtpInput value={code} onChange={setCode} length={6} />
          )}
        </div>

        {mode === 'reset' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">New password</span>
              <input className="h-11 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 text-sm outline-none focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Confirm</span>
              <input className="h-11 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 text-sm outline-none focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </div>
        ) : null}

        <Button type="submit" loading={loading} className="w-full" startIcon={!loading ? <details.icon className="h-4 w-4" /> : undefined}>
          {details.button}
        </Button>
        {mode === 'email' ? <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void resendEmail()}>Resend verification code</Button> : null}
      </form>
    </AuthFrame>
  );
};

export { OtpVerification };

