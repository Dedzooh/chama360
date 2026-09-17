import { BellRing, FileText, HeartHandshake, Plus, ShieldCheck } from 'lucide-react';
import { getWizardRouteBefore } from '../config/chamaBlueprint';
import { ROUTES } from '../config/routes';
import { documentsToText, normalizeWelfareRules, textToDocuments, WELFARE_APPROVAL_OPTIONS, type WelfareCategoryRule, type WelfareRulesConfig } from '../config/welfareRules';
import { useWizardContext } from '../components/wizard/WizardLayout';
import { WizardStepFrame } from '../components/wizard/WizardStepFrame';
import { Badge, Card, SelectField, TextField } from '../design-system';

export const WelfareRulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const welfareEnabled = Boolean(draft.enabledModules.welfare);
  const rules = normalizeWelfareRules(draft.welfareRules ?? draft.metadata?.welfareRules, welfareEnabled);

  const updateRules = (nextRules: WelfareRulesConfig) => {
    updateDraft({
      welfareRules: nextRules,
      metadata: {
        ...(draft.metadata ?? {}),
        welfareRules: nextRules,
      },
    });
  };

  const patchRules = (patch: Partial<WelfareRulesConfig>) => {
    updateRules({ ...rules, ...patch, enabled: welfareEnabled });
  };

  const patchCategory = (key: string, patch: Partial<WelfareCategoryRule>) => {
    patchRules({
      categories: rules.categories.map((category) => (category.key === key ? { ...category, ...patch } : category)),
    });
  };

  const addCustomBenefit = () => {
    const key = `CUSTOM_${Date.now()}`;
    patchRules({ categories: [...rules.categories, { key, label: 'Custom benefit', enabled: true, limit: rules.maxClaimAmount, documents: [] }] });
  };

  const enabledCategories = rules.categories.filter((category) => category.enabled);

  return (
    <WizardStepFrame
      title="Welfare Rules"
      subtitle="Configure support rules for member claims."
      backTo={getWizardRouteBefore('welfare_rules', draft.enabledModules)}
      nextTo={ROUTES.createChama.committee}
      primaryLabel="Next"
    >
      <Card className="overflow-hidden p-0">
        <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Welfare module</p>
            <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{welfareEnabled ? 'Enabled for this chama' : 'Disabled for this chama'}</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
              These settings define contribution expectations, claim categories, limits, evidence, and approval flow.
            </p>
          </div>
          <Badge tone={welfareEnabled ? 'success' : 'neutral'}>{welfareEnabled ? 'Active' : 'Off'}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <HeartHandshake className="h-5 w-5 text-[var(--ds-primary)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Monthly amount</p>
          <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">KES {rules.monthlyContribution.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <ShieldCheck className="h-5 w-5 text-[var(--ds-primary)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Max claim</p>
          <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">KES {rules.maxClaimAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <FileText className="h-5 w-5 text-[var(--ds-primary)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Categories</p>
          <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{enabledCategories.length}</p>
        </Card>
        <Card className="p-4">
          <BellRing className="h-5 w-5 text-[var(--ds-primary)]" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Reminder day</p>
          <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{rules.reminderDay}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm text-[var(--ds-text-muted)]">Core rules</p>
        <h3 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Claim and contribution setup</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextField
            label="Monthly welfare contribution"
            type="number"
            min="0"
            value={rules.monthlyContribution}
            onChange={(event) => patchRules({ monthlyContribution: Number(event.target.value) })}
          />
          <TextField label="Maximum claim amount" type="number" min="0" value={rules.maxClaimAmount} onChange={(event) => patchRules({ maxClaimAmount: Number(event.target.value) })} />
          <TextField
            label="Waiting period before first claim"
            type="number"
            min="0"
            value={rules.waitingPeriodDays}
            helperText="Number of days a new member must wait before claiming."
            onChange={(event) => patchRules({ waitingPeriodDays: Number(event.target.value) })}
          />
          <TextField label="Monthly reminder day" type="number" min="1" max="28" value={rules.reminderDay} onChange={(event) => patchRules({ reminderDay: Number(event.target.value) })} />
          <SelectField label="Approval model" value={rules.approvalMode} onChange={(event) => patchRules({ approvalMode: event.target.value as WelfareRulesConfig['approvalMode'] })}>
            {WELFARE_APPROVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <span className="text-sm font-bold text-[var(--ds-secondary)]">Partial approvals</span>
              <input type="checkbox" checked={rules.allowPartialApproval} onChange={(event) => patchRules({ allowPartialApproval: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <span className="text-sm font-bold text-[var(--ds-secondary)]">Documents required</span>
              <input type="checkbox" checked={rules.requireDocuments} onChange={(event) => patchRules({ requireDocuments: event.target.checked })} />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm text-[var(--ds-text-muted)]">Categories</p>
        <h3 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Claim category rules</h3>
        <button type="button" onClick={addCustomBenefit} className="btn btn-outline mt-4"><Plus className="h-4 w-4" /> Add custom benefit</button>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {rules.categories.map((category) => (
            <div key={category.key} className="rounded-[1.15rem] border border-[var(--ds-border)] bg-white p-4 shadow-[var(--ds-shadow-soft)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{category.key}</p>
                  <h4 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">{category.label}</h4>
                </div>
                <input type="checkbox" checked={category.enabled} onChange={(event) => patchCategory(category.key, { enabled: event.target.checked })} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <TextField label="Category label" value={category.label} onChange={(event) => patchCategory(category.key, { label: event.target.value })} />
                <TextField label="Category limit" type="number" min="0" value={category.limit} onChange={(event) => patchCategory(category.key, { limit: Number(event.target.value) })} />
              </div>
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Required documents</span>
                <input
                  value={documentsToText(category.documents)}
                  onChange={(event) => patchCategory(category.key, { documents: textToDocuments(event.target.value) })}
                  className="input w-full"
                  placeholder="Receipt, letter, evidence"
                />
              </label>
            </div>
          ))}
        </div>
      </Card>
    </WizardStepFrame>
  );
};
