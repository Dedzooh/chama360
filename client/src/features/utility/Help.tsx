import { LifeBuoy, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../design-system';
import { ROUTES } from '../../config/routes';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@chama360.co.ke';

export const Help = () => (
  <div className="space-y-6">
    <section className="chama360-module-hero"><div className="chama360-module-hero-main"><div className="chama360-module-hero-copy"><p>Help centre</p><h1>Support when you need it</h1><small>Guidance for accounts, organizations, payments, reports, and the CHAMA360 mobile app.</small></div></div></section>
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5"><LifeBuoy className="h-6 w-6 text-[var(--ds-primary)]"/><h2 className="mt-3 font-black text-[var(--ds-secondary)]">Using CHAMA360</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Start from My Chamas, select an organization, then use its dashboard to manage members, contributions, loans, welfare, meetings, and reports.</p></Card>
      <Card className="p-5"><Mail className="h-6 w-6 text-[var(--ds-primary)]"/><h2 className="mt-3 font-black text-[var(--ds-secondary)]">Contact support</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Include your organization name, account email, issue, and transaction reference. Never send a password or M-Pesa PIN.</p><a className="mt-4 inline-block font-bold text-[var(--ds-primary)]" href={`mailto:${supportEmail}`}>{supportEmail}</a></Card>
      <Card className="p-5"><ShieldCheck className="h-6 w-6 text-[var(--ds-primary)]"/><h2 className="mt-3 font-black text-[var(--ds-secondary)]">Legal and privacy</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Review account rules, data handling, subscription cancellation, refunds, and complaint handling.</p><Link className="mt-4 inline-block font-bold text-[var(--ds-primary)]" to={ROUTES.legal.centre}>Open legal centre</Link></Card>
    </div>
  </div>
);

