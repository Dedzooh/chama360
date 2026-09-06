import { ROUTES } from "../config/routes";
import { getWizardRouteAfter } from "../config/chamaBlueprint";
import { useWizardContext } from "../components/wizard/WizardLayout";
import { WizardStepFrame } from "../components/wizard/WizardStepFrame";

export const ContributionRulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const rules = draft.contributionRules ?? { amount: 1000, frequency: 'monthly' as const, dueDate: '', latePenalty: 0, gracePeriodDays: 3 };
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
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Due Date</span>
          <input type="date" value={rules.dueDate} onChange={(event) => patchRules({ dueDate: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Late Penalty</span>
          <input type="number" min="0" value={rules.latePenalty} onChange={(event) => patchRules({ latePenalty: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Grace Period</span>
          <input type="number" min="0" value={rules.gracePeriodDays} onChange={(event) => patchRules({ gracePeriodDays: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Current chama type: <span className="font-semibold text-slate-900">{draft.chamaType}</span>
      </div>
    </WizardStepFrame>
  );
};
