export type ChamaType =
  | 'SAVINGS'
  | 'MERRY_GO_ROUND'
  | 'ROSCA'
  | 'INVESTMENT'
  | 'WELFARE'
  | 'BUSINESS'
  | 'HOUSING'
  | 'FAMILY'
  | 'CHURCH'
  | 'YOUTH'
  | 'STAFF'
  | 'FARMERS'
  | 'WOMEN'
  | 'MEN'
  | 'COMMUNITY'
  | 'HYBRID'
  | 'ASCA'
  | 'NORMAL';

export type ChamaModuleKey =
  | 'SAVINGS'
  | 'CONTRIBUTIONS'
  | 'LOANS'
  | 'SHARES'
  | 'INVESTMENTS'
  | 'WELFARE'
  | 'MEETINGS'
  | 'VOTING'
  | 'FINES'
  | 'ASSET_REGISTER'
  | 'PROJECTS'
  | 'MPESA'
  | 'REPORTS'
  | 'DOCUMENTS';
export type ChamaVisibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
export type ChamaStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';
export type MemberRole = 'FOUNDER' | 'CHAIR' | 'TREASURER' | 'SECRETARY' | 'AUDITOR' | 'MEMBER';
export type MemberStatus = 'INVITATION_SENT' | 'PENDING_APPROVAL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXITED' | 'ARCHIVED';
export type ContributionStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL' | 'REVERSED';
export type PaymentMethod = 'MPESA' | 'BANK' | 'CASH';
export type LoanStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'DEFAULTED' | 'PAID';
export type CommunityGroupKind =
  | 'CHAMA'
  | 'WELFARE'
  | 'SACCO'
  | 'INVESTMENT_CLUB'
  | 'FAMILY_GROUP'
  | 'CHURCH_GROUP'
  | 'YOUTH_GROUP'
  | 'STAFF_WELFARE'
  | 'ESTATE_ASSOCIATION';

export type OrganizationType = CommunityGroupKind;

export interface Organization {
  id: string;
  name: string;
  organizationType: OrganizationType;
  slug: string;
  description?: string;
  status: ChamaStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  chamaType?: string | null;
  enabledModules?: Record<string, boolean> | null;
  metadata?: Record<string, any> | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  organization: Organization;
  role: MemberRole;
  status: MemberStatus;
  user?: User;
  joinedAt: string;
  reliabilityScore: number;
}

export interface OrganizationWallet {
  id: string;
  organizationId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  contributionRules?: Record<string, any>;
  welfareRules?: Record<string, any>;
  loanRules?: Record<string, any>;
  notificationRules?: Record<string, any>;
  securityRules?: Record<string, any>;
}

