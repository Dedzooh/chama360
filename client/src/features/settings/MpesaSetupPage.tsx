import { useEffect, useState } from 'react';
import { Smartphone, ShieldCheck } from 'lucide-react';
import { Button, Card } from '../../design-system';
import { PaymentMethodsPanel } from '../finance';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { ROUTES } from '../../config/routes';

/**
 * Dedicated M-Pesa configuration page for a Chama.
 *
 * Reuses the existing chama-owned payment methods infrastructure
 * (OrganizationPaymentMethod: Till / PayBill / Treasurer's M-Pesa / Bank) and
 * adds the STK Push collection toggle. These are the Chama's OWN collection
 * channels and are deliberately separate from the Chama360 platform
 * subscription payment number.
 */
export const MpesaSetupPage = () => {
  const { currentOrganization, refreshOrganizations } = useOrganizationWorkspace();
  const canManage = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'].includes((currentOrganization?.myRole ?? '').toUpperCase());
  const [stkEnabled, setStkEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const meta = (currentOrganization?.metadata ?? {}) as { stkPushEnabled?: boolean };
    setStkEnabled(Boolean(meta.stkPushEnabled));
  }, [currentOrganization?.id]);

  if (!currentOrganization) {
    return <Card className="p-6"><p className="text-sm text-[var(--ds-text-muted)]">Open a Chama from My Chamas to configure M-Pesa.</p></Card>;
  }

  const saveStk = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await organizationService.updateOrganization(currentOrganization.id, {
        metadata: {
          ...((currentOrganization.metadata as Record<string, unknown>) ?? {}),
          // Stored as its own metadata key: metadata.paymentSettings is
          // re-validated by the backend against the legacy payment profile
          // schema (mode/mpesaNumber) and would reject this toggle.
          stkPushEnabled: stkEnabled,
        },
      });
      setMessage('STK Push setting saved.');
      void refreshOrganizations();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save STK Push setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-mpesa">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>M-Pesa setup</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Configure contribution collection</h1>
            <p>Set up the M-Pesa channels your members use to pay contributions: STK Push, Till, PayBill, or the Treasurer's personal number.</p>
          </div>
        </div>
      </section>

      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}
      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

      <Card className="space-y-4 p-6">
        <div>
          <p className="font-semibold text-[var(--ds-secondary)]">M-Pesa STK Push</p>
          <p className="text-sm text-[var(--ds-text-muted)]">
            When enabled, members can pay contributions with a one-tap STK Push prompt sent to their phone. They approve with their M-Pesa PIN inside the official M-Pesa prompt — Chama360 never sees or stores the PIN.
          </p>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
          <div>
            <p className="font-semibold text-[var(--ds-secondary)]">Enable STK Push collection</p>
            <p className="text-sm text-[var(--ds-text-muted)]">Adds the "M-Pesa STK Push" option wherever members pay a contribution.</p>
          </div>
          <input type="checkbox" checked={stkEnabled} onChange={(event) => setStkEnabled(event.target.checked)} />
        </label>
        <Button type="button" onClick={() => void saveStk()} loading={saving} startIcon={!saving ? <ShieldCheck className="h-4 w-4" /> : undefined}>
          Save STK Push setting
        </Button>
      </Card>

      <PaymentMethodsPanel organizationId={currentOrganization.id} canManage={canManage} />

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-1 h-5 w-5 text-[var(--ds-primary)]" />
          <div>
            <p className="font-semibold text-[var(--ds-secondary)]">Next step</p>
            <p className="text-sm text-[var(--ds-text-muted)]">
              Once a method is active here, members see it on the Contributions page. You can also send STK Push requests and reconcile payments from the{' '}
              <a className="font-semibold text-[var(--ds-primary)] underline" href={ROUTES.admin.mpesa}>M-Pesa operations page</a>.
            </p>
          </div>
        </div>
        {stkEnabled ? null : (
          <p className="mt-3 text-sm text-[var(--ds-text-muted)]">STK Push is currently off. Members can still pay via Till, PayBill, or the Treasurer's number configured below.</p>
        )}
      </Card>
    </div>
  );
};
