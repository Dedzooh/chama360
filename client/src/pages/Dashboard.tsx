import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowRight,
  Archive,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Heart,
  Megaphone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import { PLATFORM_NAME } from '../config/platform';
import { getChamaStatusDescription, getChamaStatusLabel, getChamaStatusTone, isReadonlyChama, isTerminalChama } from '../utils/chamaLifecycle';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService, type ContributionRecord, type WelfareClaimRecord } from '../services/organizationService';
import type { Loan, MeetingRecord } from '../types';
import { buildSmartInsights } from '../utils/smartInsights';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useAuthStore } from '../store/authStore';
import { Button, Card, ChartCard, EmptyState, MetricCard, QuickAction, SparklineChart, Timeline } from '../design-system';

const formatMoney = (value?: number | string | null, currency = 'KES') => `${currency} ${Number(value ?? 0).toLocaleString()}`;
const formatDateLabel = (value?: string | null) => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatTimeLabel = (value?: string | null) => {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const roleAccess: Record<string, { label: string; responsibility: string; access: string[] }> = {
  OWNER: { label: 'Owner', responsibility: 'Full Chama administration and accountability.', access: ['Personal member portal', 'Members and roles', 'All finance and investments', 'Settings and subscription'] },
  FOUNDER: { label: 'Founder', responsibility: 'Full Chama administration and accountability.', access: ['Personal member portal', 'Members and roles', 'All finance and investments', 'Settings and subscription'] },
  ADMIN: { label: 'Administrator', responsibility: 'Full delegated Chama administration.', access: ['Personal member portal', 'Members and roles', 'All finance and investments', 'Settings and subscription'] },
  CHAIR: { label: 'Chairperson', responsibility: 'Lead governance, approvals, and member decisions.', access: ['Personal member portal', 'Meetings and voting', 'Shared portfolio overview', 'Reports without bookkeeping controls'] },
  TREASURER: { label: 'Treasurer', responsibility: 'Maintain accurate financial and investment records.', access: ['Personal member portal', 'All contribution records', 'M-Pesa and reconciliation', 'Investment valuations and reports'] },
  SECRETARY: { label: 'Secretary', responsibility: 'Maintain meetings, attendance, minutes, and communication.', access: ['Personal member portal', 'Member communication contacts', 'Meetings and attendance', 'Minutes and documents'] },
  AUDITOR: { label: 'Auditor', responsibility: 'Independently review finance records without changing them.', access: ['Personal member portal', 'Read-only financial register', 'All investment positions', 'Reports and audit trail'] },
  MEMBER: { label: 'Member', responsibility: 'Contribute, participate, and monitor your personal position.', access: ['Personal contributions and penalties', 'Advance-covered months', 'Personal investment position', 'Meetings, notices, and voting'] },
};

const LoadingStat = () => (
  <Card className="p-5">
    <div className="loading-line w-20" />
    <div className="mt-3 loading-line w-32" />
  </Card>
);

export const Dashboard = () => {
  const compactLayout = useCompactLayout();
  const { organizationId } = useParams();
  const { organizations, currentOrganization, loading, error } = useOrganizationWorkspace();
  const userFirstName = useAuthStore((state) => state.user?.firstName ?? 'there');
  const userId = useAuthStore((state) => state.user?.id);
  const [recentActivity, setRecentActivity] = useState<Array<{ title: string; detail: string; time: string }>>([]);
  const [upcomingMeeting, setUpcomingMeeting] = useState<string | null>(null);
  const [upcomingMeetingRecord, setUpcomingMeetingRecord] = useState<MeetingRecord | null>(null);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [myRecordsAvailable, setMyRecordsAvailable] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [claims, setClaims] = useState<WelfareClaimRecord[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const organization = currentOrganization;
  const isWorkspace = Boolean(organizationId);
  const memberCount = organization?.members?.length ?? 0;
  const enabledModuleCount = Object.values(organization?.enabledModules ?? {}).filter(Boolean).length;
  const readonly = isReadonlyChama(organization?.status);
  const terminal = isTerminalChama(organization?.status);
  const walletBalance = organization?.wallet?.balance ?? organization?.balance ?? 0;
  const currency = organization?.wallet?.currency ?? 'KES';
  const currentRoleName = (organization?.myRole ?? 'MEMBER').toUpperCase();
  const currentRoleAccess = roleAccess[currentRoleName] ?? roleAccess.MEMBER;
  const canRecordContributions = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'].includes(currentRoleName);

  useEffect(() => {
    let active = true;

    const loadWorkspaceSignals = async () => {
      if (!organization?.id) {
        setRecentActivity([]);
        setUpcomingMeeting(null);
        setUpcomingMeetingRecord(null);
        setContributions([]);
        setMyRecordsAvailable(false);
        setLoans([]);
        setClaims([]);
        setMeetings([]);
        return;
      }

      setMyRecordsAvailable(false);

      try {
        const [logRecords, meetingRecords, contributionRecords, loanRecords, claimRecords] = await Promise.all([
          organizationService.listAuditLogs(organization.id).catch(() => []),
          organizationService.listMeetings(organization.id).catch(() => []),
          organizationService.listContributions(organization.id).catch(() => null),
          organizationService.listLoans(organization.id).catch(() => []),
          organizationService.listWelfareClaims(organization.id).catch(() => []),
        ]);

        if (!active) return;

        setRecentActivity(
          logRecords.slice(0, 4).map((log) => ({
            title: log.action.replace(/_/g, ' '),
            detail: `${log.entityType} ${log.entityId.slice(0, 8)}`,
            time: log.createdAt ?? '',
          })),
        );
        setMeetings(meetingRecords);
        setContributions(contributionRecords ?? []);
        setMyRecordsAvailable(contributionRecords !== null);
        setLoans(loanRecords);
        setClaims(claimRecords);

        const nextMeeting = meetingRecords.find((meeting) => new Date(meeting.dateTime).getTime() >= Date.now());
        setUpcomingMeeting(nextMeeting ? `${nextMeeting.title} on ${new Date(nextMeeting.dateTime).toLocaleDateString()}` : null);
        setUpcomingMeetingRecord(nextMeeting ?? null);
      } catch {
        if (active) {
          setRecentActivity([]);
          setUpcomingMeeting(null);
          setUpcomingMeetingRecord(null);
          setContributions([]);
          setMyRecordsAvailable(false);
          setLoans([]);
          setClaims([]);
          setMeetings([]);
        }
      }
    };

    void loadWorkspaceSignals();
    return () => {
      active = false;
    };
  }, [organization?.id]);

  const smartInsights = useMemo(() => {
    if (!organization) return null;
    return buildSmartInsights({
      walletBalance,
      members: organization.members ?? [],
      contributions,
      loans,
      claims,
      meetings,
    });
  }, [claims, contributions, loans, meetings, organization, walletBalance]);

  const paidContributionCount = contributions.filter((item) => item.status === 'PAID').length;
  const myContributions = contributions.filter((item) => item.memberId === userId && item.status !== 'REVERSED');
  const myPaidTotal = myContributions.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const myOpenCount = myContributions.filter((item) => ['PENDING', 'OVERDUE', 'PARTIAL'].includes(item.status)).length;
  const myOverdueCount = myContributions.filter((item) => item.status === 'OVERDUE').length;
  const pendingContributionCount = contributions.filter((item) => item.status === 'PENDING' || item.status === 'OVERDUE' || item.status === 'PARTIAL').length;
  const activeLoanCount = loans.filter((item) => item.status === 'ACTIVE' || item.status === 'APPROVED').length;
  const pendingLoanCount = loans.filter((item) => item.status === 'PENDING').length;
  const pendingClaimCount = claims.filter((item) => item.status === 'PENDING').length;
  const totalClaimCount = claims.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="hero-card p-6">
          <div className="loading-line w-32" />
          <div className="mt-3 loading-line w-64" />
          <div className="mt-3 loading-line w-full max-w-2xl" />
        </section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <LoadingStat />
          <LoadingStat />
          <LoadingStat />
        </section>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <Card className="p-6">
        <p className="font-bold">Dashboard unavailable</p>
        <p className="mt-2 text-sm">{error}</p>
      </Card>
    );
  }

  if (!organizations.length) {
    return (
      <EmptyState
        title={`Welcome to ${PLATFORM_NAME}`}
        description="You do not belong to any Chama yet. Create one or join through an invitation."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={ROUTES.app.createChama}>
              <Button startIcon={<Plus className="h-4 w-4" />}>Create Chama</Button>
            </Link>
            <Link to={ROUTES.app.joinChama}>
              <Button variant="outline" startIcon={<ArrowRight className="h-4 w-4" />}>Join Chama</Button>
            </Link>
          </div>
        }
      />
    );
  }

  const sparkData = [8, 12, 15, 11, 18, 22, 19, 28, 25, 31];
  const recentTransactions = contributions.slice(0, 4);
  const paidContributionTotal = contributions
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pendingLoanValue = loans
    .filter((item) => item.status === 'PENDING' || item.status === 'ACTIVE' || item.status === 'APPROVED')
    .reduce((sum, item) => sum + Number(item.balance ?? item.amountApproved ?? item.amountRequested ?? 0), 0);
  const nextMeeting = upcomingMeetingRecord;
  const enabledModules = organization?.enabledModules ?? {};
  const canManageChama = ['OWNER', 'FOUNDER', 'ADMIN'].includes(currentRoleName);
  const canManagePayments = ['OWNER', 'FOUNDER', 'ADMIN', 'TREASURER'].includes(currentRoleName);
  const mobileQuickActions = [
    { label: 'Contribution', to: organization ? ROUTES.chama.contributions(organization.id) : ROUTES.app.myChamas, icon: Plus, tone: 'green' },
    ...(enabledModules.loans ? [{ label: 'Loan', to: organization ? ROUTES.chama.loans(organization.id) : ROUTES.app.myChamas, icon: Wallet, tone: 'blue' }] : []),
    ...(enabledModules.welfare ? [{ label: 'Welfare', to: organization ? ROUTES.chama.welfare(organization.id) : ROUTES.app.myChamas, icon: Heart, tone: 'pink' }] : []),
    { label: 'Meeting', to: organization ? ROUTES.chama.meetings(organization.id) : ROUTES.more.meetings, icon: CalendarDays, tone: 'gold' },
    { label: 'Members', to: organization ? ROUTES.chama.members(organization.id) : ROUTES.app.myChamas, icon: UserPlus, tone: 'green-soft' },
    ...(enabledModules.investments ? [{ label: 'Investments', to: organization ? ROUTES.chama.investments(organization.id) : ROUTES.app.myChamas, icon: TrendingUp, tone: 'purple' }] : []),
    ...(enabledModules.voting ? [{ label: 'Voting', to: organization ? ROUTES.chama.voting(organization.id) : ROUTES.app.myChamas, icon: CheckCircle, tone: 'purple' }] : []),
    { label: 'Notice', to: ROUTES.app.notifications, icon: Megaphone, tone: 'teal' },
    { label: 'Reports', to: organization ? ROUTES.chama.reports(organization.id) : ROUTES.more.reports, icon: BarChart3, tone: 'blue-soft' },
    ...(canManagePayments && enabledModules.mpesa ? [{ label: 'M-Pesa', to: ROUTES.admin.mpesa, icon: Wallet, tone: 'green' }] : []),
  ];
  const dashboardStats = [
    { label: 'Contributions', value: formatMoney(paidContributionTotal, currency), caption: `${paidContributionCount} received`, icon: ArrowDownCircle, tone: 'green' },
    { label: 'Loan approvals', value: pendingLoanCount.toString(), caption: 'Pending', icon: Wallet, tone: 'blue' },
    { label: 'Welfare claims', value: pendingClaimCount.toString(), caption: `${totalClaimCount} total`, icon: Heart, tone: 'pink' },
    { label: 'Meetings', value: meetings.length.toString(), caption: nextMeeting ? formatDateLabel(nextMeeting.dateTime) : 'None scheduled', icon: CalendarDays, tone: 'gold' },
  ] as const;
  const recentDashboardActivity = (recentActivity.length
    ? recentActivity.slice(0, 4).map((item, index) => ({
        title: item.title,
        detail: item.detail,
        time: formatTimeLabel(item.time),
        icon: [ArrowDownCircle, ShieldCheck, CheckCircle, CalendarDays][index % 4],
        tone: ['green', 'blue', 'purple', 'gold'][index % 4],
      }))
    : recentTransactions.map((item, index) => ({
        title: item.member ? `${item.member.firstName} ${item.member.lastName} contributed` : item.contributionType || item.reference || 'Contribution recorded',
        detail: formatMoney(item.amount, currency),
        time: formatTimeLabel(item.paidDate ?? item.createdAt ?? item.dueDate),
        icon: [ArrowDownCircle, Wallet, CheckCircle, CalendarDays][index % 4],
        tone: ['green', 'blue', 'purple', 'gold'][index % 4],
      }))).slice(0, 4);
  const mobileStatus = organization ? getChamaStatusLabel(organization.status) : 'No Chama selected';
  const roleAccessPanel = organization ? (
    <section className="section-shell overflow-hidden">
      <div className="section-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--ds-text-muted)]">Member identity and assigned access</p>
          <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">My role: {currentRoleAccess.label}</h2>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{currentRoleAccess.responsibility}</p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-bold text-sky-800">Active role</span>
      </div>
      <div className="section-body grid gap-3 sm:grid-cols-2">
        {currentRoleAccess.access.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-3 text-sm font-semibold text-[var(--ds-secondary)]">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--ds-primary)]" />
            {item}
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const mobileLayout = (
    <div className="chama360-dashboard-home">
      {!organization ? (
        <EmptyState
          title={`Welcome to ${PLATFORM_NAME}`}
          description="Create a Chama or join one to start managing money, members, and welfare."
          action={
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Link to={ROUTES.app.createChama}>
                <Button className="w-full" startIcon={<Plus className="h-4 w-4" />}>
                  Create Chama
                </Button>
              </Link>
              <Link to={ROUTES.app.joinChama}>
                <Button variant="outline" className="w-full" startIcon={<ArrowRight className="h-4 w-4" />}>
                  Join Chama
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <section className="chama360-dashboard-wallet">
            <div className="chama360-wallet-shine" aria-hidden="true" />
            <div className="chama360-dashboard-wallet-top">
              <span>Wallet Balance</span>
              <em>{mobileStatus}</em>
            </div>
            <div className="chama360-dashboard-wallet-copy">
              <p>{organization.name}</p>
              <h2>{formatMoney(walletBalance, currency)}</h2>
              <div>
                <span>{organization.chamaType ?? organization.organizationType}</span>
                <span>{memberCount} members</span>
                <span>{enabledModuleCount} modules</span>
              </div>
            </div>
            <div className="chama360-dashboard-wallet-art" aria-hidden="true">
              <span />
              <strong>{currency}</strong>
            </div>
          </section>

          <section className="chama360-dashboard-stats">
            <article className="chama360-dashboard-balance-card">
              <span className="chama360-stat-icon green">
                <Users className="h-5 w-5" />
              </span>
              <p>Members</p>
              <strong>{memberCount}</strong>
              <small>{readonly ? 'Read-only' : 'Active workspace'}</small>
            </article>
            <article className="chama360-dashboard-balance-card">
              <span className="chama360-stat-icon gold">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <p>Exposure</p>
              <strong>{formatMoney(pendingLoanValue, currency)}</strong>
              <small>{pendingLoanCount} pending loans</small>
            </article>
          </section>

          {roleAccessPanel}

          <section className="chama360-section">
            <div className="chama360-section-title">
              <h2>Today's Snapshot</h2>
              <Link to={ROUTES.chama.reports(organization.id)}>View all</Link>
            </div>
            <div className="chama360-dashboard-snapshot">
              {dashboardStats.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={ROUTES.chama.reports(organization.id)} className="chama360-dashboard-stat-card">
                    <span className={`chama360-action-icon ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <em>{item.caption}</em>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="chama360-section">
            <div className="chama360-section-title">
              <h2>Quick Actions</h2>
              {canManageChama ? <Link to={ROUTES.chama.settings(organization.id)}>Edit</Link> : <span>For my role</span>}
            </div>
            <div className="chama360-action-grid">
              {mobileQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} to={action.to} className="chama360-action-card chama360-dashboard-action-card">
                    <span className={`chama360-action-icon ${action.tone}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span>{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="chama360-dashboard-meeting-card">
            <span className="chama360-action-icon gold">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p>Next Meeting</p>
              <strong>{upcomingMeeting ?? 'No meeting scheduled'}</strong>
              <small>{nextMeeting ? formatTimeLabel(nextMeeting.dateTime) : 'Create one from meetings'}</small>
            </div>
            <Link to={ROUTES.chama.meetings(organization.id)} aria-label="Open meetings">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </section>

          <section className="chama360-section">
            <div className="chama360-section-title">
              <h2>Recent Activity</h2>
              <Link to={ROUTES.chama.reports(organization.id)}>View all</Link>
            </div>
            <div className="chama360-activity-list chama360-dashboard-activity-list">
              {recentDashboardActivity.length ? (
                recentDashboardActivity.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={`${item.title}-${item.time}`} className="chama360-activity-row chama360-dashboard-activity-row">
                      <span className={`chama360-activity-icon ${item.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <time>{item.time}</time>
                    </article>
                  );
                })
              ) : (
                <div className="chama360-activity-row chama360-dashboard-activity-row">
                  <span className="chama360-activity-icon green">
                    <ArrowDownCircle className="h-5 w-5" />
                  </span>
                  <span>
                    <strong>No activity yet</strong>
                    <small>Updates will appear after the first transaction.</small>
                  </span>
                  <time>New</time>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {organization ? <section className="section-shell overflow-hidden" aria-labelledby="my-contributions-title">
        <div className="section-header"><p className="text-sm text-[var(--ds-text-muted)]">Your records in {organization.name}</p><h2 id="my-contributions-title" className="text-xl font-black text-[var(--ds-secondary)]">My contributions</h2></div>
        <div className="section-body space-y-4">
          {myRecordsAvailable ? <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Confirmed paid</p><strong className="mt-1 block text-base text-emerald-950 sm:text-xl">{formatMoney(myPaidTotal, currency)}</strong></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-800">Open records</p><strong className="mt-1 block text-xl text-amber-950">{myOpenCount}</strong></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-800">Overdue</p><strong className="mt-1 block text-xl text-rose-950">{myOverdueCount}</strong></div>
          </div> : <p className="text-sm text-[var(--ds-text-muted)]">Your contribution records are unavailable right now. Open Contributions to try again.</p>}
          <Link className="btn btn-primary inline-flex items-center gap-2" to={ROUTES.chama.contributions(organization.id)}><ClipboardList className="h-4 w-4" /> View my records and statement <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section> : null}
      {compactLayout ? mobileLayout : <div className="chama360-workspace-page">
        <section className="chama360-dashboard-desktop-hero">
          {organization ? (
            <>
              <div className="chama360-dashboard-desktop-wallet">
                <div className="chama360-dashboard-desktop-wallet-top">
                  <span>Good Morning, {userFirstName}</span>
                  <strong>{readonly ? 'Read only' : 'Live workspace'}</strong>
                </div>
                <div className="chama360-dashboard-desktop-wallet-copy">
                  <p>Wallet balance</p>
                  <h1>{formatMoney(walletBalance, currency)}</h1>
                  <small>{organization.name}</small>
                </div>
                <div className="chama360-dashboard-desktop-pills">
                  <span>{getChamaStatusLabel(organization.status)}</span>
                  <span>{organization.chamaType ?? organization.organizationType}</span>
                  <span>{memberCount} members</span>
                </div>
                <p className="chama360-dashboard-desktop-description">
                  {organization.description || getChamaStatusDescription(organization.status)}
                </p>
                <div className="chama360-dashboard-desktop-actions">
                  {!terminal ? (
                    <Link to={ROUTES.chama.contributions(organization.id)}>
                      <Plus className="h-4 w-4" />
                      {canRecordContributions ? 'Record contribution' : 'View my contributions'}
                    </Link>
                  ) : null}
                  <Link to={ROUTES.chama.reports(organization.id)}>
                    <BarChart3 className="h-4 w-4" />
                    Reports
                  </Link>
                </div>
                <div className="chama360-dashboard-desktop-card-art" aria-hidden="true">
                  <span />
                  <strong>{currency}</strong>
                </div>
              </div>

              <div className="chama360-dashboard-desktop-side">
                <article>
                  <span className="green"><Wallet className="h-5 w-5" /></span>
                  <p>Contributions</p>
                  <strong>{formatMoney(paidContributionTotal, currency)}</strong>
                  <small>{paidContributionCount} received</small>
                </article>
                <article>
                  <span className="blue"><Users className="h-5 w-5" /></span>
                  <p>Members</p>
                  <strong>{memberCount}</strong>
                  <small>{readonly ? 'Read only' : 'Active workspace'}</small>
                </article>
                <article>
                  <span className="gold"><ClipboardList className="h-5 w-5" /></span>
                  <p>Modules</p>
                  <strong>{enabledModuleCount}</strong>
                  <small>{upcomingMeeting ?? 'No meeting scheduled'}</small>
                </article>
                <article>
                  <span className="pink"><Heart className="h-5 w-5" /></span>
                  <p>Pending</p>
                  <strong>{pendingLoanCount + pendingClaimCount}</strong>
                  <small>{formatMoney(pendingLoanValue, currency)} loan exposure</small>
                </article>
              </div>
            </>
          ) : (
            <div className="chama360-dashboard-desktop-wallet solo">
              <div className="chama360-dashboard-desktop-wallet-top">
                <span>Good Morning, {userFirstName}</span>
                <strong>Start here</strong>
              </div>
              <div className="chama360-dashboard-desktop-wallet-copy">
                <p>{PLATFORM_NAME}</p>
                <h1>Ready to manage your Chama today?</h1>
                <small>Create a Chama, join one, and keep your financial work in one place.</small>
              </div>
              <div className="chama360-dashboard-desktop-actions">
                <Link to={ROUTES.app.createChama}>
                  <Plus className="h-4 w-4" />
                  Create Chama
                </Link>
                <Link to={ROUTES.app.joinChama}>
                  <ArrowRight className="h-4 w-4" />
                  Join Chama
                </Link>
              </div>
            </div>
          )}
        </section>

      {organization ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Wallet" value={formatMoney(walletBalance, currency)} caption="Current balance" tone="emerald" icon={<Wallet className="h-5 w-5" />} />
          <MetricCard title="Members" value={memberCount.toString()} caption="Current active membership" tone="navy" icon={<Users className="h-5 w-5" />} />
          <MetricCard title="Modules" value={enabledModuleCount.toString()} caption={readonly ? 'Read only' : 'Operational'} tone="gold" icon={<ClipboardList className="h-5 w-5" />} />
          <MetricCard title="Contributions" value={`${paidContributionCount}/${contributions.length}`} caption={`${pendingContributionCount} pending`} tone="info" icon={<CalendarDays className="h-5 w-5" />} />
          <MetricCard title="Loans" value={activeLoanCount.toString()} caption={`${pendingLoanCount} waiting`} tone="warning" icon={<Archive className="h-5 w-5" />} />
          <MetricCard title="Welfare" value={`${pendingClaimCount}/${totalClaimCount}`} caption="Claims in motion" tone="error" icon={<Heart className="h-5 w-5" />} />
        </section>
      ) : null}

      <div className="mt-6">{roleAccessPanel}</div>

      {smartInsights ? (
        <section className="section-shell overflow-hidden">
          <div className="section-header flex flex-col gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Smart insights</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--ds-secondary)]">Forecasts, reminders, and risk checks</h2>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
              <TrendingUp className="h-4 w-4" />
              Heuristic guidance from live workspace data
            </div>
          </div>
          <div className="section-body space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {smartInsights.insights.map((item) => (
                <Card key={item.label} className="p-5">
                  <p className="text-sm text-[var(--ds-text-muted)]">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{item.value}</p>
                  <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{item.detail}</p>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Savings growth" subtitle="Portfolio trend">
                <SparklineChart data={sparkData} />
              </ChartCard>

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[var(--ds-primary)]" />
                  <h3 className="text-lg font-semibold text-[var(--ds-secondary)]">Risk watch</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {smartInsights.risks.map((item) => (
                    <div
                      key={`${item.label}-${item.detail}`}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        item.severity === 'high'
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : item.severity === 'medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.severity === 'high' ? <TriangleAlert className="h-4 w-4" /> : null}
                        <p className="font-semibold">{item.label}</p>
                      </div>
                      <p className="mt-1">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-[var(--ds-primary)]" />
                  <h3 className="text-lg font-semibold text-[var(--ds-secondary)]">Smart reminders</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {smartInsights.reminders.length ? (
                    smartInsights.reminders.map((item) => (
                      <div
                        key={`${item.title}-${item.detail}`}
                        className={`rounded-2xl border px-4 py-3 text-sm ${
                          item.tone === 'danger'
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : item.tone === 'warning'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-sky-200 bg-sky-50 text-sky-800'
                        }`}
                      >
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1">{item.detail}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No reminders pending right now." description="This area fills when there are upcoming payments, meetings, or alerts." />
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-sm text-[var(--ds-text-muted)]">Recent activity</p>
                <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Workspace activity</h2>
                <div className="mt-4">
                  <Timeline
                    items={
                      recentActivity.length
                        ? recentActivity.map((item) => ({
                            title: item.title,
                            description: item.detail,
                            time: item.time ? new Date(item.time).toLocaleTimeString() : 'Now',
                          }))
                        : [{ title: 'No recent activity loaded yet.', description: 'Activity will appear after the workspace syncs.' }]
                    }
                  />
                </div>
              </Card>
            </div>
          </div>
        </section>
      ) : null}

      {organization ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <p className="text-sm text-[var(--ds-text-muted)]">Quick actions</p>
            <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Fast access</h2>
            <div className="mt-5 space-y-3">
              <QuickAction label="Open loans" description="Review approvals and balances." icon={<Archive className="h-5 w-5" />} />
              <QuickAction label="Meetings" description="Plan the next gathering." icon={<CalendarDays className="h-5 w-5" />} />
              <QuickAction label="Welfare claims" description="Handle support requests." icon={<Heart className="h-5 w-5" />} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-[var(--ds-text-muted)]">Run the Chama</p>
            <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Quick access</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ds-text-muted)]">{readonly ? 'Archived or closed groups stay read-only.' : 'Use the workspace routes to manage members, finance, welfare, and meetings.'}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={ROUTES.chama.members(organization.id)}>
                <Button startIcon={<ArrowRight className="h-4 w-4" />}>Open Members</Button>
              </Link>
              {!terminal ? (
                <Link to={ROUTES.chama.contributions(organization.id)}>
                  <Button variant="outline" startIcon={<Wallet className="h-4 w-4" />}>Contributions</Button>
                </Link>
              ) : null}
              {terminal ? (
                <Link to={ROUTES.chama.dashboard(organization.id)}>
                  <Button variant="outline" startIcon={<Archive className="h-4 w-4" />}>Review archive</Button>
                </Link>
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}

      {!isWorkspace ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizations.map((item) => (
            <Link key={item.id} to={ROUTES.chama.dashboard(item.id)} className="dashboard-tile p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">Chama</p>
              <h3 className="mt-2 text-xl font-black text-[var(--ds-secondary)]">{item.name}</h3>
              <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{item.description || 'No description provided.'}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className={`rounded-full border px-3 py-1 ${getChamaStatusTone(item.status)}`}>{getChamaStatusLabel(item.status)}</span>
                <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-[var(--ds-text-muted)]">{item.slug.slice(0, 8).toUpperCase()}</span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
      </div>}
    </div>
  );
};
