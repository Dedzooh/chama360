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

export const AuthFrame = ({ eyebrow = 'CHAMAZ360', title, subtitle, footer, icon, children }: AuthFrameProps) => {
  return (
    <div className="auth-page auth-shell min-h-screen min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hero-gradient flex min-w-0 flex-col justify-between overflow-hidden rounded-[var(--ds-radius-2xl)] p-6 text-white shadow-[var(--ds-shadow-floating)] sm:p-8">
          <div className="max-w-xl min-w-0">
            <Link to={ROUTES.auth.splash} className="auth-brand-link" aria-label="Back to CHAMAZ360 welcome page">
              <BrandLockup className="auth-brand-lockup" label="CHAMAZ360" />
            </Link>
            <Badge tone="accent" className="mt-5 border-white/15 bg-white/10 text-white">
              {eyebrow}
            </Badge>
            <h1 className="mt-5 break-words text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3.5 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-base">{subtitle}</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ['Secure', 'Encrypted sessions'],
              ['Fast', 'Quick mobile sign-in'],
              ['Built for Chamas', 'Finance, welfare, governance'],
            ].map(([label, hint]) => (
              <div key={label} className="rounded-[var(--ds-radius-lg)] border border-white/10 bg-white/[0.07] p-4 transition hover:bg-white/[0.11]">
                <p className="text-[13px] font-bold tracking-tight">{label}</p>
                <p className="mt-1 text-[12px] leading-snug text-white/65">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 flex-col justify-center">
          <div className="auth-card min-w-0 overflow-hidden rounded-[var(--ds-radius-2xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] p-0 shadow-[var(--ds-shadow-elevated)]">
            <div className="border-b border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                {icon ? <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] text-white shadow-[var(--ds-shadow-soft)]">{icon}</div> : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">Account access</p>
                  <h2 className="truncate text-xl font-black tracking-tight text-[var(--ds-secondary)]">{title}</h2>
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
