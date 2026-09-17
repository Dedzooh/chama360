import type { ChamaStatus, MemberStatus } from "../types";

export const chamaStatusOrder: ChamaStatus[] = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "ARCHIVED",
];

export const chamaStatusLabels: Record<ChamaStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export const chamaStatusTone: Record<ChamaStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
  SUSPENDED: "bg-amber-50 text-amber-800 border-amber-200",
  CLOSED: "bg-rose-50 text-rose-700 border-rose-200",
  ARCHIVED: "bg-slate-100 text-slate-500 border-slate-200",
};

export const chamaStatusDescriptions: Record<ChamaStatus, string> = {
  DRAFT: "Can be edited before activation.",
  ACTIVE: "Fully operational and accepting work.",
  INACTIVE: "Temporarily paused and not transacting.",
  SUSPENDED: "Locked for governance or compliance reasons.",
  CLOSED: "No new contributions or loans are allowed.",
  ARCHIVED: "Read-only history for previous operations.",
};

export const operationalChamaStatuses: ChamaStatus[] = ["ACTIVE"];
export const editableChamaStatuses: ChamaStatus[] = ["DRAFT", "ACTIVE", "INACTIVE", "SUSPENDED"];
export const joinableChamaStatuses: ChamaStatus[] = ["DRAFT", "ACTIVE", "INACTIVE"];
export const inviteableChamaStatuses: ChamaStatus[] = ["DRAFT", "ACTIVE", "INACTIVE"];
export const terminalChamaStatuses: ChamaStatus[] = ["CLOSED", "ARCHIVED"];
export const readonlyChamaStatuses: ChamaStatus[] = ["CLOSED", "ARCHIVED"];

export const memberStatusLabels: Record<MemberStatus, string> = {
  INVITATION_SENT: "Invitation Sent",
  PENDING_APPROVAL: "Pending Approval",
  PENDING: "Pending",
  ACTIVE: "Active Member",
  SUSPENDED: "Suspended",
  EXITED: "Exited",
  ARCHIVED: "Archived",
};

export const memberStatusTone: Record<MemberStatus, string> = {
  INVITATION_SENT: "bg-slate-100 text-slate-600 border-slate-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-800 border-amber-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
  EXITED: "bg-slate-100 text-slate-500 border-slate-200",
  ARCHIVED: "bg-slate-100 text-slate-500 border-slate-200",
};

export const activeMemberStatuses: MemberStatus[] = ["ACTIVE"];
export const pendingMemberStatuses: MemberStatus[] = ["INVITATION_SENT", "PENDING_APPROVAL", "PENDING"];
export const archivedMemberStatuses: MemberStatus[] = ["EXITED", "ARCHIVED"];

export const getChamaStatusLabel = (status?: ChamaStatus | null) => (status ? chamaStatusLabels[status] ?? status : "Unknown");

export const getChamaStatusDescription = (status?: ChamaStatus | null) =>
  (status ? chamaStatusDescriptions[status] ?? "" : "");

export const getChamaStatusTone = (status?: ChamaStatus | null) => (status ? chamaStatusTone[status] ?? chamaStatusTone.INACTIVE : chamaStatusTone.INACTIVE);

export const isOperationalChama = (status?: ChamaStatus | null) => Boolean(status && operationalChamaStatuses.includes(status));
export const isEditableChama = (status?: ChamaStatus | null) => Boolean(status && editableChamaStatuses.includes(status));
export const canJoinChama = (status?: ChamaStatus | null) => Boolean(status && joinableChamaStatuses.includes(status));
export const canInviteMembers = (status?: ChamaStatus | null) => Boolean(status && inviteableChamaStatuses.includes(status));
export const isTerminalChama = (status?: ChamaStatus | null) => Boolean(status && terminalChamaStatuses.includes(status));
export const isReadonlyChama = (status?: ChamaStatus | null) => Boolean(status && readonlyChamaStatuses.includes(status));
export const isActiveMemberStatus = (status?: MemberStatus | null) => Boolean(status && activeMemberStatuses.includes(status));
export const isPendingMemberStatus = (status?: MemberStatus | null) => Boolean(status && pendingMemberStatuses.includes(status));
export const isArchivedMemberStatus = (status?: MemberStatus | null) => Boolean(status && archivedMemberStatuses.includes(status));
