import api from '../config/api';
import type { AttendanceStatus, ContributionStatus, Loan, LoanRepaymentRecord, LoanSummary, MeetingAttendanceRecord, MeetingRecord, MeetingStatus, Organization, MemberRole, MemberStatus, OrganizationType, PaymentMethod, VoteRecord, VoteResults } from '../types';

export interface OrganizationSummary extends Pick<Organization, 'id' | 'name' | 'organizationType' | 'slug' | 'description' | 'status'> {
  createdAt?: string;
  updatedAt?: string;
  chamaType?: string | null;
  enabledModules?: Record<string, boolean> | null;
  metadata?: Record<string, unknown> | null;
  role?: string;
  myRole?: string;
  myRoleLabel?: string;
  balance?: number;
  wallet?: {
    balance: number;
    currency: string;
  } | null;
  members?: OrganizationMemberRecord[];
}

export interface OrganizationDetail extends OrganizationSummary {
  wallet?: {
    balance: number;
    currency: string;
  } | null;
  settings?: Record<string, any> | null;
  members?: OrganizationMemberRecord[];
  myRole?: string;
  myRoleLabel?: string;
}

export interface OrganizationMemberRecord {
  id: string;
  organizationId: string;
  userId?: string;
  role: MemberRole | string;
  status: MemberStatus | string;
  joinedAt: string;
  updatedAt?: string;
  reliabilityScore?: number;
  organization?: Organization;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  } | null;
  roleLabel?: string | null;
}

