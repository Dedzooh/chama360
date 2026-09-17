import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ChamaType, CREATE_CHAMA_WIZARD_STEPS, getActiveWizardSteps, getDefaultEnabledModules } from '../../config/chamaBlueprint';
import type { WelfareRulesConfig } from '../../config/welfareRules';
import { Badge, Card, Progress, Stepper } from '../../design-system';

export interface WizardDraftState {
  chamaType: string;
  name: string;
  shortCode: string;
  description: string;
  county: string;
  town: string;
  phone: string;
  enabledModules: Record<string, boolean>;
  logoUrl?: string;
  coverImageUrl?: string;
  welfareRules?: WelfareRulesConfig;
  contributionRules?: { amount: number; frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'custom'; dueDate: string; latePenalty: number; gracePeriodDays: number; lateAllowed?: boolean; startDate?: string; applyTo?: 'all_members' | 'active_members'; customFrequency?: string };
  loanRules?: { enabled: boolean; interestRate: number; maxLoanMultiplier: number; repaymentPeriodMonths: number; guarantorsRequired: number; lateRepaymentPenalty: number };
  metadata?: Record<string, unknown>;
}

interface WizardLayoutContext {
  draft: WizardDraftState;
  updateDraft: (next: Partial<WizardDraftState>) => void;
  resetDraft: () => void;
}

export const WizardContext = React.createContext<WizardLayoutContext | null>(null);

export const useWizardContext = () => {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContext must be used within WizardLayout');
  }
  return context;
};

export const WizardLayout = () => {
  const location = useLocation();
  const initialDraft: WizardDraftState = {
    chamaType: 'SAVINGS',
    name: '',
    shortCode: '',
    description: '',
    county: '',
    town: '',
    phone: '',
    enabledModules: getDefaultEnabledModules(ChamaType.Savings),
    contributionRules: { amount: 1000, frequency: 'monthly', dueDate: '', latePenalty: 0, gracePeriodDays: 3, lateAllowed: true, startDate: '', applyTo: 'all_members' },
    loanRules: { enabled: false, interestRate: 5, maxLoanMultiplier: 3, repaymentPeriodMonths: 6, guarantorsRequired: 2, lateRepaymentPenalty: 0 },
  };
  const [draft, setDraft] = React.useState<WizardDraftState>(() => {
    try {
      const saved = sessionStorage.getItem('chama360:create-chama-draft');
      return saved ? { ...initialDraft, ...JSON.parse(saved) } : initialDraft;
    } catch { return initialDraft; }
  });

  React.useEffect(() => {
    try { sessionStorage.setItem('chama360:create-chama-draft', JSON.stringify(draft)); } catch { /* Large image previews may exceed browser storage; the in-memory draft remains available. */ }
  }, [draft]);

  const activeSteps = getActiveWizardSteps(draft.enabledModules);
  const currentStepIndex = activeSteps.findIndex((step) => location.pathname === step.route);
  const configuredStep = CREATE_CHAMA_WIZARD_STEPS.find((step) => location.pathname === step.route);
  if (configuredStep && currentStepIndex < 0) {
    const nextStep = activeSteps.find((step) => step.order > configuredStep.order) ?? activeSteps[activeSteps.length - 1];
    return <Navigate to={nextStep.route} replace />;
  }
  const currentStep = currentStepIndex >= 0 ? activeSteps[currentStepIndex] : activeSteps[0];
  const progressValue = Math.max(0, currentStepIndex + 1);
  const progressPercent = Math.round((progressValue / activeSteps.length) * 100);

  const updateDraft = (next: Partial<WizardDraftState>) => {
    setDraft((current) => ({ ...current, ...next }));
  };
  const resetDraft = () => {
    sessionStorage.removeItem('chama360:create-chama-draft');
    setDraft(initialDraft);
  };

  return (
    <WizardContext.Provider value={{ draft, updateDraft, resetDraft }}>
      <section className="chama360-wizard-shell">
        <Card className="chama360-wizard-overview overflow-hidden p-0">
          <div className="chama360-wizard-hero hero-gradient p-4 text-white sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Create Chama Wizard</p>
                  <h1 className="mt-2 text-2xl font-black sm:text-3xl">Build a new Chama</h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">A guided setup flow for type, modules, governance, and launch readiness.</p>
                </div>
                <Badge tone="accent" className="border-white/15 bg-white/10 text-white">
                  Step {progressValue} of {activeSteps.length}
                </Badge>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">
                  <span>Setup progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2">
                  <Progress value={progressPercent} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="chama360-wizard-stepper-panel overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Step {progressValue}</p>
                <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">{currentStep.title}</h2>
              </div>
              <div className="overflow-x-auto pb-1">
                <Stepper currentStep={currentStep.key} steps={activeSteps.map((step) => ({ key: step.key, label: step.title }))} />
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <Outlet context={{ draft, updateDraft }} />
          </div>
        </Card>
      </section>
    </WizardContext.Provider>
  );
};
