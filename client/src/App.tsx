import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/auth/RequireAuth';
import { PublicOnly } from './components/auth/PublicOnly';
import { WorkspaceAccess } from './components/auth/WorkspaceAccess';
import { SessionRestore } from './components/auth/SessionRestore';
import { ROUTES } from './config/routes';
import { AppUpdateGate } from './components/AppUpdateGate';
import { PremiumRoute } from './components/subscription/PremiumRoute';
import { PlatformAccess } from './components/auth/PlatformAccess';

const page = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(async () => ({ default: (await loader())[name] as React.ComponentType }));

const Splash = page(() => import('./features/auth'), 'Splash');
const Login = page(() => import('./features/auth'), 'Login');
const Register = page(() => import('./features/auth'), 'Register');
const ForgotPassword = page(() => import('./features/auth'), 'ForgotPassword');
const OtpVerification = page(() => import('./features/auth'), 'OtpVerification');
const MyChamas = page(() => import('./features/my-chamas'), 'MyChamas');
const DesignSystem = page(() => import('./features/utility'), 'DesignSystem');
const JoinChama = page(() => import('./features/utility'), 'JoinChama');
const JoinInvite = page(() => import('./features/public'), 'JoinInvite');
const JoinOrganizationInvite = page(() => import('./features/public'), 'JoinOrganizationInvite');
const Notifications = page(() => import('./features/notifications'), 'Notifications');
const Profile = page(() => import('./features/profile'), 'Profile');
const Dashboard = page(() => import('./features/dashboard'), 'Dashboard');
const Members = page(() => import('./features/members'), 'Members');
const Contributions = page(() => import('./features/contributions'), 'Contributions');
const Loans = page(() => import('./features/loans'), 'Loans');
const Welfare = page(() => import('./features/welfare'), 'Welfare');
const Approvals = page(() => import('./features/approvals'), 'ApprovalsPage');
const FinancialExceptions = page(() => import('./features/finance'), 'FinancialExceptionsPage');
const Investments = page(() => import('./features/investments'), 'Investments');
const Meetings = page(() => import('./features/meetings'), 'Meetings');
const Reports = page(() => import('./features/reports'), 'Reports');
const Settings = page(() => import('./features/settings'), 'Settings');
const Documents = page(() => import('./features/utility'), 'Documents');
const Voting = page(() => import('./features/voting'), 'Voting');
const AuditLogs = page(() => import('./features/utility'), 'AuditLogs');
const Help = page(() => import('./features/utility'), 'Help');
const MobileTools = page(() => import('./features/utility'), 'MobileTools');
const MpesaAdmin = page(() => import('./features/mpesa'), 'MpesaAdmin');
const AdminDashboard = page(() => import('./features/admin'), 'AdminDashboard');
const AdminRoles = page(() => import('./features/admin'), 'AdminRoles');
const AdminApprovals = page(() => import('./features/admin'), 'AdminApprovals');
const AdminWallet = page(() => import('./features/admin'), 'AdminWallet');
const AdminChamaSettings = page(() => import('./features/admin'), 'AdminChamaSettings');
const AdminAuditLogs = page(() => import('./features/admin'), 'AdminAuditLogs');
const CreateChama = page(() => import('./features/onboarding'), 'CreateChama');
const CreateChamaRoot = CreateChama;
const ChooseTypeStep = page(() => import('./features/onboarding'), 'ChooseTypeStep');
const ChamaDetailsStep = page(() => import('./features/onboarding'), 'ChamaDetailsStep');
const EnableModulesStep = page(() => import('./features/onboarding'), 'EnableModulesStep');
const ContributionRulesStep = page(() => import('./features/onboarding'), 'ContributionRulesStep');
const LoanRulesStep = page(() => import('./features/onboarding'), 'LoanRulesStep');
const WelfareRulesStep = page(() => import('./features/onboarding'), 'WelfareRulesStep');
const CommitteeStep = page(() => import('./features/onboarding'), 'CommitteeStep');
const InviteMembersStep = page(() => import('./features/onboarding'), 'InviteMembersStep');
const ReviewSetupStep = page(() => import('./features/onboarding'), 'ReviewSetupStep');
const Upgrade = page(() => import('./features/utility'), 'Upgrade');
const PlatformSubscriptions = page(() => import('./features/utility'), 'PlatformSubscriptions');
const Legal = page(() => import('./features/public'), 'Legal');
const DownloadApp = page(() => import('./features/public'), 'DownloadApp');

