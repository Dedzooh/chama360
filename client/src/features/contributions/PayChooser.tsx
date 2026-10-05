import { useEffect, useState } from 'react';
import { CreditCard, Users, AlertTriangle } from 'lucide-react';
import { Card } from '../../design-system';
import { organizationService, type OrganizationPaymentMethodRecord } from '../../services/organizationService';

// WHAT ARE YOU PAYING FOR? — the guard rail screen.
//
// Chama360 has two completely different kinds of payment:
//   1. Chama360 Subscription (platform billing, number 0713222431) — paid by
//      a Chama administrator to keep the Chama360 plan active.
//   2. Chama Contribution (the Chama's own money, via the Chama's own
//      Till / PayBill / Treasurer number) — paid by members.
//
// There is deliberately NO single generic "Pay" button. This chooser makes
// the distinction obvious before any payment details are shown, so nobody
// sends a KSh 1,000 contribution to the platform's subscription number.

export type PayIntent = 'SUBSCRIPTION' | 'CONTRIBUTION';

type PayChooserProps = {
  organizationId: string;
  organizationName: string;
  onSelect: (intent: PayIntent) => void;
  canManageBilling?: boolean;
};

export const PayChooser = ({ organizationId, organizationName, onSelect, canManageBilling = true }: PayChooserProps) => {
  const [methods, setMethods] = useState<OrganizationPaymentMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    organizationService
      .listPaymentMethods(organizationId)
      .then((data) => { if (!cancelled) setMethods(data.methods.filter((method) => method.status === 'ACTIVE')); })
      .catch(() => { /* methods are optional; the chooser still works */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  const activeMethods = methods.filter((method) => method.status === 'ACTIVE');

  return (
    <Card className="p-6">
      <p className="text-sm text-[var(--ds-text-muted)]">{organizationName}</p>
      <h2 className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">What are you paying for?</h2>
      <p className="mt-1 text-sm text-[var(--ds-text-muted)]">These are two different payments to two different places. Choose carefully.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* Chama360 Subscription — platform money */}
        <button
          type="button"
          disabled={!canManageBilling}
          onClick={() => onSelect('SUBSCRIPTION')}
          className={`text-left rounded-[var(--ds-radius-lg)] border-2 border-emerald-300 bg-emerald-50/60 p-5 transition hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${canManageBilling ? '' : 'opacity-50 cursor-not-allowed'}`}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">🟢 Chama360 Subscription</span>
          <p className="mt-3 font-bold text-emerald-950">Pay for your Chama360 plan.</p>
          <p className="mt-1 text-sm text-emerald-900">Goes to the <strong>Chama360 platform</strong> collection number — this is not Chama money.</p>
          <p className="mt-3 text-xs text-emerald-800">Only a Chama administrator pays this.</p>
          <span className="mt-4 inline-flex items-center gap-1 font-bold text-emerald-700"><CreditCard className="h-4 w-4" /> Pay Subscription</span>
          {!canManageBilling ? <p className="mt-2 text-xs text-emerald-800">Only Founder, Chair or Treasurer can manage billing.</p> : null}
        </button>

        {/* Chama Contribution — the Chama's own money */}
        <button
          type="button"
          onClick={() => onSelect('CONTRIBUTION')}
          className="text-left rounded-[var(--ds-radius-lg)] border-2 border-sky-300 bg-sky-50/60 p-5 transition hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">🔵 Chama Contribution</span>
          <p className="mt-3 font-bold text-sky-950">Pay money into your Chama.</p>
          <p className="mt-1 text-sm text-sky-900">Goes to <strong>{organizationName}'s own</strong> payment channels below — never to Chama360.</p>
          <span className="mt-4 inline-flex items-center gap-1 font-bold text-sky-700"><Users className="h-4 w-4" /> Pay Contribution</span>
        </button>
      </div>

      <div className="mt-5 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
        <p className="text-sm font-bold text-[var(--ds-secondary)]">{organizationName} contribution payment methods</p>
        {loading ? (
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Loading payment methods…</p>
        ) : activeMethods.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">No payment methods are active yet. Ask your Treasurer to add one in Finance → Payment Methods.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-[var(--ds-text)]">
            {activeMethods.map((method) => (
              <li key={method.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2">
                <span className="font-semibold">{method.label}</span>
                <span className="text-[var(--ds-text-muted)]">{method.kind}{method.value ? <>: <strong className="text-[var(--ds-secondary)]">{method.value}</strong></> : null}{method.account ? <> · {method.account}</> : null}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-[var(--ds-text-muted)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          Contributions must be sent to the channels listed above. The Chama360 subscription number is completely separate.
        </p>
      </div>
    </Card>
  );
};
