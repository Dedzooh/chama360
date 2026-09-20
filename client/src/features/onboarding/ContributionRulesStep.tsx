import { ROUTES } from "../../config/routes";
import { getWizardRouteAfter } from "../../config/chamaBlueprint";
import { useWizardContext } from "../../components/wizard/WizardLayout";
import { WizardStepFrame } from "../../components/wizard/WizardStepFrame";

export const ContributionRulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const rules = draft.contributionRules ?? { amount: 1000, frequency: 'monthly' as const, dueDate: '', latePenalty: 0, gracePeriodDays: 3, lateAllowed: true, startDate: '', applyTo: 'all_members' as const };
  const patchRules = (patch: Partial<typeof rules>) => updateDraft({ contributionRules: { ...rules, ...patch } });

  return (
    <WizardStepFrame
      title="Contribution Rules"
      subtitle="Set the contribution amount and schedule."
      backTo={ROUTES.createChama.modules}
      nextTo={getWizardRouteAfter('contribution_rules', draft.enabledModules)}
      primaryLabel="Next"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Contribution Amount</span>
          <input type="number" min="0" value={rules.amount} onChange={(event) => patchRules({ amount: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Frequency</span>
          <select className="w-full rounded-xl border border-slate-200 px-4 py-3" value={rules.frequency} onChange={(event) => patchRules({ frequency: event.target.value as typeof rules.frequency })}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="one_time">One-time</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Due day or date</span>
          <input type={['monthly', 'quarterly', 'annual'].includes(rules.frequency) ? 'number' : 'date'} min={['monthly', 'quarterly', 'annual'].includes(rules.frequency) ? 1 : undefined} max={['monthly', 'quarterly', 'annual'].includes(rules.frequency) ? 28 : undefined} value={rules.dueDate} onChange={(event) => patchRules({ dueDate: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Late Penalty</span>
          <input type="number" min="0" value={rules.latePenalty} onChange={(event) => patchRules({ latePenalty: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Grace Period</span>
          <input type="number" min="0" value={rules.gracePeriodDays} onChange={(event) => patchRules({ gracePeriodDays: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-700"><input type="checkbox" checked={rules.lateAllowed ?? true} onChange={(event) => patchRules({ lateAllowed: event.target.checked })} /> Late contribution allowed</label>
        <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Start date</span><input type="date" value={rules.startDate ?? ''} onChange={(event) => patchRules({ startDate: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Apply to</span><select className="w-full rounded-xl border border-slate-200 px-4 py-3" value={rules.applyTo ?? 'all_members'} onChange={(event) => patchRules({ applyTo: event.target.value as 'all_members' | 'active_members' })}><option value="all_members">All members</option><option value="active_members">Active members only</option></select></label>
        {rules.frequency === 'custom' ? <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-700">Custom frequency</span><input value={rules.customFrequency ?? ''} onChange={(event) => patchRules({ customFrequency: event.target.value })} placeholder="For example: every 2 weeks" className="w-full rounded-xl border border-slate-200 px-4 py-3" /></label> : null}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Current chama type: <span className="font-semibold text-slate-900">{draft.chamaType}</span>
      </div>
    </WizardStepFrame>
  );
};

