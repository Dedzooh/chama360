import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Bell, CalendarDays, Crown, FileText, HeartHandshake, LineChart, LogOut, Menu, Plus, QrCode, RefreshCw, Settings, ShieldCheck, Upload, UserCircle2, UserPlus, Vote, Wallet } from 'lucide-react';
import { BottomSheet, Button, IconButton } from '../design-system';
import { BottomNav } from './BottomNav';
import { BrandLockup, BrandMark } from './BrandLogo';
import { ROUTES } from '../config/routes';
import { getChamaStatusLabel, getChamaStatusTone } from '../utils/chamaLifecycle';
import { OrganizationWorkspaceProvider, useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { useAuthStore } from '../store/authStore';
import { UpgradePrompt } from './subscription/UpgradePrompt';
import { useSubscriptionStore } from '../store/subscriptionStore';

interface AppShellContentProps {
  selectedOrganizationId?: string | null;
}

const AppShellContent = ({ selectedOrganizationId }: AppShellContentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const userFirstName = useAuthStore((state) => state.user?.firstName ?? 'there');
  const subscriptionPlan = useSubscriptionStore((state) => state.plan);
  const setSubscriptionOrganization = useSubscriptionStore((state) => state.setOrganization);
  const showUpgrade = useSubscriptionStore((state) => state.showUpgrade);
  const { currentOrganization, activeOrganizationId, loading, error, refreshOrganizations } = useOrganizationWorkspace();
  const roleName = (currentOrganization?.myRole ?? '').toUpperCase();
  const canManageWorkspace = !currentOrganization || ['OWNER', 'FOUNDER', 'ADMIN'].includes(roleName);
  const canUseMpesaAdmin = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'].includes(roleName);
  const canViewAuditTrail = ['OWNER', 'FOUNDER', 'TREASURER', 'AUDITOR', 'ADMIN'].includes(roleName);
  const roleLabel: Record<string, string> = { OWNER: 'Owner', FOUNDER: 'Founder', CHAIR: 'Chairperson', TREASURER: 'Treasurer', SECRETARY: 'Secretary', AUDITOR: 'Auditor', ADMIN: 'Administrator', MEMBER: 'Member' };

  useEffect(() => {
    void setSubscriptionOrganization(activeOrganizationId);
  }, [activeOrganizationId, setSubscriptionOrganization]);

  useEffect(() => {
    const handleUpgradeRequired = (event: Event) => {
      const feature = (event as CustomEvent<{ feature?: Parameters<typeof showUpgrade>[0] }>).detail?.feature;
      if (feature) showUpgrade(feature);
    };
    window.addEventListener('chama360:upgrade-required', handleUpgradeRequired);
    return () => window.removeEventListener('chama360:upgrade-required', handleUpgradeRequired);
  }, [showUpgrade]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      try {
        const response = await userService.getNotifications({ limit: 100, unreadOnly: true });
        if (active) setUnreadNotifications(response.notifications.length);
      } catch {
        // A notification count failure should not interrupt the member workspace.
      }
    };
    const handleNotificationsChanged = () => void refreshUnread();
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 60_000);
    window.addEventListener('chama360:notifications-changed', handleNotificationsChanged);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('chama360:notifications-changed', handleNotificationsChanged);
    };
  }, [location.pathname]);

  const title = useMemo(() => {
    if (location.pathname.startsWith('/chamas/')) return currentOrganization?.name ?? 'Workspace';
    if (location.pathname === ROUTES.app.myChamas || location.pathname === ROUTES.app.home) return 'My Chamas';
    if (location.pathname === ROUTES.app.designSystem) return 'Design System';
    if (location.pathname === ROUTES.app.profile) return 'Profile';
    if (location.pathname === ROUTES.app.notifications) return 'Notifications';
    return 'Dashboard';
  }, [currentOrganization?.name, location.pathname]);

  const subtitle = currentOrganization ? getChamaStatusLabel(currentOrganization.status) : 'No Chama selected';
  const shortCode = currentOrganization?.slug ? currentOrganization.slug.slice(0, 8).toUpperCase() : '';
  const showBack = window.history.length > 1 && location.pathname !== ROUTES.app.home;
  const shouldRedirectMissingWorkspace =
    selectedOrganizationId &&
    !loading &&
    error &&
    (error.toLowerCase().includes('access') || error.toLowerCase().includes('not found'));

  if (shouldRedirectMissingWorkspace) {
    return <Navigate to={ROUTES.app.myChamas} replace />;
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(ROUTES.app.home);
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await authService.logout();
    } catch {
      // Clear local auth state even if the backend session already expired.
    } finally {
      clearAuth();
      setSigningOut(false);
      navigate(ROUTES.auth.login, { replace: true });
    }
  };

  const quickSheetItems = [
    { label: 'Create Chama', to: ROUTES.app.createChama, icon: Plus, tone: 'green' },
    { label: 'Join Chama', to: ROUTES.app.joinChama, icon: UserPlus, tone: 'blue' },
    { label: 'Scan QR', to: ROUTES.app.mobile, icon: QrCode, tone: 'gold' },
    { label: 'Import', to: ROUTES.app.mobile, icon: Upload, tone: 'purple' },
  ] as const;

  const moreSheetItems = [
    { label: 'Profile', to: ROUTES.app.profile, icon: UserCircle2, tone: 'green' },
    { label: 'Settings', to: ROUTES.more.settings, icon: Settings, tone: 'navy' },
    { label: 'Notifications', to: ROUTES.app.notifications, icon: Bell, tone: 'gold' },
    { label: 'Documents', to: ROUTES.more.documents, icon: FileText, tone: 'blue' },
    { label: 'Meetings', to: ROUTES.more.meetings, icon: CalendarDays, tone: 'green-soft' },
    ...(currentOrganization?.enabledModules?.voting && activeOrganizationId ? [{ label: 'Voting', to: ROUTES.chama.voting(activeOrganizationId), icon: Vote, tone: 'gold' as const }] : []),
    ...(currentOrganization?.enabledModules?.investments && activeOrganizationId ? [{ label: 'Investments', to: ROUTES.chama.investments(activeOrganizationId), icon: LineChart, tone: 'teal' as const }] : []),
    { label: 'Reports', to: ROUTES.more.reports, icon: ShieldCheck, tone: 'purple' },
    ...(canViewAuditTrail ? [{ label: 'Audit Trail', to: ROUTES.more.auditLogs, icon: Activity, tone: 'navy' as const }] : []),
    { label: 'M-Pesa', to: ROUTES.admin.mpesa, icon: Wallet, tone: 'teal' },
    { label: 'Help', to: ROUTES.more.help, icon: HeartHandshake, tone: 'pink' },
  ] as const;
  const visibleMoreSheetItems = moreSheetItems.filter((item) => item.label === 'Settings' ? canManageWorkspace : item.label === 'M-Pesa' ? canUseMpesaAdmin : true);

  return (
    <div className="min-h-screen text-slate-900">
      <header className="chama360-app-header sticky top-0 z-30 border-b border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.82)] backdrop-blur-2xl">
        <div className="mx-auto w-full max-w-[760px] px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            {showBack ? (
              <IconButton label="Go back" icon={<ArrowLeft className="h-4 w-4" />} onClick={handleBack} />
            ) : null}

            <Link to={ROUTES.app.myChamas} className="app-brand-link" aria-label="CHAMA360 My Chamas">
              <BrandLockup className="app-brand-lockup" />
            </Link>

            <div className="app-header-context">
              <p>Welcome back, {userFirstName}</p>
              <div className="app-header-title-row">
                <h1>{title}</h1>
                <span className={`rounded-full border px-2 py-0.5 ${currentOrganization ? getChamaStatusTone(currentOrganization.status) : 'border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[var(--ds-text-muted)]'}`}>
                  {subtitle}
                </span>
                {shortCode ? <span className="rounded-full bg-[var(--ds-surface-2)] px-2 py-0.5 text-[var(--ds-text-muted)]">{shortCode}</span> : null}
                {currentOrganization ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">My role: {roleLabel[roleName] ?? roleName}</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {canManageWorkspace ? <Link to={ROUTES.app.upgrade} className="app-plan-chip"><Crown /> {subscriptionPlan}</Link> : null}
              <IconButton
                label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
                icon={<span className="relative inline-flex"><Bell className="h-4 w-4" />{unreadNotifications ? <span className="absolute -right-2.5 -top-2.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}</span>}
                onClick={() => navigate(ROUTES.app.notifications)}
              />
              <IconButton label="More" icon={<Menu className="h-4 w-4" />} onClick={() => setMoreOpen(true)} />
            </div>
          </div>

          <div className={`chama360-online-strip mt-2 flex items-center justify-between rounded-full border px-3 py-1.5 text-xs ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span>{online ? 'Online' : 'Offline'}</span>
            <button type="button" onClick={() => void refreshOrganizations()} className="inline-flex items-center gap-1.5 font-semibold text-inherit">
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 pb-28 pt-4 sm:px-6 mobile-safe-bottom">
        {error ? <div className="error-banner mb-4 px-4 py-3 text-sm">{error}</div> : null}
        <Outlet />
      </main>

      <BottomNav
        activeOrganizationId={activeOrganizationId ?? undefined}
        onMoreToggle={() => setMoreOpen((value) => !value)}
        onQuickAction={() => setQuickOpen(true)}
      />
      <UpgradePrompt />

      <BottomSheet open={quickOpen} title="Quick actions" onClose={() => setQuickOpen(false)}>
        <div className="chama360-sheet-grid">
          {quickSheetItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} onClick={() => setQuickOpen(false)} className="chama360-sheet-action">
                <span className={`chama360-sheet-icon ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="chama360-sheet-stack">
          <div className="chama360-sheet-profile">
            <BrandMark className="brand-mark" />
            <span>
              <strong>{userFirstName}</strong>
              <small>{currentOrganization?.name ?? title}{currentOrganization ? ` · ${roleLabel[roleName] ?? roleName}` : ''}</small>
            </span>
          </div>

          <div className="chama360-sheet-grid">
            {visibleMoreSheetItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="chama360-sheet-action"
                >
                  <span className={`chama360-sheet-icon ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <strong>{item.label}{item.label === 'Notifications' && unreadNotifications ? ` (${unreadNotifications})` : ''}</strong>
                </Link>
              );
            })}
          </div>

          {canManageWorkspace ? <Link
            to={ROUTES.admin.home}
            onClick={() => setMoreOpen(false)}
            className="chama360-sheet-admin"
          >
            <span className="chama360-sheet-icon gold">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <strong>Admin</strong>
          </Link> : null}

          <Button
            variant="outline"
            className="chama360-sheet-logout w-full justify-start"
            onClick={() => {
              setMoreOpen(false);
              void handleLogout();
            }}
            loading={signingOut}
            startIcon={<LogOut className="h-4 w-4" />}
          >
            Logout
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};

export const AppShell = () => {
  const params = useParams();
  return (
    <OrganizationWorkspaceProvider selectedOrganizationId={params.organizationId ?? null}>
      <AppShellContent selectedOrganizationId={params.organizationId ?? null} />
    </OrganizationWorkspaceProvider>
  );
};
