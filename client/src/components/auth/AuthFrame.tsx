import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../BrandLogo';
import { ROUTES } from '../../config/routes';
import { Badge } from '../../design-system';

interface AuthFrameProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

export const AuthFrame = ({ eyebrow = 'CHAMA360', title, subtitle, footer, icon, children }: AuthFrameProps) => {
  return (
    <div className="auth-page auth-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hero-gradient flex flex-col justify-between overflow-hidden rounded-[var(--ds-radius-2xl)] p-6 text-white shadow-[var(--ds-shadow-floating)] sm:p-8">
          <div className="max-w-xl">
            <Link to={ROUTES.auth.splash} className="auth-brand-link" aria-label="Back to CHAMA360 welcome page">
              <BrandLockup className="auth-brand-lockup" label="CHAMA360" />
            </Link>
            <Badge tone="accent" className="mt-5 border-white/15 bg-white/10 text-white">
              {eyebrow}
            </Badge>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base text-white/84 sm:text-lg">{subtitle}</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ['Secure', 'Encrypted sessions'],
              ['Fast', 'Quick mobile sign-in'],
              ['Built for Chamas', 'Finance, welfare, governance'],
            ].map(([label, hint]) => (
              <div key={label} className="rounded-[var(--ds-radius-lg)] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-bold">{label}</p>
                <p className="mt-1 text-sm text-white/74">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <div className="auth-card overflow-hidden rounded-[var(--ds-radius-2xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] p-0 shadow-[var(--ds-shadow-elevated)]">
            <div className="border-b border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                {icon ? <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] text-white shadow-[var(--ds-shadow-soft)]">{icon}</div> : null}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Account access</p>
                  <h2 className="truncate text-2xl font-black text-[var(--ds-secondary)]">{title}</h2>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6 sm:p-8">
              <p className="text-sm text-[var(--ds-text-muted)]">{subtitle}</p>
              {children}
              {footer ? <div className="pt-2">{footer}</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
