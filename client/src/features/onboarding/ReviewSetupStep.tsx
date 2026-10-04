import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAMA_TYPE_DETAILS, ChamaType, getModuleLabel, getRequiredPlanForModules } from '../../config/chamaBlueprint';
import { ROUTES } from '../../config/routes';
import { useWizardContext } from '../../components/wizard/WizardLayout';
import { WizardStepFrame } from '../../components/wizard/WizardStepFrame';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { getApiErrorMessage } from '../../utils/apiError';
import { Badge, Button, Card, SelectField, StatCard, TextField } from '../../design-system';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export const ReviewSetupStep = () => {
  const { draft, updateDraft, resetDraft } = useWizardContext();
  const { refreshOrganizations, setActiveOrganizationId } = useOrganizationWorkspace();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = draft.chamaType as ChamaType;
  const selectedDetails = CHAMA_TYPE_DETAILS[selectedType];
  const enabledModuleLabels = Object.entries(draft.enabledModules)
    .filter(([, enabled]) => enabled)
    .map(([module]) => getModuleLabel(module))
    .join(', ');
  const shortCode = draft.shortCode.trim();
  const requiredPlan = getRequiredPlanForModules(draft.enabledModules);
  const committee = (draft.metadata?.committeeRoles as Array<{ role: string; name: string }> | undefined) ?? [];
  const hasTreasurer = committee.some((member) => member.role === 'treasurer' && member.name.trim());
  const hasChair = committee.some((member) => member.role === 'chairperson' && member.name.trim());
  const hasSecretary = committee.some((member) => member.role === 'secretary' && member.name.trim());
  const contribution = draft.contributionRules;
  const payment = draft.paymentSettings;
  const hasPaymentSetup = Boolean(payment?.isEnabled && (payment.mode === 'PAYBILL' ? payment.paybillNumber.trim() && payment.accountNumber.trim() : payment.mpesaNumber.trim()));
  const readiness = [
    { label: 'Chama name', ready: draft.name.trim().length >= 3, detail: draft.name.trim() || 'Add a name in Chama details.' },
    { label: 'Contribution amount and schedule', ready: Boolean(contribution && contribution.amount > 0 && contribution.dueDate), detail: contribution?.amount ? `KES ${contribution.amount.toLocaleString()} · ${contribution.frequency} · due ${contribution.dueDate || 'day not set'}` : 'Set the amount, frequency, and due day.' },
    { label: 'Chairperson, Treasurer, and Secretary', ready: hasChair && hasTreasurer && hasSecretary, detail: hasChair && hasTreasurer && hasSecretary ? 'All core roles have a contact name.' : 'Add a name for each role, or leave this group in draft.' },
    { label: 'M-Pesa payment instructions', ready: hasPaymentSetup, detail: hasPaymentSetup ? (payment?.mode === 'PAYBILL' ? `PayBill ${payment.paybillNumber} · account ${payment.accountNumber}` : `Send to ${payment?.mpesaNumber}`) : 'Set a number or PayBill details in this step, or add them later in Settings.' },
    ...(draft.enabledModules.loans ? [{ label: 'Loan rules', ready: Boolean(draft.loanRules && draft.loanRules.repaymentPeriodMonths > 0 && draft.loanRules.guarantorsRequired >= 0), detail: draft.loanRules ? `${draft.loanRules.repaymentPeriodMonths} month repayment · ${draft.loanRules.guarantorsRequired} guarantors` : 'Configure repayment period and guarantors.' }] : []),
    ...(draft.enabledModules.welfare ? [{ label: 'Welfare categories', ready: Boolean((draft.welfareRules?.categories ?? []).some((category) => category.enabled)), detail: (draft.welfareRules?.categories ?? []).filter((category) => category.enabled).length ? `${(draft.welfareRules?.categories ?? []).filter((category) => category.enabled).length} categories enabled` : 'Enable at least one claim category.' }] : []),
  ];
  const launchReady = readiness.every((item) => item.ready);

  const handleCreateChama = async () => {
    const name = draft.name.trim();
    if (name.length < 3) {
      setError('Enter a Chama name with at least 3 characters before creating it.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const organizationInput = {
        name,
        organizationType: 'CHAMA' as const,
        chamaType: draft.chamaType,
        enabledModules: draft.enabledModules,
        description: draft.description.trim() || undefined,
        slug: shortCode.length >= 3 ? shortCode : undefined,
        metadata: {
          shortCode: shortCode.length >= 3 ? shortCode : undefined,
          county: draft.county.trim() || undefined,
          town: draft.town.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          logoUrl: draft.logoUrl || undefined,
          coverImageUrl: draft.coverImageUrl || undefined,
          paymentSettings: draft.paymentSettings,
          ...(draft.metadata ?? {}),
          welfareRules: draft.welfareRules,
          contributionRules: draft.contributionRules,
          loanRules: draft.loanRules,
          setupReadiness: { ready: launchReady, missing: readiness.filter((item) => !item.ready).map((item) => item.label) },
        },
      };
      const organization = draft.savedOrganizationId
        ? await organizationService.updateOrganization(draft.savedOrganizationId, organizationInput)
        : await organizationService.createOrganization(organizationInput);

      setActiveOrganizationId(organization.id);
      try { await refreshOrganizations(); } catch { /* The organization is already saved; My Chamas will retry loading it. */ }
      await useSubscriptionStore.getState().setOrganization(organization.id);
      if (launchReady) resetDraft();
      else updateDraft({ savedOrganizationId: organization.id });
      navigate(ROUTES.chama.dashboard(organization.id), { replace: true, state: { createdOrganizationId: organization.id, createdOrganizationName: organization.name, requiredPlan, launchReady } });
    } catch (createError) {
      setError(getApiErrorMessage(createError, 'Unable to create this Chama. Check the details and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WizardStepFrame
      title="Review setup"
      subtitle="Check the group rules, responsibilities, and payment instructions before saving it."
      backTo={ROUTES.createChama.invite}
      primaryLabel={submitting ? 'Saving...' : 'Save Chama'}
    >
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <Card className="p-5 md:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">Before you begin</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Launch readiness</h2><p className="mt-1 text-sm text-[var(--ds-text-muted)]">You can save a draft while details are missing. Complete these items before activating the group.</p></div><Badge tone={launchReady ? 'success' : 'warning'}>{launchReady ? 'Ready to activate' : 'Draft recommended'}</Badge></div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{readiness.map((item) => <li key={item.label} className="flex gap-3 rounded-xl border border-[var(--ds-border)] p-3"><span className={item.ready ? 'text-emerald-600' : 'text-amber-600'}>{item.ready ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}</span><div><p className="font-semibold text-[var(--ds-secondary)]">{item.label}</p><p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.detail}</p></div></li>)}</ul>
      </Card>

      <Card className="space-y-4 p-5 md:col-span-2">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">Member payments</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Payment instructions</h2><p className="mt-1 text-sm text-[var(--ds-text-muted)]">Members see these details when they pay. They can be changed later in Settings.</p></div>
        <label className="flex items-center gap-3 rounded-xl border border-[var(--ds-border)] p-3 text-sm"><input type="checkbox" checked={payment?.isEnabled ?? true} onChange={(event) => updateDraft({ paymentSettings: { ...(payment ?? { mode: 'MPESA_NUMBER', mpesaNumber: '', paybillNumber: '', accountNumber: '', accountReference: '' }), isEnabled: event.target.checked } })} />Enable member payment instructions</label>
        {payment?.isEnabled ? <><SelectField label="Payment method" value={payment.mode} onChange={(event) => updateDraft({ paymentSettings: { ...payment, mode: event.target.value as 'MPESA_NUMBER' | 'PAYBILL' } })}><option value="MPESA_NUMBER">Send money to a phone number</option><option value="PAYBILL">PayBill</option></SelectField>{payment.mode === 'PAYBILL' ? <div className="grid gap-4 sm:grid-cols-2"><TextField label="PayBill number" value={payment.paybillNumber} onChange={(event) => updateDraft({ paymentSettings: { ...payment, paybillNumber: event.target.value } })} /><TextField label="Account number or reference" value={payment.accountNumber} onChange={(event) => updateDraft({ paymentSettings: { ...payment, accountNumber: event.target.value, accountReference: event.target.value } })} /></div> : <TextField label="M-Pesa phone number" type="tel" placeholder="0712 345 678" value={payment.mpesaNumber} onChange={(event) => updateDraft({ paymentSettings: { ...payment, mpesaNumber: event.target.value } })} />}</> : <p className="text-sm text-[var(--ds-text-muted)]">You can add payment details later in Settings. The group will stay in draft until payment setup is complete.</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Branding</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card className="border-dashed border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
              <p className="text-sm font-semibold text-[var(--ds-secondary)]">Logo</p>
              <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{draft.logoUrl ? 'Logo selected' : 'No logo selected yet'}</p>
            </Card>
            <Card className="border-dashed border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
              <p className="text-sm font-semibold text-[var(--ds-secondary)]">Cover</p>
              <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{draft.coverImageUrl ? 'Cover selected' : 'No cover selected yet'}</p>
            </Card>
          </div>
        </Card>

        <StatCard label="Chama Type" value={selectedDetails.label} trend={selectedDetails.description} />
        <StatCard label="Name" value={draft.name || 'Pending'} trend={draft.shortCode ? `Code: ${draft.shortCode}` : 'Short code pending'} />
        <Card className="p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Modules</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {enabledModuleLabels ? enabledModuleLabels.split(', ').map((label) => <Badge key={label} tone="neutral">{label}</Badge>) : <span className="text-sm text-[var(--ds-text-muted)]">No modules selected yet</span>}
          </div>
        </Card>
        <Card className={`p-5 md:col-span-2 ${requiredPlan === 'FREE' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">Plan requirement</p>
          <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{requiredPlan === 'FREE' ? 'Core plan compatible' : `${requiredPlan} plan required`}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ds-text-muted)]">{requiredPlan === 'FREE' ? 'The selected modules use core features. Community stays free, with a limit of 30 active members.' : `The Chama will be saved first. ${requiredPlan} features remain locked until an administrator completes the organization subscription.`}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void handleCreateChama()} loading={submitting}>
          {submitting ? 'Saving...' : launchReady ? 'Create Chama' : 'Save as draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(ROUTES.app.myChamas)}>
          Cancel and return
        </Button>
      </div>
    </WizardStepFrame>
  );
};

