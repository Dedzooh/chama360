import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHAMA_TYPE_DETAILS, ChamaType, getModuleLabel, getRequiredPlanForModules } from '../../config/chamaBlueprint';
import { ROUTES } from '../../config/routes';
import { useWizardContext } from '../../components/wizard/WizardLayout';
import { WizardStepFrame } from '../../components/wizard/WizardStepFrame';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { getApiErrorMessage } from '../../utils/apiError';
import { Badge, Button, Card, StatCard } from '../../design-system';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export const ReviewSetupStep = () => {
  const { draft, resetDraft } = useWizardContext();
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

  const handleCreateChama = async () => {
    const name = draft.name.trim();
    if (name.length < 3) {
      setError('Enter a Chama name with at least 3 characters before creating it.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const organization = await organizationService.createOrganization({
        name,
        organizationType: 'CHAMA',
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
          ...(draft.metadata ?? {}),
          welfareRules: draft.welfareRules,
          contributionRules: draft.contributionRules,
          loanRules: draft.loanRules,
        },
      });

      setActiveOrganizationId(organization.id);
      try { await refreshOrganizations(); } catch { /* The organization is already saved; My Chamas will retry loading it. */ }
      await useSubscriptionStore.getState().setOrganization(organization.id);
      resetDraft();
      navigate(ROUTES.chama.dashboard(organization.id), { replace: true, state: { createdOrganizationId: organization.id, createdOrganizationName: organization.name, requiredPlan } });
    } catch (createError) {
      setError(getApiErrorMessage(createError, 'Unable to create this Chama. Check the details and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WizardStepFrame
      title="Review setup"
      subtitle="Confirm the chosen chama type, modules, and branding before creating it."
      backTo={ROUTES.createChama.invite}
      primaryLabel={submitting ? 'Saving...' : 'Save Chama'}
    >
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

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
          {submitting ? 'Saving...' : 'Save Chama'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(ROUTES.app.myChamas)}>
          Cancel and return
        </Button>
      </div>
    </WizardStepFrame>
  );
};

