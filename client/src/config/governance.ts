export type GovernanceRoleId =
  | 'OWNER'
  | 'CHAIRPERSON'
  | 'VICE_CHAIRPERSON'
  | 'SECRETARY'
  | 'TREASURER'
  | 'AUDITOR'
  | 'COMMITTEE_MEMBER'
  | 'MEMBER'
  | 'GUEST'
  | 'APPLICANT';

export type GovernancePermissionId =
  | 'VIEW_CHAMA_DASHBOARD'
  | 'VIEW_OWN_STATEMENT'
  | 'VIEW_MEMBER_LIST'
  | 'VIEW_MEMBER_BALANCES'
  | 'CREATE_CHAMA'
  | 'EDIT_CHAMA_SETTINGS'
  | 'APPROVE_NEW_MEMBERS'
  | 'APPROVE_LOANS'
  | 'APPROVE_WELFARE_CLAIMS'
  | 'RECORD_CONTRIBUTIONS'
  | 'APPROVE_PAYMENTS'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'MANAGE_WALLET'
  | 'EXPORT_STATEMENTS'
  | 'CREATE_MEETINGS'
  | 'RECORD_MINUTES'
  | 'SEND_ANNOUNCEMENTS'
  | 'MANAGE_ATTENDANCE'
  | 'SUBMIT_LOAN_APPLICATION'
  | 'SUBMIT_WELFARE_CLAIM'
  | 'PAY_CONTRIBUTIONS'
  | 'VIEW_ANNOUNCEMENTS'
  | 'VIEW_AUDIT_LOGS'
  | 'MANAGE_ROLES'
  | 'INVITE_MEMBERS'
  | 'VIEW_REPORTS'
  | 'DELETE_PAYMENTS';

export interface GovernanceRoleDefinition {
  id: GovernanceRoleId;
  title: string;
  description: string;
  permissions: GovernancePermissionId[];
  canApproveWelfare?: boolean;
  canDeletePayments?: boolean;
  canViewOtherBalances?: boolean;
}

export interface GovernancePermissionDefinition {
  id: GovernancePermissionId;
  title: string;
  description: string;
}

export const GOVERNANCE_PERMISSIONS: GovernancePermissionDefinition[] = [
  { id: 'VIEW_CHAMA_DASHBOARD', title: 'View Chama dashboard', description: 'Open the main dashboard for a Chama.' },
  { id: 'VIEW_OWN_STATEMENT', title: 'View own statement', description: 'See personal balances and contribution history.' },
  { id: 'VIEW_MEMBER_LIST', title: 'View member list', description: 'See the list of members in the group.' },
  { id: 'VIEW_MEMBER_BALANCES', title: 'View member balances', description: 'See balances and contribution standing for other members.' },
  { id: 'CREATE_CHAMA', title: 'Create Chama', description: 'Start a new Chama or organization.' },
  { id: 'EDIT_CHAMA_SETTINGS', title: 'Edit Chama settings', description: 'Change group rules, modules, and configuration.' },
  { id: 'APPROVE_NEW_MEMBERS', title: 'Approve new members', description: 'Accept or reject applicants and invitees.' },
  { id: 'APPROVE_LOANS', title: 'Approve loans', description: 'Review and approve loan applications.' },
  { id: 'APPROVE_WELFARE_CLAIMS', title: 'Approve welfare claims', description: 'Authorize welfare assistance requests.' },
  { id: 'RECORD_CONTRIBUTIONS', title: 'Record contributions', description: 'Post member payments and savings entries.' },
  { id: 'APPROVE_PAYMENTS', title: 'Approve payments', description: 'Confirm and release payments or payouts.' },
  { id: 'VIEW_FINANCIAL_REPORTS', title: 'View financial reports', description: 'Open cashbooks, statements, and summaries.' },
  { id: 'MANAGE_WALLET', title: 'Manage wallet', description: 'Control the group wallet and payment sources.' },
  { id: 'EXPORT_STATEMENTS', title: 'Export statements', description: 'Download member statements and reports.' },
  { id: 'CREATE_MEETINGS', title: 'Create meetings', description: 'Schedule meetings and publish agendas.' },
  { id: 'RECORD_MINUTES', title: 'Record minutes', description: 'Capture meeting notes and resolutions.' },
  { id: 'SEND_ANNOUNCEMENTS', title: 'Send announcements', description: 'Broadcast notices to the group.' },
  { id: 'MANAGE_ATTENDANCE', title: 'Manage attendance', description: 'Mark attendance and absences.' },
  { id: 'SUBMIT_LOAN_APPLICATION', title: 'Submit loan application', description: 'Request a loan from the group.' },
  { id: 'SUBMIT_WELFARE_CLAIM', title: 'Submit welfare claim', description: 'Request welfare support or emergency help.' },
  { id: 'PAY_CONTRIBUTIONS', title: 'Pay contributions', description: 'Submit regular contribution payments.' },
  { id: 'VIEW_ANNOUNCEMENTS', title: 'View announcements', description: 'Read notices shared by leaders.' },
  { id: 'VIEW_AUDIT_LOGS', title: 'View audit logs', description: 'Inspect tracked system activity.' },
  { id: 'MANAGE_ROLES', title: 'Manage roles', description: 'Assign and edit governance roles.' },
  { id: 'INVITE_MEMBERS', title: 'Invite members', description: 'Send invites to join the group.' },
  { id: 'VIEW_REPORTS', title: 'View reports', description: 'Open dashboard and module reports.' },
  { id: 'DELETE_PAYMENTS', title: 'Delete payments', description: 'Remove a recorded payment entry.' },
];

