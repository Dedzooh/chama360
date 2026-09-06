export type ChamaStatusLike = string;
export type MemberStatusLike = string;

export const operationalChamaStatuses = new Set<ChamaStatusLike>(['ACTIVE']);
export const editableChamaStatuses = new Set<ChamaStatusLike>(['DRAFT', 'ACTIVE', 'SUSPENDED']);
export const joinableChamaStatuses = new Set<ChamaStatusLike>(['ACTIVE']);
export const inviteableChamaStatuses = new Set<ChamaStatusLike>(['DRAFT', 'ACTIVE', 'SUSPENDED']);
export const terminalChamaStatuses = new Set<ChamaStatusLike>(['CLOSED', 'ARCHIVED']);
export const readonlyChamaStatuses = new Set<ChamaStatusLike>(['ARCHIVED']);

export const activeMemberStatuses = new Set<MemberStatusLike>(['ACTIVE']);
export const pendingMemberStatuses = new Set<MemberStatusLike>([
  'INVITATION_SENT',
  'PENDING_APPROVAL',
  'PENDING',
]);
export const archivedMemberStatuses = new Set<MemberStatusLike>(['ARCHIVED']);

export function isOperationalChama(status?: ChamaStatusLike | null): boolean {
  return !!status && operationalChamaStatuses.has(status);
}

export function isEditableChama(status?: ChamaStatusLike | null): boolean {
  return !!status && editableChamaStatuses.has(status);
}

export function canJoinChama(status?: ChamaStatusLike | null): boolean {
  return !!status && joinableChamaStatuses.has(status);
}

export function canInviteMembers(status?: ChamaStatusLike | null): boolean {
  return !!status && inviteableChamaStatuses.has(status);
}

export function isTerminalChama(status?: ChamaStatusLike | null): boolean {
  return !!status && terminalChamaStatuses.has(status);
}

export function isReadonlyChama(status?: ChamaStatusLike | null): boolean {
  return !!status && readonlyChamaStatuses.has(status);
}

export function isActiveMemberStatus(status?: MemberStatusLike | null): boolean {
  return !!status && activeMemberStatuses.has(status);
}

export function isPendingMemberStatus(status?: MemberStatusLike | null): boolean {
  return !!status && pendingMemberStatuses.has(status);
}

export function isArchivedMemberStatus(status?: MemberStatusLike | null): boolean {
  return !!status && archivedMemberStatuses.has(status);
}
