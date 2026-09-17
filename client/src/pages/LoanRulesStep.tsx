import { getWizardRouteAfter, getWizardRouteBefore } from "../config/chamaBlueprint";
import { useWizardContext } from "../components/wizard/WizardLayout";
import { WizardStepFrame } from "../components/wizard/WizardStepFrame";

export const LoanRulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const loansEnabled = Boolean(draft.enabledModules.loans);
  const rules = draft.loanRules ?? { enabled: loansEnabled, interestRate: 5, maxLoanMultiplier: 3, repaymentPeriodMonths: 6, guarantorsRequired: 2, lateRepaymentPenalty: 0 };
  const patchRules = (patch: Partial<typeof rules>) => updateDraft({ loanRules: { ...rules, ...patch } });

  return (
    <WizardStepFrame
      title="Loan Rules"
      subtitle="Define borrowing behaviour for the chama."
      backTo={getWizardRouteBefore('loan_rules', draft.enabledModules)}
      nextTo={getWizardRouteAfter('loan_rules', draft.enabledModules)}
      primaryLabel="Next"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Loans module is <span className="font-semibold text-slate-900">{loansEnabled ? "enabled" : "disabled"}</span>.
        {loansEnabled ? " Configure the loan rules below." : " You can still review this step before turning loans on."}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Enable Loans</span>
          <select className="w-full rounded-xl border border-slate-200 px-4 py-3" value={loansEnabled ? "yes" : "no"} onChange={(event) => { const enabled = event.target.value === 'yes'; updateDraft({ enabledModules: { ...draft.enabledModules, loans: enabled }, loanRules: { ...rules, enabled } }); }}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Interest Rate</span>
          <input type="number" min="0" value={rules.interestRate} disabled={!loansEnabled} onChange={(event) => patchRules({ interestRate: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Max Loan Multiplier</span>
          <input type="number" min="0" value={rules.maxLoanMultiplier} disabled={!loansEnabled} onChange={(event) => patchRules({ maxLoanMultiplier: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Repayment Period</span>
          <input type="number" min="1" value={rules.repaymentPeriodMonths} disabled={!loansEnabled} onChange={(event) => patchRules({ repaymentPeriodMonths: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Guarantors Required</span>
          <input type="number" min="0" value={rules.guarantorsRequired} disabled={!loansEnabled} onChange={(event) => patchRules({ guarantorsRequired: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Late Repayment Penalty</span>
          <input type="number" min="0" value={rules.lateRepaymentPenalty} disabled={!loansEnabled} onChange={(event) => patchRules({ lateRepaymentPenalty: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
      </div>
    </WizardStepFrame>
  );
};