export const GOVERNANCE_ROLES: GovernanceRoleDefinition[] = [
  {
    id: 'OWNER',
    title: 'Owner / Founder',
    description: 'Creates the Chama, controls setup, and has full administrative access.',
    permissions: GOVERNANCE_PERMISSIONS.map((permission) => permission.id),
    canApproveWelfare: true,
    canDeletePayments: true,
    canViewOtherBalances: true,
  },
  {
    id: 'CHAIRPERSON',
    title: 'Chairperson',
    description: 'Leads approvals, governance, and committee oversight.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'VIEW_MEMBER_BALANCES',
      'APPROVE_NEW_MEMBERS',
      'APPROVE_LOANS',
      'APPROVE_WELFARE_CLAIMS',
      'CREATE_MEETINGS',
      'RECORD_MINUTES',
      'SEND_ANNOUNCEMENTS',
      'MANAGE_ATTENDANCE',
      'VIEW_FINANCIAL_REPORTS',
      'VIEW_REPORTS',
      'INVITE_MEMBERS',
    ],
    canApproveWelfare: true,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'VICE_CHAIRPERSON',
    title: 'Vice Chairperson',
    description: 'Supports the chairperson and acts in their place when needed.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'VIEW_MEMBER_BALANCES',
      'APPROVE_NEW_MEMBERS',
      'APPROVE_LOANS',
      'APPROVE_WELFARE_CLAIMS',
      'CREATE_MEETINGS',
      'SEND_ANNOUNCEMENTS',
      'MANAGE_ATTENDANCE',
      'VIEW_REPORTS',
    ],
    canApproveWelfare: true,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'SECRETARY',
    title: 'Secretary',
    description: 'Handles meetings, records, notices, and attendance.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'CREATE_MEETINGS',
      'RECORD_MINUTES',
      'SEND_ANNOUNCEMENTS',
      'MANAGE_ATTENDANCE',
      'INVITE_MEMBERS',
      'VIEW_REPORTS',
    ],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'TREASURER',
    title: 'Treasurer',
    description: 'Manages money, records contributions, and prepares financial reports.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'VIEW_MEMBER_BALANCES',
      'RECORD_CONTRIBUTIONS',
      'APPROVE_PAYMENTS',
      'VIEW_FINANCIAL_REPORTS',
      'MANAGE_WALLET',
      'EXPORT_STATEMENTS',
      'VIEW_REPORTS',
    ],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'AUDITOR',
    title: 'Auditor',
    description: 'Reviews records and validates accountability without operational control.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'VIEW_MEMBER_BALANCES',
      'VIEW_FINANCIAL_REPORTS',
      'VIEW_AUDIT_LOGS',
      'EXPORT_STATEMENTS',
      'VIEW_REPORTS',
    ],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'COMMITTEE_MEMBER',
    title: 'Committee Member',
    description: 'Supports governance, reviews cases, and votes on key actions.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'VIEW_MEMBER_LIST',
      'VIEW_MEMBER_BALANCES',
      'APPROVE_NEW_MEMBERS',
      'APPROVE_LOANS',
      'APPROVE_WELFARE_CLAIMS',
      'CREATE_MEETINGS',
      'SEND_ANNOUNCEMENTS',
      'VIEW_REPORTS',
    ],
    canApproveWelfare: true,
    canDeletePayments: false,
    canViewOtherBalances: true,
  },
  {
    id: 'MEMBER',
    title: 'Member',
    description: 'Participates in contributions, loans, welfare, and meetings.',
    permissions: [
      'VIEW_CHAMA_DASHBOARD',
      'VIEW_OWN_STATEMENT',
      'SUBMIT_LOAN_APPLICATION',
      'SUBMIT_WELFARE_CLAIM',
      'PAY_CONTRIBUTIONS',
      'VIEW_ANNOUNCEMENTS',
    ],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: false,
  },
  {
    id: 'GUEST',
    title: 'Guest',
    description: 'Can observe limited public information without internal access.',
    permissions: ['VIEW_CHAMA_DASHBOARD', 'VIEW_ANNOUNCEMENTS'],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: false,
  },
  {
    id: 'APPLICANT',
    title: 'Guest / Applicant',
    description: 'Has submitted an application and is waiting for approval.',
    permissions: ['VIEW_CHAMA_DASHBOARD', 'VIEW_ANNOUNCEMENTS'],
    canApproveWelfare: false,
    canDeletePayments: false,
    canViewOtherBalances: false,
  },
];

export const GOVERNANCE_ROLE_LOOKUP = GOVERNANCE_ROLES.reduce((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {} as Record<GovernanceRoleId, GovernanceRoleDefinition>);

export const GOVERNANCE_PERMISSION_LOOKUP = GOVERNANCE_PERMISSIONS.reduce((acc, permission) => {
  acc[permission.id] = permission;
  return acc;
}, {} as Record<GovernancePermissionId, GovernancePermissionDefinition>);
