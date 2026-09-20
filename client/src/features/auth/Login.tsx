import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { AuthFrame } from '../../components/auth/AuthFrame';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, TextField } from '../../design-system';

interface LoginLocationState {
  from?: string;
  message?: string;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTokens = useAuthStore((state) => state.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const concealPassword = () => setShowPassword(false);
    const handleVisibility = () => { if (document.visibilityState !== 'visible') concealPassword(); };
    window.addEventListener('blur', concealPassword);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', concealPassword);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });

      if ('requiresMfa' in response && response.requiresMfa) {
        navigate(ROUTES.auth.otpVerification, {
          state: { mode: 'mfa', tempToken: response.tempToken, email: email.trim().toLowerCase(), from: locationState?.from },
        });
        return;
      }

      if ('verificationRequired' in response && response.verificationRequired) {
        navigate(ROUTES.auth.otpVerification, { state: { mode: 'email', email: response.email, password, verificationCode: response.verificationCode, from: locationState?.from, message: response.verificationDelivery === 'PROVIDER_NOT_CONFIGURED' ? 'Email delivery will be enabled when the provider is configured. Use the development code for now.' : 'Enter the code sent to your email.' } });
        return;
      }

      if (!('accessToken' in response)) {
        throw new Error('Login did not return an authenticated session.');
      }

      setTokens(response.accessToken, response.refreshToken);
      const profile = await authService.getCurrentUser();
      setAuth(profile.user, response.accessToken, response.refreshToken);
      navigate(locationState?.from ?? ROUTES.app.myChamas, { replace: true });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Login failed. Check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Secure sign in"
      title="Welcome back"
      subtitle="Sign in to manage your Chamas, contributions, loans, and welfare workflows."
      icon={<LogIn className="h-5 w-5" />}
      footer={
        <div className="flex items-center justify-between gap-3 text-sm">
          <Link to={ROUTES.auth.forgotPassword} className="font-semibold text-[var(--ds-secondary)]">
            Forgot password?
          </Link>
          <Link to={ROUTES.auth.register} className="font-semibold text-[var(--ds-primary-strong)]">
            Create account
          </Link>
          <Link to={ROUTES.legal.centre} className="font-semibold text-[var(--ds-secondary)]">Legal</Link>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={submitLogin}>
        {locationState?.message ? <div className="success-banner px-4 py-3 text-sm">{locationState.message}</div> : null}
        {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

        <TextField label="Email" placeholder="you@example.com" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />

        <div className="relative">
          <TextField
            label="Password"
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 top-9 rounded-xl p-2 text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-secondary)]"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
          <input type="checkbox" className="accent-[var(--ds-primary)]" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
          Remember me
        </label>

        <Button type="submit" loading={loading} className="w-full" startIcon={!loading ? <LogIn className="h-4 w-4" /> : undefined}>
          Login
        </Button>
      </form>
    </AuthFrame>
  );
};

export { Login };