export interface OrganizationCommittee {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface OrganizationBranch {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  location?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface OrganizationAuditLog {
  id: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  createdAt: string;
}

export interface ChamaPaymentSettings {
  mode: 'MPESA_NUMBER' | 'PAYBILL';
  mpesaNumber?: string;
  paybillNumber?: string;
  accountNumber?: string;
  accountReference?: string;
  transactionDesc?: string;
  isEnabled?: boolean;
}

export interface ChamaEnabledModules {
  savings: boolean;
  contributions: boolean;
  loans: boolean;
  welfare: boolean;
  investments: boolean;
  meetings: boolean;
  voting: boolean;
  fines: boolean;
  reports: boolean;
  documents: boolean;
  mpesa: boolean;
}

export interface ContributionRulesDraft {
  amount: number;
  frequency: 'WEEKLY' | 'MONTHLY';
  gracePeriodDays: number;
  lateFeeAmount: number;
  allowPartialPayments: boolean;
  collectionDay: number;
}

export interface LoanRulesDraft {
  enabled: boolean;
  maxLoanAmount: number;
  interestRate: number;
  repaymentMonths: number;
  guarantorsRequired: number;
  maxActiveLoans: number;
}

export interface WelfareRulesDraft {
  enabled: boolean;
  monthlyContribution?: number;
  maxClaimAmount: number;
  waitingPeriodDays?: number;
  approvalMode?: 'COMMITTEE' | 'CHAIR_TREASURER' | 'MEMBER_VOTE' | 'AUTO';
  allowPartialApproval?: boolean;
  requireDocuments?: boolean;
  reminderDay?: number;
  approvalThreshold: number;
  categories: Array<string | { key: string; label: string; enabled: boolean; limit: number; documents: string[] }>;
}

export interface CommitteeRoleDraft {
  title: string;
  description: string;
  permissions: string[];
}

export interface InviteMemberDraft {
  email: string;
  name?: string;
  role?: string;
}

export interface ChamaSettings {
  enabledModules?: ChamaEnabledModules;
  paymentSettings?: ChamaPaymentSettings;
  contributionRules?: ContributionRulesDraft;
  loanRules?: LoanRulesDraft;
  welfareRules?: WelfareRulesDraft;
  committeeRoles?: CommitteeRoleDraft[];
  inviteMembers?: InviteMemberDraft[];
  roscaSettings?: Record<string, any>;
  ascaSettings?: Record<string, any>;
  normalSettings?: Record<string, any>;
  governanceRules?: Record<string, any>;
  penaltyRules?: Record<string, any>;
  organizationKind?: string;
  organizationLabel?: string;
  [key: string]: any;
}
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  nationalId?: string;
  mfaEnabled?: boolean;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  platformRole?: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | null;
}

export interface Chama {
  id: string;
  name: string;
  type: ChamaType;
  description: string;
  maxMembers: number;
  currentMembers: number;
  contributionAmount: number;
  contributionFrequency: 'WEEKLY' | 'MONTHLY';
  currency: string;
  visibility: ChamaVisibility;
  shareableLink: string;
  qrCode: string;
  status: ChamaStatus;
  createdAt: string;
  settings?: ChamaSettings;
  memberships?: Array<{
    userId: string;
    role: MemberRole;
    status: MemberStatus;
  }>;
}

export interface ChamaMembership {
  chamaId: string;
  chama: Chama;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  reliabilityScore: number;
}

export interface Contribution {
  id: string;
  chamaId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: ContributionStatus;
  paymentMethod?: PaymentMethod;
  penalties: number;
}

export interface PendingPaymentRequest {
  id: string;
  contributionId: string;
  chamaId: string;
  amount: number;
  paymentMethod: PaymentMethod | string;
  transactionRef?: string;
  submittedBy: string;
  submittedAt: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface LoanRepaymentRecord {
  id: string;
  organizationId: string;
  loanId: string;
  memberId: string;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  recordedById?: string | null;
  paidAt?: string | null;
  repaidAt?: string | null;
  createdAt?: string;
  recordedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface Loan {
  id: string;
  organizationId?: string;
  chamaId?: string;
  memberId?: string | null;
  borrowerId?: string;
  amountRequested: number;
  amountApproved?: number | null;
  amount: number;
  purpose?: string | null;
  interestRate: number;
  repaymentPeriodMonths?: number | null;
  guarantorsData?: string[] | Record<string, any> | null;
  status: LoanStatus;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  disbursedAt?: string | null;
  dueDate?: string | null;
  balance: number;
  riskScore?: number;
  createdAt?: string;
  updatedAt?: string;
  borrower?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
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
  guarantors?: Array<{
    id: string;
    memberId: string;
    guaranteedAmount: number;
    status?: string;
    member?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }>;
  repayments?: LoanRepaymentRecord[];
}

export interface LoanSummary {
  total: number;
  pending: number;
  approved: number;
  active: number;
  paid: number;
  rejected: number;
  outstanding: number;
  requested: number;
  approvedAmount: number;
}

export type MeetingStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'APOLOGY' | 'LATE' | 'EXCUSED';
export type VoteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface MeetingAttendanceRecord {
  id: string;
  organizationId: string;
  meetingId: string;
  memberId: string;
  status: AttendanceStatus;
  notes?: string | null;
  recordedById?: string | null;
  recordedAt?: string;
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
}

export interface MeetingRecord {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  dateTime: string;
  venue?: string | null;
  agenda?: string[] | null;
  minutes?: { minutes?: string[]; resolutions?: string[]; actionItems?: string[] } | null;
  status: MeetingStatus;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  attendance?: MeetingAttendanceRecord[];
  votes?: VoteRecord[];
}

export interface VoteOptionRecord {
  id: string;
  voteId: string;
  text: string;
  weight?: number;
}

export interface VoteResponseRecord {
  id: string;
  organizationId: string;
  voteId: string;
  memberId: string;
  selectedOption: string;
  votedAt?: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface VoteRecord {
  id: string;
  organizationId?: string | null;
  meetingId?: string | null;
  createdById?: string | null;
  closedById?: string | null;
  title: string;
  description: string;
  type?: string;
  quorumRequired?: number;
  startDate?: string;
  endDate?: string;
  closesAt?: string | null;
  status: VoteStatus;
  isAnonymous?: boolean;
  autoExecute?: boolean;
  createdAt?: string;
  updatedAt?: string;
  options?: VoteOptionRecord[];
  responses?: VoteResponseRecord[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  closedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface VoteResultRow {
  option: string;
  votes: number;
}

export interface VoteResults {
  vote: VoteRecord;
  results: VoteResultRow[];
  totalResponses: number;
}

export interface DashboardStats {
  totalChamas: number;
  totalContributions: number;
  totalLoans: number;
  upcomingPayments: number;
  reliabilityScore: number;
}

export interface OrganizationTemplate {
  kind: OrganizationType;
  title: string;
  description: string;
}