export interface CreateOrganizationInput {
  name: string;
  organizationType: OrganizationType;
  chamaType?: string;
  enabledModules?: Record<string, boolean>;
  slug?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationInput extends Partial<CreateOrganizationInput> {
  status?: Organization['status'];
}

export interface OrganizationRoleRecord {
  id: string;
  name: string;
  label: string;
  permissions?: string[];
  isSystemDefault?: boolean;
}

export interface UpdateMemberInput {
  roleId?: string;
  status?: MemberStatus;
}

export interface ContributionRecord {
  id: string;
  memberId: string;
  amount: number;
  contributionType?: string;
  period?: string | null;
  dueDate: string;
  paidDate?: string | null;
  paidAt?: string | null;
  status: ContributionStatus;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  transactionRef?: string | null;
  recordedById?: string | null;
  reversedById?: string | null;
  reverseReason?: string | null;
  reversedAt?: string | null;
  penalties?: number;
  allocations?: Array<{ id: string; period: string; amount: number; monthlyAmount: number; allocatedAt: string }>;
  createdAt?: string;
  updatedAt?: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  recordedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reversedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface ContributionSummary {
  total: number;
  paid: number;
  pending: number;
  reversed?: number;
  creditBalance?: number;
}

export type WelfareClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_APPROVED' | 'PAID' | 'CANCELLED';
export type WelfareClaimType = 'EMERGENCY' | 'MEDICAL' | 'FUNERAL' | 'EDUCATION' | 'OTHER';

export interface WelfareClaimRecord {
  id: string;
  organizationId: string;
  requestedById: string;
  memberId?: string | null;
  type: WelfareClaimType;
  claimType?: string | null;
  amountRequested: number;
  amountApproved?: number | null;
  reason?: string | null;
  status: WelfareClaimStatus;
  description: string;
  documents?: any;
  supportingDocuments?: any;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface InvestmentAsset {
  id: string; name: string; category: 'TREASURY_BOND' | 'MONEY_MARKET' | 'REAL_ESTATE' | 'SHARES' | 'BUSINESS' | 'OTHER';
  purchaseDate: string; purchaseCost: number; currentValue: number; units: number; status: 'ACTIVE' | 'MATURED' | 'SOLD'; notes?: string;
  createdAt?: string; updatedAt?: string;
}

export interface InvestmentSummary { assetCount: number; activeAssets: number; purchaseCost: number; currentValue: number; gainLoss: number; returnPercent: number; totalMemberCapital?: number; }
export interface InvestmentPosition { memberId: string; member: { id: string; firstName: string; lastName: string; email: string }; contributed: number; ownershipPercent: number; estimatedValue: number; estimatedGain: number; }

export interface OrganizationAuditLogRecord {
  id: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  createdAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const normalizeOrganization = (organization: any): OrganizationDetail => ({
  ...organization,
  chamaType: organization?.chamaType ?? null,
  enabledModules: organization?.enabledModules ?? null,
  metadata: organization?.metadata ?? null,
  balance: Number(organization?.balance ?? organization?.wallet?.balance ?? 0),
  wallet: organization?.wallet
    ? {
        balance: Number(organization.wallet.balance ?? 0),
        currency: organization.wallet.currency ?? 'KES',
      }
    : organization?.wallet ?? null,
  members: Array.isArray(organization?.members)
    ? organization.members.map((member: any) => ({
        ...member,
        role: member?.role?.name ?? member?.role?.label ?? member?.role ?? 'MEMBER',
        roleLabel: member?.role?.label ?? null,
      }))
    : organization?.members,
});

export const organizationService = {
  getInvitePreview: async (token: string): Promise<{ id: string; name: string; description?: string | null; organizationType: string }> => {
    const response = await api.get(`/organizations/invites/${encodeURIComponent(token)}`);
    return response.data.organization;
  },
  joinByInvite: async (token: string): Promise<{ status: string }> => {
    const response = await api.post(`/organizations/invites/${encodeURIComponent(token)}/join`);
    return response.data.membership;
  },
  getInviteToken: async (id: string): Promise<string> => {
    const response = await api.get(`/organizations/${id}/invite-link`);
    return response.data.token;
  },
  rotateInviteToken: async (id: string): Promise<string> => {
    const response = await api.post(`/organizations/${id}/invite-link/rotate`);
    return response.data.token;
  },
  listMyOrganizations: async (): Promise<OrganizationSummary[]> => {
    const response = await api.get('/organizations/my', { params: { _: Date.now() } });
    const organizations = response.data.organizations ?? [];
    return organizations.map((organization: any) => ({
      ...organization,
      chamaType: organization?.chamaType ?? null,
      enabledModules: organization?.enabledModules ?? null,
      metadata: organization?.metadata ?? null,
      balance: Number(organization?.balance ?? 0),
    }));
  },

  getOrganization: async (id: string): Promise<OrganizationDetail> => {
    const response = await api.get(`/organizations/${id}`);
    return normalizeOrganization({ ...response.data.organization, myRole: response.data.myRole, myRoleLabel: response.data.myRoleLabel });
  },

  createOrganization: async (input: CreateOrganizationInput): Promise<OrganizationDetail> => {
    const response = await api.post('/organizations', input);
    return normalizeOrganization(response.data.organization);
  },

  updateOrganization: async (id: string, input: UpdateOrganizationInput): Promise<OrganizationDetail> => {
    const response = await api.patch(`/organizations/${id}`, input);
    return normalizeOrganization(response.data.organization);
  },

  activateOrganization: async (id: string): Promise<OrganizationDetail> => {
    const response = await api.post(`/organizations/${id}/activate`);
    return normalizeOrganization(response.data.organization);
  },

  suspendOrganization: async (id: string): Promise<OrganizationDetail> => {
    const response = await api.post(`/organizations/${id}/suspend`);
    return normalizeOrganization(response.data.organization);
  },

  closeOrganization: async (id: string): Promise<OrganizationDetail> => {
    const response = await api.post(`/organizations/${id}/close`);
    return normalizeOrganization(response.data.organization);
  },

  archiveOrganization: async (id: string): Promise<OrganizationDetail> => {
    const response = await api.post(`/organizations/${id}/archive`);
    return normalizeOrganization(response.data.organization);
  },

  listMembers: async (id: string): Promise<OrganizationMemberRecord[]> => {
    const response = await api.get(`/organizations/${id}/members`);
    return (response.data.members ?? []).map((member: any) => ({
      ...member,
      role: member?.role?.name ?? member?.role?.label ?? member?.role ?? 'MEMBER',
      roleLabel: member?.role?.label ?? null,
    }));
  },

  listRoles: async (id: string): Promise<OrganizationRoleRecord[]> => {
    const response = await api.get(`/organizations/${id}/roles`);
    return (response.data.roles ?? []).map((role: any) => ({
      id: role.id,
      name: role.name,
      label: role.label,
      permissions: role.permissions ?? [],
      isSystemDefault: Boolean(role.isSystemDefault),
    }));
  },

  addMember: async (id: string, payload: { userId?: string; email?: string; role?: string; status?: MemberStatus }) => {
    const response = await api.post(`/organizations/${id}/members`, payload);
    return response.data.member;
  },

  updateMember: async (organizationId: string, memberId: string, payload: UpdateMemberInput) => {
    const response = await api.patch(`/organizations/${organizationId}/members/${memberId}`, payload);
    return response.data.member;
  },

  removeMember: async (organizationId: string, memberId: string) => {
    const response = await api.delete(`/organizations/${organizationId}/members/${memberId}`);
    return response.data;
  },

  listContributions: async (organizationId: string): Promise<ContributionRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/contributions`);
    return (response.data.contributions ?? []).map((contribution: any) => ({
      ...contribution,
      amount: Number(contribution.amount ?? 0),
      penalties: Number(contribution.penalties ?? 0),
      allocations: (contribution.allocations ?? []).map((allocation: any) => ({ ...allocation, amount: Number(allocation.amount), monthlyAmount: Number(allocation.monthlyAmount) })),
    }));
  },

  getContributionSummary: async (organizationId: string): Promise<ContributionSummary> => {
    const response = await api.get(`/organizations/${organizationId}/contributions/summary`);
    return {
      total: Number(response.data.total ?? 0),
      paid: Number(response.data.paid ?? 0),
      pending: Number(response.data.pending ?? 0),
      reversed: Number(response.data.reversed ?? 0),
      creditBalance: Number(response.data.creditBalance ?? 0),
    };
  },

  createContribution: async (organizationId: string, payload: { memberId: string; amount: number; contributionType: string; period?: string; paymentMethod: string; reference?: string; status?: ContributionStatus; paidAt?: string }) => {
    const response = await api.post(`/organizations/${organizationId}/contributions`, payload);
    return response.data.contribution as ContributionRecord;
  },

  reverseContribution: async (organizationId: string, contributionId: string, reason: string) => {
    const response = await api.post(`/organizations/${organizationId}/contributions/${contributionId}/reverse`, { reason });
    return response.data.contribution as ContributionRecord;
  },

  recordContributionPayment: async (contributionId: string, payload: { amount: number; paymentMethod: string; paidDate?: string; transactionRef?: string; phoneNumber?: string; mpesaOption?: 'STK_PUSH' | 'PAYBILL' | 'TILL'; paybillNumber?: string; accountNumber?: string; tillNumber?: string; accountReference?: string; transactionDesc?: string }) => {
    const response = await api.post(`/contribution/${contributionId}/payment`, payload);
    return response.data.contribution as ContributionRecord;
  },

  applyForLoan: async (organizationId: string, payload: { memberId?: string; amountRequested: number; purpose?: string; interestRate?: number; repaymentPeriodMonths?: number; guarantors?: string[] }) => {
    const response = await api.post(`/organizations/${organizationId}/loans/apply`, payload);
    return response.data.loan as Loan;
  },

  listLoans: async (organizationId: string): Promise<Loan[]> => {
    const response = await api.get(`/organizations/${organizationId}/loans`);
    return (response.data.loans ?? []).map((loan: any) => ({
      ...loan,
      amountRequested: Number(loan.amountRequested ?? loan.amount ?? 0),
      amountApproved: loan.amountApproved !== undefined && loan.amountApproved !== null ? Number(loan.amountApproved) : null,
      amount: Number(loan.amount ?? loan.amountRequested ?? 0),
      balance: Number(loan.balance ?? 0),
      interestRate: Number(loan.interestRate ?? 0),
      repaymentPeriodMonths: loan.repaymentPeriodMonths !== undefined && loan.repaymentPeriodMonths !== null ? Number(loan.repaymentPeriodMonths) : null,
      guarantorsData: loan.guarantorsData ?? loan.guarantors ?? [],
    }));
  },

  getLoan: async (organizationId: string, loanId: string): Promise<Loan> => {
    const response = await api.get(`/organizations/${organizationId}/loans/${loanId}`);
    const loan = response.data.loan ?? {};
    return {
      ...loan,
      amountRequested: Number(loan.amountRequested ?? loan.amount ?? 0),
      amountApproved: loan.amountApproved !== undefined && loan.amountApproved !== null ? Number(loan.amountApproved) : null,
      amount: Number(loan.amount ?? loan.amountRequested ?? 0),
      balance: Number(loan.balance ?? 0),
      interestRate: Number(loan.interestRate ?? 0),
      repaymentPeriodMonths: loan.repaymentPeriodMonths !== undefined && loan.repaymentPeriodMonths !== null ? Number(loan.repaymentPeriodMonths) : null,
      guarantorsData: loan.guarantorsData ?? loan.guarantors ?? [],
    };
  },

  getLoanSummary: async (organizationId: string): Promise<LoanSummary> => {
    const response = await api.get(`/organizations/${organizationId}/loans/summary`);
    return {
      total: Number(response.data.total ?? 0),
      pending: Number(response.data.pending ?? 0),
      approved: Number(response.data.approved ?? 0),
      active: Number(response.data.active ?? 0),
      paid: Number(response.data.paid ?? 0),
      rejected: Number(response.data.rejected ?? 0),
      outstanding: Number(response.data.outstanding ?? 0),
      requested: Number(response.data.requested ?? 0),
      approvedAmount: Number(response.data.approvedAmount ?? 0),
    };
  },

  approveLoan: async (organizationId: string, loanId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/loans/${loanId}/approve`);
    return response.data.loan as Loan;
  },

