import { BriefcaseBusiness, Church, HeartHandshake, Landmark, PiggyBank, Repeat2, Sparkles, TrendingUp, Users } from 'lucide-react';
import { CHAMA_TYPE_DETAILS, CHAMA_TYPE_OPTIONS, ChamaType, getDefaultEnabledModules } from '../config/chamaBlueprint';
import { ROUTES } from '../config/routes';
import { useWizardContext } from '../components/wizard/WizardLayout';
import { WizardStepFrame } from '../components/wizard/WizardStepFrame';
import { Card } from '../design-system';

const typeIconMap = {
  [ChamaType.Savings]: PiggyBank,
  [ChamaType.MerryGoRound]: Repeat2,
  [ChamaType.Investment]: TrendingUp,
  [ChamaType.Welfare]: HeartHandshake,
  [ChamaType.Family]: Users,
  [ChamaType.Staff]: BriefcaseBusiness,
  [ChamaType.Church]: Church,
  [ChamaType.Hybrid]: Sparkles,
};

export const ChooseTypeStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const selected = draft.chamaType as ChamaType;
  const selectedDetails = CHAMA_TYPE_DETAILS[selected];

  return (
    <WizardStepFrame
      title="Create Chama"
      subtitle="Select the type that best fits your group."
      nextTo={ROUTES.createChama.details}
      primaryLabel="Continue"
    >
      <div className="chama360-type-grid">
        {CHAMA_TYPE_OPTIONS.map((type) => {
          const active = draft.chamaType === type;
          const details = CHAMA_TYPE_DETAILS[type];
          const Icon = typeIconMap[type] ?? Landmark;

          return (
            <button
              key={type}
              type="button"
              onClick={() => updateDraft({ chamaType: type, enabledModules: getDefaultEnabledModules(type) })}
              className={`chama360-type-card ${active ? 'active' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="chama360-type-card-title">
                  <span className="chama360-type-icon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Chama Type</p>
                  <p className="mt-2 text-lg font-black text-[var(--ds-secondary)]">{details.label}</p>
                </div>
                {active ? <span className="chama360-type-selected">Selected</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ds-text-muted)]">{details.description}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-primary-strong)]">Best for</p>
              <p className="mt-1 text-sm leading-6 text-[var(--ds-text-secondary)]">{details.bestFor}</p>
            </button>
          );
        })}
      </div>

      <Card className="chama360-selected-type-card p-5">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Selected type</p>
          <h3 className="text-xl font-black text-[var(--ds-secondary)]">{selectedDetails.label}</h3>
          <p className="leading-6 text-[var(--ds-text-muted)]">{selectedDetails.description}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-primary-strong)]">This setup is best for</p>
          <p className="leading-6 text-[var(--ds-text-secondary)]">{selectedDetails.bestFor}</p>
        </div>
      </Card>
    </WizardStepFrame>
  );
};
