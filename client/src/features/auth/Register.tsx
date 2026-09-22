import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AuthFrame } from '../../components/auth/AuthFrame';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiError';
import { trackCommercialEvent } from '../../utils/commercialFunnel';
import { Button, TextField } from '../../design-system';

const Register = () => {
  useEffect(() => { trackCommercialEvent('SIGNUP_STARTED'); }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from
    ?? sessionStorage.getItem('pending_organization_invite')
    ?? sessionStorage.getItem('pending_invite_link')
    ?? undefined;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationalId: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (Object.values(form).some((value) => !value.trim())) {
      setError('Complete all registration fields.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedLegal) {
      setError('Accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const response = await authService.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email,
        phone: form.phone.trim(),
        nationalId: form.nationalId.trim(),
        password: form.password,
        acceptTerms: true,
      });

      navigate(ROUTES.auth.otpVerification, {
        state: {
          mode: 'email',
          email,
          password: form.password,
          verificationCode: response.emailVerificationCode,
          from: returnTo,
        },
      });
    } catch (registerError) {
      setError(getApiErrorMessage(registerError, 'Registration failed. Check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Create account"
      title="Start your CHAMAZ360 account"
      subtitle="Set up your profile and start joining or creating Chamas."
      icon={<UserPlus className="h-5 w-5" />}
      footer={
        <div className="text-sm text-[var(--ds-text-muted)]">
          <Link to={ROUTES.auth.login} className="font-semibold text-[var(--ds-secondary)]">
            Already have an account?
          </Link>
          <span className="mx-2">·</span><Link to={ROUTES.legal.centre} className="font-semibold text-[var(--ds-secondary)]">Legal & privacy</Link>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={submitRegistration}>
        {returnTo?.startsWith('/org-invite/') || returnTo?.startsWith('/join/') ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">After email verification, you will return to your invitation to join the Chama.</div> : null}
        {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" placeholder="Jane" autoComplete="given-name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} />
          <TextField label="Last name" placeholder="Wanjiku" autoComplete="family-name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} />
        </div>
        <TextField label="Email" placeholder="you@example.com" autoComplete="email" inputMode="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
        <TextField label="Phone" placeholder="+254712345678" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
        <TextField label="National ID" placeholder="12345678" inputMode="numeric" value={form.nationalId} onChange={(event) => updateField('nationalId', event.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Password" placeholder="Password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => updateField('password', event.target.value)} />
          <TextField label="Confirm" placeholder="Repeat password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} />
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4 text-sm text-[var(--ds-text-muted)]">
          <input className="mt-1 h-4 w-4 accent-[var(--ds-primary)]" type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} />
          <span>I agree to the <Link className="font-bold text-[var(--ds-primary)]" to={`${ROUTES.legal.centre}#terms`}>Terms of Service</Link> and acknowledge the <Link className="font-bold text-[var(--ds-primary)]" to={`${ROUTES.legal.centre}#privacy`}>Privacy Policy</Link>, including organization records and subscription processing.</span>
        </label>

        <Button type="submit" loading={loading} disabled={!acceptedLegal} className="w-full" startIcon={!loading ? <UserPlus className="h-4 w-4" /> : undefined}>
          Create account
        </Button>
      </form>
    </AuthFrame>
  );
};

export { Register };

