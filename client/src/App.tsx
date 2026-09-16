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

const page = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(async () => ({ default: (await loader())[name] as React.ComponentType }));

const Splash = page(() => import('./pages/Splash'), 'Splash');
const Login = page(() => import('./pages/Login'), 'Login');
const Register = page(() => import('./pages/Register'), 'Register');
const ForgotPassword = page(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const OtpVerification = page(() => import('./pages/OtpVerification'), 'OtpVerification');
const MyChamas = page(() => import('./pages/MyChamas'), 'MyChamas');
const DesignSystem = page(() => import('./pages/DesignSystem'), 'DesignSystem');
const JoinChama = page(() => import('./pages/JoinChama'), 'JoinChama');
const JoinInvite = page(() => import('./pages/JoinInvite'), 'JoinInvite');
const JoinOrganizationInvite = page(() => import('./pages/JoinOrganizationInvite'), 'JoinOrganizationInvite');
const Notifications = page(() => import('./pages/Notifications'), 'Notifications');
const Profile = page(() => import('./pages/Profile'), 'Profile');
const Dashboard = page(() => import('./pages/Dashboard'), 'Dashboard');
const Members = page(() => import('./pages/Members'), 'Members');
const Contributions = page(() => import('./pages/Contributions'), 'Contributions');
const Loans = page(() => import('./pages/Loans'), 'Loans');
const Welfare = page(() => import('./pages/Welfare'), 'Welfare');
const Investments = page(() => import('./pages/Investments'), 'Investments');
const Meetings = page(() => import('./pages/Meetings'), 'Meetings');
const Reports = page(() => import('./pages/Reports'), 'Reports');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const Documents = page(() => import('./pages/Documents'), 'Documents');
const Voting = page(() => import('./pages/Voting'), 'Voting');
const AuditLogs = page(() => import('./pages/AuditLogs'), 'AuditLogs');
const Help = page(() => import('./pages/Help'), 'Help');
const MobileTools = page(() => import('./pages/MobileTools'), 'MobileTools');
const MpesaAdmin = page(() => import('./pages/MpesaAdmin'), 'MpesaAdmin');
const AdminDashboard = page(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const AdminRoles = page(() => import('./pages/AdminRoles'), 'AdminRoles');
const AdminApprovals = page(() => import('./pages/AdminApprovals'), 'AdminApprovals');
const AdminWallet = page(() => import('./pages/AdminWallet'), 'AdminWallet');
const AdminChamaSettings = page(() => import('./pages/AdminChamaSettings'), 'AdminChamaSettings');
const AdminAuditLogs = page(() => import('./pages/AdminAuditLogs'), 'AdminAuditLogs');
const CreateChama = page(() => import('./pages/CreateChama'), 'CreateChama');
const CreateChamaRoot = page(() => import('./pages/CreateChama'), 'CreateChamaRoot');
const ChooseTypeStep = page(() => import('./pages/ChooseTypeStep'), 'ChooseTypeStep');
const ChamaDetailsStep = page(() => import('./pages/ChamaDetailsStep'), 'ChamaDetailsStep');
const EnableModulesStep = page(() => import('./pages/EnableModulesStep'), 'EnableModulesStep');
const ContributionRulesStep = page(() => import('./pages/ContributionRulesStep'), 'ContributionRulesStep');
const LoanRulesStep = page(() => import('./pages/LoanRulesStep'), 'LoanRulesStep');
const WelfareRulesStep = page(() => import('./pages/WelfareRulesStep'), 'WelfareRulesStep');
const CommitteeStep = page(() => import('./pages/CommitteeStep'), 'CommitteeStep');
const InviteMembersStep = page(() => import('./pages/InviteMembersStep'), 'InviteMembersStep');
const ReviewSetupStep = page(() => import('./pages/ReviewSetupStep'), 'ReviewSetupStep');
const Upgrade = page(() => import('./pages/Upgrade'), 'Upgrade');
const PlatformSubscriptions = page(() => import('./pages/PlatformSubscriptions'), 'PlatformSubscriptions');
const Legal = page(() => import('./pages/Legal'), 'Legal');
const DownloadApp = page(() => import('./pages/DownloadApp'), 'DownloadApp');

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
              <Route path={ROUTES.platform.subscriptions} element={<PlatformSubscriptions />} />

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
