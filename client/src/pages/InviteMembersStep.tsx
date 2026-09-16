import { Link2, ShieldCheck, Users } from 'lucide-react';
import { ROUTES } from '../config/routes';
import { WizardStepFrame } from '../components/wizard/WizardStepFrame';

export const InviteMembersStep = () => <WizardStepFrame
  title="Invite members"
  subtitle="Invitations are free for every group and every plan."
  backTo={ROUTES.createChama.committee}
  nextTo={ROUTES.createChama.review}
  primaryLabel="Continue"
>
  <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border border-[var(--ds-border)] bg-white p-4"><Link2 className="h-6 w-6 text-[var(--ds-primary)]" /><h3 className="mt-3 font-bold">Share a link</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">Copy it or send it through WhatsApp after saving your group.</p></div>
    <div className="rounded-2xl border border-[var(--ds-border)] bg-white p-4"><Users className="h-6 w-6 text-[var(--ds-primary)]" /><h3 className="mt-3 font-bold">Members request to join</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">They can review your group before signing in.</p></div>
    <div className="rounded-2xl border border-[var(--ds-border)] bg-white p-4"><ShieldCheck className="h-6 w-6 text-[var(--ds-primary)]" /><h3 className="mt-3 font-bold">You approve</h3><p className="mt-1 text-sm text-[var(--ds-text-muted)]">A leader approves each request before access begins.</p></div>
  </div>
  <p className="mt-4 text-sm text-[var(--ds-text-muted)]">After you save the group, we’ll take you to its Members page to share the link.</p>
</WizardStepFrame>;
