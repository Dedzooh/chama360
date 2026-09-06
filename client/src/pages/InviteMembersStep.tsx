import { useState } from "react";
import { ROUTES } from "../config/routes";
import { useWizardContext } from "../components/wizard/WizardLayout";
import { WizardStepFrame } from "../components/wizard/WizardStepFrame";

const inviteMethods = [
  { key: "phone", label: "Phone", description: "Send invite instructions to member phone numbers." },
  { key: "email", label: "Email", description: "Share a formal invitation by email." },
  { key: "link", label: "Link", description: "Copy a join link for later sharing." },
  { key: "qr", label: "QR Code", description: "Display a QR code for in-person onboarding." },
] as const;

export const InviteMembersStep = () => {
  const { draft, updateDraft } = useWizardContext();
  const [inviteMethod, setInviteMethod] = useState<(typeof inviteMethods)[number]["key"]>("link");
  const [inviteValue, setInviteValue] = useState("");

  return (
    <WizardStepFrame
      title="Invite Members"
      subtitle="Invite members now or share the chama later."
      backTo={ROUTES.createChama.committee}
      nextTo={ROUTES.createChama.review}
      primaryLabel="Next"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {inviteMethods.map((method) => {
          const active = inviteMethod === method.key;

          return (
            <button
              key={method.key}
              type="button"
              onClick={() => setInviteMethod(method.key)}
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{method.label}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {active ? "Selected" : "Choose"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{method.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 space-y-2">
            <span className="text-sm font-semibold text-slate-800">Invite detail</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              placeholder={inviteMethod === "phone" ? "e.g. 0712 345 678" : inviteMethod === "email" ? "member@email.com" : "Invite text or link label"}
              value={inviteValue}
              onChange={(event) => setInviteValue(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!inviteValue.trim()}
            onClick={() => {
              const invites = Array.isArray(draft.metadata?.inviteMembers) ? (draft.metadata?.inviteMembers as Array<{ method: string; value: string }>[]) : [];
              updateDraft({
                metadata: {
                  ...(draft.metadata ?? {}),
                  inviteMembers: [...invites, { method: inviteMethod, value: inviteValue.trim() }],
                },
              });
              setInviteValue("");
            }}
          >
            Add invite
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Invite preview</p>
        <p className="mt-1 leading-6">
          The chama will be created with {Array.isArray(draft.metadata?.inviteMembers) ? (draft.metadata?.inviteMembers as Array<unknown>).length : 0} saved invite entries.
        </p>
        <p className="mt-2 leading-6">You can skip this step and invite members later from the chama dashboard.</p>
      </div>
    </WizardStepFrame>
  );
};