  rejectLoan: async (organizationId: string, loanId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/loans/${loanId}/reject`);
    return response.data.loan as Loan;
  },

  disburseLoan: async (organizationId: string, loanId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/loans/${loanId}/disburse`);
    return response.data.loan as Loan;
  },

  acceptLoanGuarantee: async (organizationId: string, loanId: string, guaranteedAmount?: number) => {
    const response = await api.patch(`/organizations/${organizationId}/loans/${loanId}/guarantee/accept`, guaranteedAmount ? { guaranteedAmount } : {});
    return response.data.loan as Loan;
  },

  declineLoanGuarantee: async (organizationId: string, loanId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/loans/${loanId}/guarantee/decline`);
    return response.data.loan as Loan;
  },

  recordLoanRepayment: async (organizationId: string, loanId: string, payload: { amount: number; paymentMethod?: string; reference?: string }) => {
    const response = await api.post(`/organizations/${organizationId}/loans/${loanId}/repay`, payload);
    return response.data.repayment as LoanRepaymentRecord;
  },

  submitWelfareClaim: async (organizationId: string, payload: { claimType: WelfareClaimType | string; reason: string; amountRequested: number; documents?: string[] }) => {
    const response = await api.post(`/organizations/${organizationId}/welfare/claims`, payload);
    return response.data.claim as WelfareClaimRecord;
  },

  listWelfareClaims: async (organizationId: string): Promise<WelfareClaimRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/welfare/claims`);
    return (response.data.claims ?? []).map((claim: any) => ({
      ...claim,
      amountRequested: Number(claim.amountRequested ?? 0),
      amountApproved: claim.amountApproved !== undefined && claim.amountApproved !== null ? Number(claim.amountApproved) : null,
      documents: Array.isArray(claim.documents) ? claim.documents : claim.documents ?? claim.supportingDocuments ?? [],
    }));
  },

