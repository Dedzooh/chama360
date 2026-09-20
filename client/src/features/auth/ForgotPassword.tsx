import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthFrame } from '../../components/auth/AuthFrame';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, TextField } from '../../design-system';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Enter the email linked to your account.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.forgotPassword(email.trim().toLowerCase());
      navigate(ROUTES.auth.otpVerification, {
        state: {
          mode: 'reset',
          email: email.trim().toLowerCase(),
          resetToken: response.resetToken,
          message: response.message,
        },
      });
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, 'Unable to request password reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Recover access"
      subtitle="Request a reset code for your CHAMA360 account."
      icon={<MailCheck className="h-5 w-5" />}
      footer={<p className="text-sm text-[var(--ds-text-muted)]">We will send a reset flow to your registered email address.</p>}
    >
      <form className="space-y-4" onSubmit={submitResetRequest}>
        {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}
        <TextField label="Email" placeholder="you@example.com" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" loading={loading} className="w-full" startIcon={<MailCheck className="h-4 w-4" />}>
          Send reset link
        </Button>
      </form>
    </AuthFrame>
  );
};

export { ForgotPassword };