const RouteLoading = () => (
  <div className="flex min-h-[45vh] items-center justify-center p-8" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-5 py-4 shadow-[var(--ds-shadow-card)]">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ds-primary)] border-t-transparent" />
      <span className="font-semibold text-[var(--ds-secondary)]">Loading workspace…</span>
    </div>
  </div>
);

function App() {
  return (
    <AppUpdateGate>
      <HashRouter>
        <SessionRestore>
          <Suspense fallback={<RouteLoading />}>
          <Routes>
          <Route path="/" element={<Navigate to={ROUTES.auth.splash} replace />} />
          <Route path={ROUTES.legal.centre} element={<Legal />} />
          <Route path={ROUTES.legal.download} element={<DownloadApp />} />
          <Route path="/join/:shareableLink" element={<JoinInvite />} />
          <Route path="/org-invite/:token" element={<JoinOrganizationInvite />} />
          <Route element={<PublicOnly />}>
            <Route path={ROUTES.auth.splash} element={<Splash />} />
            <Route path={ROUTES.auth.login} element={<Login />} />
            <Route path={ROUTES.auth.register} element={<Register />} />
            <Route path={ROUTES.auth.forgotPassword} element={<ForgotPassword />} />
            <Route path={ROUTES.auth.otpVerification} element={<OtpVerification />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path={ROUTES.app.home} element={<Dashboard />} />
              <Route path={ROUTES.app.myChamas} element={<MyChamas />} />
              {import.meta.env.DEV ? <Route path={ROUTES.app.designSystem} element={<DesignSystem />} /> : null}
              <Route path={ROUTES.app.joinChama} element={<JoinChama />} />
              <Route path={ROUTES.app.mobile} element={<MobileTools />} />
              <Route path={ROUTES.app.notifications} element={<Notifications />} />
              <Route path={ROUTES.app.profile} element={<Profile />} />
              <Route path={ROUTES.app.upgrade} element={<Upgrade />} />
              <Route element={<PlatformAccess />}>
                <Route path={ROUTES.platform.home} element={<PlatformSubscriptions />} />
                <Route path={ROUTES.platform.subscriptions} element={<PlatformSubscriptions />} />
              </Route>

              <Route path={ROUTES.app.createChama} element={<CreateChama />}>
                <Route index element={<CreateChamaRoot />} />
                <Route path="type" element={<ChooseTypeStep />} />
                <Route path="details" element={<ChamaDetailsStep />} />
                <Route path="modules" element={<EnableModulesStep />} />
                <Route path="contributions" element={<ContributionRulesStep />} />
                <Route path="loans" element={<LoanRulesStep />} />
                <Route path="welfare" element={<WelfareRulesStep />} />
                <Route path="committee" element={<CommitteeStep />} />
                <Route path="invite" element={<InviteMembersStep />} />
                <Route path="review" element={<ReviewSetupStep />} />
              </Route>

              <Route path="/chamas/:organizationId">
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="members" element={<Members />} />
                <Route path="contributions" element={<Contributions />} />
                <Route path="loans" element={<WorkspaceAccess module="loans" label="Loans"><Loans /></WorkspaceAccess>} />
                <Route path="loans/:loanId" element={<WorkspaceAccess module="loans" label="Loans"><Loans /></WorkspaceAccess>} />
                <Route path="welfare" element={<WorkspaceAccess module="welfare" label="Welfare"><Welfare /></WorkspaceAccess>} />
                <Route path="approvals" element={<WorkspaceAccess roles={['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN']} label="Approvals"><Approvals /></WorkspaceAccess>} />
                <Route path="approvals/:kind" element={<WorkspaceAccess roles={['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN']} label="Approvals"><Approvals /></WorkspaceAccess>} />
                <Route path="approvals/:kind/:itemId" element={<WorkspaceAccess roles={['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN']} label="Approvals"><Approvals /></WorkspaceAccess>} />
                 <Route path="financial-exceptions" element={<WorkspaceAccess roles={['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN']} label="Financial Exceptions"><FinancialExceptions /></WorkspaceAccess>} />
                <Route path="investments" element={<WorkspaceAccess module="investments" label="Investments"><PremiumRoute feature="INVESTMENT_AUTOMATION"><Investments /></PremiumRoute></WorkspaceAccess>} />
                <Route path="meetings" element={<WorkspaceAccess module="meetings" label="Meetings"><Meetings /></WorkspaceAccess>} />
                <Route path="meetings/:meetingId" element={<WorkspaceAccess module="meetings" label="Meetings"><Meetings /></WorkspaceAccess>} />
                <Route path="voting" element={<WorkspaceAccess module="voting" label="Voting"><PremiumRoute feature="VOTING"><Voting /></PremiumRoute></WorkspaceAccess>} />
                <Route path="voting/:voteId" element={<WorkspaceAccess module="voting" label="Voting"><PremiumRoute feature="VOTING"><Voting /></PremiumRoute></WorkspaceAccess>} />
                <Route path="reports" element={<WorkspaceAccess module="reports" label="Reports"><Reports /></WorkspaceAccess>} />
                <Route path="documents" element={<WorkspaceAccess module="documents" label="Documents"><PremiumRoute feature="DOCUMENTS"><Documents /></PremiumRoute></WorkspaceAccess>} />
                <Route path="settings" element={<WorkspaceAccess roles={['OWNER', 'FOUNDER', 'ADMIN']} label="Chama Settings"><Settings /></WorkspaceAccess>} />
              </Route>

              <Route path="/meetings" element={<Meetings />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/documents" element={<PremiumRoute feature="DOCUMENTS"><Documents /></PremiumRoute>} />
              <Route path="/voting" element={<PremiumRoute feature="VOTING"><Voting /></PremiumRoute>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/audit-logs" element={<PremiumRoute feature="AUDIT_LOGS"><AuditLogs /></PremiumRoute>} />
              <Route path={ROUTES.admin.home} element={<PremiumRoute feature="ADMIN_CONTROLS"><AdminDashboard /></PremiumRoute>} />
              <Route path={ROUTES.admin.roles} element={<PremiumRoute feature="ADMIN_CONTROLS"><AdminRoles /></PremiumRoute>} />
              <Route path={ROUTES.admin.approvals} element={<PremiumRoute feature="ADMIN_CONTROLS"><AdminApprovals /></PremiumRoute>} />
              <Route path={ROUTES.admin.wallet} element={<PremiumRoute feature="ADMIN_CONTROLS"><AdminWallet /></PremiumRoute>} />
              <Route path={ROUTES.admin.chamaSettings} element={<PremiumRoute feature="ADMIN_CONTROLS"><AdminChamaSettings /></PremiumRoute>} />
              <Route path={ROUTES.admin.auditLogs} element={<PremiumRoute feature="AUDIT_LOGS"><AdminAuditLogs /></PremiumRoute>} />
              <Route path={ROUTES.admin.mpesa} element={<PremiumRoute feature="MPESA_AUTOMATION"><MpesaAdmin /></PremiumRoute>} />
              <Route path="/help" element={<Help />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={ROUTES.auth.splash} replace />} />
          </Routes>
          </Suspense>
        </SessionRestore>
      </HashRouter>
    </AppUpdateGate>
  );
}

export default App;