  approveWelfareClaim: async (organizationId: string, claimId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/welfare/claims/${claimId}/approve`);
    return response.data.claim as WelfareClaimRecord;
  },

  rejectWelfareClaim: async (organizationId: string, claimId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/welfare/claims/${claimId}/reject`);
    return response.data.claim as WelfareClaimRecord;
  },

  markWelfareClaimPaid: async (organizationId: string, claimId: string) => {
    const response = await api.patch(`/organizations/${organizationId}/welfare/claims/${claimId}/pay`);
    return response.data.claim as WelfareClaimRecord;
  },

  createMeeting: async (organizationId: string, payload: { title: string; dateTime: string; venue?: string; agenda?: string[] }): Promise<MeetingRecord> => {
    const response = await api.post(`/organizations/${organizationId}/meetings`, payload);
    return response.data.meeting as MeetingRecord;
  },

  listMeetings: async (organizationId: string): Promise<MeetingRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/meetings`);
    return (response.data.meetings ?? []).map((meeting: any) => ({
      ...meeting,
      agenda: meeting.agenda ?? [],
      dateTime: meeting.dateTime ?? meeting.scheduledFor ?? meeting.createdAt,
      venue: meeting.venue ?? meeting.location ?? null,
    }));
  },

  getMeeting: async (organizationId: string, meetingId: string): Promise<MeetingRecord> => {
    const response = await api.get(`/organizations/${organizationId}/meetings/${meetingId}`);
    const meeting = response.data.meeting ?? {};
    return {
      ...meeting,
      agenda: meeting.agenda ?? [],
      dateTime: meeting.dateTime ?? meeting.scheduledFor ?? meeting.createdAt,
      venue: meeting.venue ?? meeting.location ?? null,
    };
  },

  updateMeeting: async (organizationId: string, meetingId: string, payload: Partial<{ title: string; dateTime: string; venue?: string; agenda?: string[]; status: MeetingStatus }>) => {
    const response = await api.patch(`/organizations/${organizationId}/meetings/${meetingId}`, payload);
    return response.data.meeting as MeetingRecord;
  },

  recordMeetingAttendance: async (organizationId: string, meetingId: string, payload: { memberId: string; status: AttendanceStatus; notes?: string }) => {
    const response = await api.post(`/organizations/${organizationId}/meetings/${meetingId}/attendance`, payload);
    return response.data.attendance as MeetingAttendanceRecord;
  },

  listMeetingAttendance: async (organizationId: string, meetingId: string): Promise<MeetingAttendanceRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/meetings/${meetingId}/attendance`);
    return (response.data.attendance ?? []).map((attendance: any) => ({
      ...attendance,
    }));
  },

  addMeetingMinutes: async (organizationId: string, meetingId: string, payload: { minutes?: string[]; resolutions?: string[]; actionItems?: string[] }) => {
    const response = await api.post(`/organizations/${organizationId}/meetings/${meetingId}/minutes`, payload);
    return response.data.meeting as MeetingRecord;
  },

  createVote: async (organizationId: string, meetingId: string, payload: { title: string; description: string; options: string[]; closesAt?: string; quorumRequired?: number; isAnonymous?: boolean }): Promise<VoteRecord> => {
    const response = await api.post(`/organizations/${organizationId}/meetings/${meetingId}/votes`, payload);
    return response.data.vote as VoteRecord;
  },

  listVotes: async (organizationId: string, meetingId: string): Promise<VoteRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/meetings/${meetingId}/votes`);
    return (response.data.votes ?? []).map((vote: any) => ({
      ...vote,
    }));
  },

  closeVote: async (organizationId: string, voteId: string): Promise<VoteRecord> => {
    const response = await api.patch(`/organizations/${organizationId}/votes/${voteId}/close`);
    return response.data.vote as VoteRecord;
  },

  submitVote: async (organizationId: string, voteId: string, payload: { selectedOption: string }) => {
    const response = await api.post(`/organizations/${organizationId}/votes/${voteId}/response`, payload);
    return response.data.response as { id: string };
  },

  getVoteResults: async (organizationId: string, voteId: string): Promise<VoteResults> => {
    const response = await api.get(`/organizations/${organizationId}/votes/${voteId}/results`);
    return {
      vote: response.data.vote as VoteRecord,
      results: response.data.results ?? [],
      totalResponses: Number(response.data.totalResponses ?? 0),
    };
  },

  listInvestments: async (organizationId: string): Promise<{ assets: InvestmentAsset[]; positions: InvestmentPosition[]; summary: InvestmentSummary }> => {
    const response = await api.get(`/organizations/${organizationId}/investments`);
    return { assets: response.data.assets ?? [], positions: response.data.positions ?? [], summary: response.data.summary };
  },

  createInvestment: async (organizationId: string, payload: Omit<InvestmentAsset, 'id'>) => {
    const response = await api.post(`/organizations/${organizationId}/investments`, payload);
    return response.data.asset as InvestmentAsset;
  },

  updateInvestment: async (organizationId: string, assetId: string, payload: Partial<InvestmentAsset>) => {
    const response = await api.patch(`/organizations/${organizationId}/investments/${assetId}`, payload);
    return response.data.asset as InvestmentAsset;
  },
  markContributionPaid: async (organizationId: string, contributionId: string, payload: { paymentMethod: 'CASH' | 'MPESA' | 'BANK'; reference?: string; paidAt?: string }) => {
    const response = await api.post(`/organizations/${organizationId}/contributions/${contributionId}/mark-paid`, payload);
    return response.data.contribution as ContributionRecord;
  },

  listAuditLogs: async (organizationId: string): Promise<OrganizationAuditLogRecord[]> => {
    const response = await api.get(`/organizations/${organizationId}/audit-logs`);
    return (response.data.logs ?? []).map((log: any) => ({
      ...log,
      createdAt: log.createdAt,
    }));
  },

};
