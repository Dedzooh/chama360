import { FormEvent, ReactElement, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, Card, TextField, SelectField } from '../../design-system';
import {
  organizationService,
  channelTypeLabels,
  type ChamaPaymentChannelType,
  type ChamaPaymentMethodStatus,
  type OrganizationPaymentMethodRecord,
} from '../../services/organizationService';

// Finance → Payment Methods
//
// Available to authorized roles only (Founder / Chair / Treasurer / Admin).
// Each method carries a status (Active / Pending verification / Disabled) and
// every change is audited on the server with previous and new values so
// member payments cannot be fraudulently redirected.

const statusMeta: Record<ChamaPaymentMethodStatus, { label: string; tone: 'success' | 'warning' | 'error'; icon: ReactElement }> = {
  ACTIVE: { label: 'Active', tone: 'success', icon: <CheckCircle2 className="h-4 w-4" /> },
  PENDING_VERIFICATION: { label: 'Pending verification', tone: 'warning', icon: <Clock3 className="h-4 w-4" /> },
  DISABLED: { label: 'Disabled', tone: 'error', icon: <XCircle className="h-4 w-4" /> },
};

const emptyForm = {
  channelType: 'MPESA_TILL' as ChamaPaymentChannelType,
  label: '',
  tillNumber: '',
  paybillNumber: '',
  accountNumber: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  phone: '',
  recipientName: '',
  instructions: '',
};

export const PaymentMethodsPanel = ({ organizationId, canManage }: { organizationId: string; canManage: boolean }) => {
  const [methods, setMethods] = useState<OrganizationPaymentMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await organizationService.listPaymentMethods(organizationId);
      setMethods(data.methods);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await organizationService.addPaymentMethod(organizationId, {
        channelType: form.channelType,
        label: form.label.trim() || channelTypeLabels[form.channelType],
        tillNumber: form.tillNumber.trim() || undefined,
        paybillNumber: form.paybillNumber.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        recipientName: form.recipientName.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        status: 'ACTIVE',
      });
      setForm(emptyForm);
      setShowForm(false);
      setMessage('Payment method added. Every change is recorded in the audit trail.');
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not add the payment method');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (method: OrganizationPaymentMethodRecord, status: ChamaPaymentMethodStatus) => {
    setSaving(true);
    setError(null);
    try {
      await organizationService.updatePaymentMethod(organizationId, method.id, { status });
      setMessage(`"${method.label}" is now ${statusMeta[status].label.toLowerCase()}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the method');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--ds-text-muted)]">Chama → Finance</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Payment Methods</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--ds-text-muted)]"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Changes to collection numbers are audit-logged with previous and new values.</p>
        </div>
        {canManage ? <Button variant="outline" onClick={() => setShowForm((open) => !open)} startIcon={<Plus className="h-4 w-4" />}>{showForm ? 'Close' : 'Add payment method'}</Button> : null}
      </div>

      {message ? <p className="mt-3 rounded-[var(--ds-radius-md)] bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-[var(--ds-radius-md)] bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {showForm && canManage ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
          <SelectField label="Type" value={form.channelType} onChange={(event) => setForm((current) => ({ ...current, channelType: event.target.value as ChamaPaymentChannelType }))}>
            {(Object.keys(channelTypeLabels) as ChamaPaymentChannelType[]).map((type) => <option key={type} value={type}>{channelTypeLabels[type]}</option>)}
          </SelectField>
          <TextField label="Display name" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder={channelTypeLabels[form.channelType]} />
          {form.channelType === 'MPESA_TILL' ? <TextField label="Till number" value={form.tillNumber} onChange={(event) => setForm((current) => ({ ...current, tillNumber: event.target.value }))} required /> : null}
          {form.channelType === 'MPESA_PAYBILL' ? (
            <>
              <TextField label="PayBill number" value={form.paybillNumber} onChange={(event) => setForm((current) => ({ ...current, paybillNumber: event.target.value }))} required />
              <TextField label="Account reference required?" value={form.accountNumber} onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))} placeholder="e.g. MALI-001" />
            </>
          ) : null}
          {form.channelType === 'TREASURER_MPESA' ? (
            <>
              <TextField label="Treasurer's M-Pesa number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required />
              <TextField label="Recipient name" value={form.recipientName} onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} placeholder="John — Treasurer" />
              <p className="text-xs text-[var(--ds-text-muted)]">Members pay this person directly. Chama360 will still require the Treasurer to reconcile the payment into the Chama ledger — money sent to the Treasurer is not automatically a contribution.</p>
            </>
          ) : null}
          {form.channelType === 'BANK' ? (
            <>
              <TextField label="Bank name" value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} required />
              <TextField label="Account name" value={form.bankAccountName} onChange={(event) => setForm((current) => ({ ...current, bankAccountName: event.target.value }))} />
              <TextField label="Account number" value={form.bankAccountNumber} onChange={(event) => setForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} required />
            </>
          ) : null}
          {form.channelType === 'OTHER' ? <TextField label="Instructions" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} /> : null}
          <Button type="submit" loading={saving} className="w-full">Save payment method</Button>
        </form>
      ) : null}

      <div className="mt-5 space-y-2">
        {loading ? <p className="text-sm text-[var(--ds-text-muted)]">Loading…</p> : methods.length === 0 ? (
          <p className="text-sm text-[var(--ds-text-muted)]">No payment methods yet. Add a Till, PayBill, Treasurer's number or bank account so members know where to pay contributions.</p>
        ) : methods.map((method) => (
          <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4">
            <div>
              <p className="font-bold text-[var(--ds-secondary)]">{method.label} {method.isDefault ? <Badge tone="info">Default</Badge> : null}</p>
              <p className="text-sm text-[var(--ds-text-muted)]">{method.kind}{method.value ? <>: <strong className="text-[var(--ds-secondary)]">{method.value}</strong></> : null}{method.account ? <> · {method.account}</> : null}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusMeta[method.status].tone}><span className="inline-flex items-center gap-1">{statusMeta[method.status].icon}{statusMeta[method.status].label}</span></Badge>
              {canManage && method.status !== 'ACTIVE' ? <Button variant="outline" onClick={() => void setStatus(method, 'ACTIVE')} disabled={saving}>Activate</Button> : null}
              {canManage && method.status === 'ACTIVE' ? <Button variant="outline" onClick={() => void setStatus(method, 'DISABLED')} disabled={saving}>Disable</Button> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
