import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { AuthFrame } from '../../components/auth/AuthFrame';
import { ROUTES } from '../../config/routes';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../utils/apiError';
import { trackCommercialEvent } from '../../utils/commercialFunnel';
import { Button, Dialog } from '../../design-system';

// Shared field shell so the eye toggle sits INSIDE the input box and errors
// render directly beneath the field (no scrolling up to a banner).
const PasswordField = ({
  label,
  placeholder,
  value,
  error,
  onChange,
  autoComplete,
}: {
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div data-has-error={error ? 'true' : undefined}>
      <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`ds-input h-11 w-full rounded-[var(--ds-radius-md)] border bg-[var(--ds-surface-3)] pl-4 pr-12 text-sm text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-muted)] focus:ring-4 ${error ? 'border-[var(--ds-error)] focus:border-[var(--ds-error)] focus:ring-[rgba(220,38,38,0.16)]' : 'border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-[var(--ds-ring)]'}`}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-secondary)]"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--ds-error)]">{error}</p> : null}
    </div>
  );
};

// In-dialog summary of the legal terms so users can read and agree without
// leaving the signup flow. Mirrors the legal centre text.
const TermsContent = () => (
  <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-2 text-sm leading-6 text-[var(--ds-text-muted)]">
    <section>
      <h3 className="font-bold text-[var(--ds-secondary)]">Terms of Service</h3>
      <p className="mt-2">CHAMAZ360 provides record-keeping, communication, governance, reporting, and payment-support tools for Chamas and other organizations. It does not promise investment returns, replace professional financial or legal advice, or hold itself out as a bank.</p>
      <p className="mt-2">You must provide accurate information, protect your credentials, and use only accounts and organizations you are authorized to manage. Organization administrators are responsible for member permissions, approvals, uploaded records, internal rules, and the accuracy of entries made by their users.</p>
      <p className="mt-2">Users must not misuse the service for fraud, unlawful activity, unauthorized access, harassment, or manipulation of financial and governance records. Access may be restricted where necessary to protect users, comply with law, investigate abuse, or maintain the service.</p>
      <p className="mt-2">The service may change as features, providers, regulations, and security requirements evolve. Material changes will be communicated through the app or registered contact details.</p>
    </section>
    <section>
      <h3 className="font-bold text-[var(--ds-secondary)]">Privacy Policy</h3>
      <p className="mt-2">We process account identity, contact details, organization membership, financial records, governance activity, device/session data, support communications, and documents that users choose to provide. We use this information to operate and secure CHAMAZ360, deliver requested features, process subscriptions, provide support, prevent abuse, and meet legal obligations. We do not sell personal data.</p>
      <p className="mt-2">Information may be shared with authorized organization members, contracted infrastructure and communication providers, payment providers such as M-Pesa, professional advisers, or public authorities where lawfully required.</p>
      <p className="mt-2">We retain information only for operational, contractual, security, audit, dispute, and legal purposes. Safeguards include access controls, authenticated sessions, audit records, and protected provider credentials. Subject to applicable law, you may request access, correction, or deletion of your data; Kenyan users may also contact the Office of the Data Protection Commissioner.</p>
    </section>
  </div>
);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const textError = (field: keyof typeof form) => fieldErrors[field];
  const fieldClass = (field: keyof typeof form) => textError(field) ? 'border-[var(--ds-error)] focus:border-[var(--ds-error)] focus:ring-[rgba(220,38,38,0.16)]' : 'border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-[var(--ds-ring)]';
  const TextField = ({ field, label, placeholder, autoComplete, inputMode, type = 'text' }: { field: keyof typeof form; label: string; placeholder: string; autoComplete?: string; inputMode?: 'text' | 'email' | 'tel' | 'numeric'; type?: string }) => (
    <div data-has-error={textError(field) ? 'true' : undefined}>
      <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
        className={`ds-input h-11 w-full rounded-[var(--ds-radius-md)] border bg-[var(--ds-surface-3)] px-4 text-sm text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-muted)] focus:ring-4 ${fieldClass(field)}`}
      />
      {textError(field) ? <p className="mt-2 text-sm text-[var(--ds-error)]">{textError(field)}</p> : null}
    </div>
  );

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError('');

    const errors: Record<string, string> = {};
    (Object.keys(form) as Array<keyof typeof form>).forEach((field) => {
      if (!form[field].trim()) errors[field] = 'This field is required.';
    });
    if (form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!acceptedLegal) {
      errors.legal = 'Read and accept the Terms of Service to create an account.';
    }
    setFieldErrors(errors);

    // Scroll the first problem into view instead of making the user hunt.
    if (Object.keys(errors).length) {
      if (errors.legal) {
        document.getElementById('register-legal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        formRef.current?.querySelector<HTMLElement>('[data-has-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
      setGeneralError(getApiErrorMessage(registerError, 'Registration failed. Check your details and try again.'));
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
      <form ref={formRef} className="space-y-4" onSubmit={submitRegistration} noValidate>
        {returnTo?.startsWith('/org-invite/') || returnTo?.startsWith('/join/') ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">After email verification, you will return to your invitation to join the Chama.</div> : null}
        {generalError ? <div className="error-banner px-4 py-3 text-sm">{generalError}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField field="firstName" label="First name" placeholder="Jane" autoComplete="given-name" />
          <TextField field="lastName" label="Last name" placeholder="Wanjiku" autoComplete="family-name" />
        </div>
        <TextField field="email" label="Email" placeholder="you@example.com" autoComplete="email" inputMode="email" />
        <TextField field="phone" label="Phone" placeholder="+254712345678" autoComplete="tel" inputMode="tel" />
        <TextField field="nationalId" label="National ID" placeholder="12345678" inputMode="numeric" />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label="Password"
            placeholder="Password"
            value={form.password}
            error={fieldErrors.password}
            onChange={(value) => updateField('password', value)}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm"
            placeholder="Repeat password"
            value={form.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
            autoComplete="new-password"
          />
        </div>

        <div id="register-legal" data-has-error={fieldErrors.legal ? 'true' : undefined} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4 text-sm text-[var(--ds-text-muted)]">
          <label className="flex items-start gap-3">
            <input className="mt-1 h-4 w-4 accent-[var(--ds-primary)]" type="checkbox" checked={acceptedLegal} onChange={(event) => {
              setAcceptedLegal(event.target.checked);
              setFieldErrors((current) => {
                if (!current.legal) return current;
                const next = { ...current };
                delete next.legal;
                return next;
              });
            }} />
            <span>I agree to the Terms of Service and acknowledge the Privacy Policy, including organization records and subscription processing.</span>
          </label>
          <button
            type="button"
            className="mt-2 ml-7 font-bold text-[var(--ds-primary)] underline underline-offset-2"
            onClick={() => setTermsOpen(true)}
          >
            Read the terms
          </button>
          {fieldErrors.legal ? <p className="mt-2 ml-7 text-sm text-[var(--ds-error)]">{fieldErrors.legal}</p> : null}
        </div>

        <Button type="submit" loading={loading} className="w-full" startIcon={!loading ? <UserPlus className="h-4 w-4" /> : undefined}>
          Create account
        </Button>
      </form>

      <Dialog
        open={termsOpen}
        title="Terms & privacy"
        description="Please read before agreeing."
        onClose={() => setTermsOpen(false)}
      >
        <TermsContent />
        <p className="mt-3 text-xs text-[var(--ds-text-muted)]">Full versions: <Link className="font-semibold text-[var(--ds-primary)]" to={`${ROUTES.legal.centre}#terms`} onClick={() => setTermsOpen(false)}>Terms of Service</Link> · <Link className="font-semibold text-[var(--ds-primary)]" to={`${ROUTES.legal.centre}#privacy`} onClick={() => setTermsOpen(false)}>Privacy Policy</Link></p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setTermsOpen(false)}>Close</Button>
          <Button type="button" onClick={() => { setAcceptedLegal(true); setFieldErrors((current) => { const next = { ...current }; delete next.legal; return next; }); setTermsOpen(false); }}>
            I agree
          </Button>
        </div>
      </Dialog>
    </AuthFrame>
  );
};

export { Register };

