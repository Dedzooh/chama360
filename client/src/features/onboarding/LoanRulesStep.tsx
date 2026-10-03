import { getWizardRouteAfter, getWizardRouteBefore } from "../../config/chamaBlueprint";
import { useWizardContext } from "../../components/wizard/WizardLayout";
import { WizardStepFrame } from "../../components/wizard/WizardStepFrame";

export const LoanRulesStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const loansEnabled = Boolean(draft.enabledModules.loans);
  const rules = draft.loanRules ?? { enabled: loansEnabled, interestRate: 5, maxLoanMultiplier: 3, repaymentPeriodMonths: 6, guarantorsRequired: 2, lateRepaymentPenalty: 0 };
  const patchRules = (patch: Partial<typeof rules>) => updateDraft({ loanRules: { ...rules, ...patch } });

  return (
    <WizardStepFrame
      title="Loan setup"
      subtitle="Choose the borrowing rules your group has agreed to, including interest, repayment time, and guarantors."
      backTo={getWizardRouteBefore('loan_rules', draft.enabledModules)}
      nextTo={getWizardRouteAfter('loan_rules', draft.enabledModules)}
      primaryLabel="Next"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Loans are currently <span className="font-semibold text-slate-900">{loansEnabled ? "on" : "off"}</span>. Turn them on below if members should be able to apply.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Allow members to apply for loans</span>
          <select className="w-full rounded-xl border border-slate-200 px-4 py-3" value={loansEnabled ? "yes" : "no"} onChange={(event) => { const enabled = event.target.value === 'yes'; updateDraft({ enabledModules: { ...draft.enabledModules, loans: enabled }, loanRules: { ...rules, enabled } }); }}>
            <option value="no">No, keep loans off</option>
            <option value="yes">Yes, enable loans</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Interest rate (%)</span>
          <input type="number" min="0" value={rules.interestRate} disabled={!loansEnabled} onChange={(event) => patchRules({ interestRate: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
          <span className="block text-sm text-slate-500">Use the rate written in your group’s loan agreement.</span>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Maximum loan multiplier</span>
          <input type="number" min="0" value={rules.maxLoanMultiplier} disabled={!loansEnabled} onChange={(event) => patchRules({ maxLoanMultiplier: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
          <span className="block text-sm text-slate-500">Set the borrowing limit used by your group.</span>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Time to repay (months)</span>
          <input type="number" min="1" value={rules.repaymentPeriodMonths} disabled={!loansEnabled} onChange={(event) => patchRules({ repaymentPeriodMonths: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Guarantors required</span>
          <input type="number" min="0" value={rules.guarantorsRequired} disabled={!loansEnabled} onChange={(event) => patchRules({ guarantorsRequired: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
          <span className="block text-sm text-slate-500">How many members must agree to guarantee each loan?</span>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Late repayment penalty</span>
          <input type="number" min="0" value={rules.lateRepaymentPenalty} disabled={!loansEnabled} onChange={(event) => patchRules({ lateRepaymentPenalty: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
          <span className="block text-sm text-slate-500">Enter 0 if your group does not charge a late penalty.</span>
        </label>
      </div>
    </WizardStepFrame>
  );
};

