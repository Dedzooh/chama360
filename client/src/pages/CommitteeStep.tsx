import { useMemo, useState } from "react";
import { getWizardRouteBefore } from "../config/chamaBlueprint";
import { ROUTES } from "../config/routes";
import { useWizardContext } from "../components/wizard/WizardLayout";
import { WizardStepFrame } from "../components/wizard/WizardStepFrame";

const COMMITTEE_ROLES = [
  { key: "chairperson", title: "Chairperson", description: "Guides meetings and approves committee decisions." },
  { key: "secretary", title: "Secretary", description: "Records minutes, notices, and follow-up actions." },
  { key: "treasurer", title: "Treasurer", description: "Handles contributions, wallet balances, and payouts." },
  { key: "auditor", title: "Auditor", description: "Reviews records and checks financial controls." },
  { key: "committee_member", title: "Committee Member", description: "Supports governance and operational follow-through." },
] as const;

export const CommitteeStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const [committeeNote, setCommitteeNote] = useState("");
  const committee = useMemo(() => {
    const existing = (draft.metadata?.committeeRoles as Array<{ role: string; name: string; notes?: string }> | undefined) ?? [];
    return COMMITTEE_ROLES.map((role) => existing.find((item) => item.role === role.key) ?? { role: role.key, name: "", notes: "" });
  }, [draft.metadata?.committeeRoles]);

  const saveCommitteeRole = (role: string, name: string) => {
    const nextRoles = [
      ...((draft.metadata?.committeeRoles as Array<{ role: string; name: string; notes?: string }> | undefined) ?? []).filter((item) => item.role !== role),
      { role, name, notes: committeeNote.trim() || undefined },
    ];

    updateDraft({ metadata: { ...(draft.metadata ?? {}), committeeRoles: nextRoles } });
  };

  return (
    <WizardStepFrame
      title="Committee"
      subtitle="Assign the core committee roles and capture any governance notes."
      backTo={getWizardRouteBefore('committee', draft.enabledModules)}
      nextTo={ROUTES.createChama.invite}
      primaryLabel="Next"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {COMMITTEE_ROLES.map((role, index) => (
          <label key={role.key} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-slate-900">{role.title}</span>
                <p className="mt-1 text-sm leading-6 text-slate-600">{role.description}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">Role {index + 1}</span>
            </div>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              placeholder="Select member or enter name"
              value={committee[index]?.name ?? ""}
              onChange={(event) => saveCommitteeRole(role.key, event.target.value)}
            />
          </label>
        ))}
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Committee notes</span>
          <textarea
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            rows={3}
            placeholder="Enter election rules, tenure, quorum, or any custom governance note."
            value={committeeNote}
            onChange={(event) => setCommitteeNote(event.target.value)}
            onBlur={() => updateDraft({ metadata: { ...(draft.metadata ?? {}), committeeNote: committeeNote.trim() || undefined } })}
          />
        </label>
      </div>
    </WizardStepFrame>
  );
};
