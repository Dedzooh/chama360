import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Archive,
  BarChart3,
  Calendar,
  CheckCircle,
  Heart,
  LayoutGrid,
  List,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import { BrandMark } from '../components/BrandLogo';
import { getChamaStatusLabel, getChamaStatusTone } from '../utils/chamaLifecycle';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService } from '../services/organizationService';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Chip, ConfirmDialog, EmptyState, SearchBar } from '../design-system';

const FAVORITES_KEY = 'chama360:favorites';
const RECENT_KEY = 'chama360:recent';
const VIEW_KEY = 'chama360:my-chamas-view';

const readList = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const MyChamas = () => {
  const compactLayout = useCompactLayout();
  const location = useLocation();
  const creationResult = location.state as { createdOrganizationName?: string; requiredPlan?: string } | null;
  const { organizations, loading, error, refreshOrganizations } = useOrganizationWorkspace();
  const userFirstName = useAuthStore((state) => state.user?.firstName ?? 'there');
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => readList(FAVORITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT_KEY));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === 'list' ? 'list' : 'grid';
  });
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [selectedPreset, setSelectedPreset] = useState<'all' | 'favorites' | 'recent' | 'savings'>('all');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveCandidateId, setArchiveCandidateId] = useState<string | null>(null);

  useEffect(() => {
    void refreshOrganizations();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshOrganizations();
      }
    };
    const refreshOnFocus = () => void refreshOrganizations();

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [refreshOrganizations]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 12)));
  }, [recent]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  const recordRecent = (organizationId: string) => {
    setRecent((current) => [organizationId, ...current.filter((id) => id !== organizationId)].slice(0, 12));
  };

  const toggleFavorite = (organizationId: string) => {
    setFavorites((current) => (current.includes(organizationId) ? current.filter((id) => id !== organizationId) : [organizationId, ...current]));
  };

  const handleArchive = async (organizationId: string) => {
    setArchivingId(organizationId);
    try {
      await organizationService.archiveOrganization(organizationId);
      await refreshOrganizations();
      recordRecent(organizationId);
    } finally {
      setArchivingId(null);
      setArchiveCandidateId(null);
    }
  };

  const filteredOrganizations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = organizations.filter((organization) => {
      const matchesSearch =
        !term ||
        organization.name.toLowerCase().includes(term) ||
        (organization.description ?? '').toLowerCase().includes(term) ||
        organization.slug.toLowerCase().includes(term);

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && organization.status === 'ACTIVE') ||
        (selectedStatus === 'archived' && organization.status === 'ARCHIVED');

      const matchesPreset =
        selectedPreset === 'all' ||
        (selectedPreset === 'favorites' && favorites.includes(organization.id)) ||
        (selectedPreset === 'recent' && recent.includes(organization.id)) ||
        (selectedPreset === 'savings' &&
          `${organization.organizationType} ${organization.name} ${organization.description ?? ''}`.toLowerCase().includes('saving'));

      return matchesSearch && matchesStatus && matchesPreset;
    });

    return filtered.sort((left, right) => {
      const leftFavorite = favorites.includes(left.id) ? 1 : 0;
      const rightFavorite = favorites.includes(right.id) ? 1 : 0;
      if (leftFavorite !== rightFavorite) return rightFavorite - leftFavorite;

      const leftRecent = recent.indexOf(left.id);
      const rightRecent = recent.indexOf(right.id);
      if (leftRecent !== rightRecent) {
        return (leftRecent === -1 ? Number.MAX_SAFE_INTEGER : leftRecent) - (rightRecent === -1 ? Number.MAX_SAFE_INTEGER : rightRecent);
      }

      return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
    });
  }, [favorites, organizations, recent, searchTerm, selectedPreset, selectedStatus]);

  const stats = useMemo(() => {
    const activeCount = organizations.filter((organization) => organization.status === 'ACTIVE').length;
    const archivedCount = organizations.filter((organization) => organization.status === 'ARCHIVED').length;
    const walletTotal = organizations.reduce((sum, organization) => sum + Number(organization.wallet?.balance ?? organization.balance ?? 0), 0);
    const favoriteCount = favorites.filter((id) => organizations.some((organization) => organization.id === id)).length;
    return {
      total: organizations.length,
      active: activeCount,
      archived: archivedCount,
      walletTotal,
      favorites: favoriteCount,
    };
  }, [favorites, organizations]);

  const primaryOrganizationId = organizations[0]?.id;
  const quickActions = [
    { label: 'Record Contribution', to: primaryOrganizationId ? ROUTES.chama.contributions(primaryOrganizationId) : ROUTES.app.createChama, icon: Plus, tone: 'green' },
    { label: 'Apply Loan', to: primaryOrganizationId ? ROUTES.chama.loans(primaryOrganizationId) : ROUTES.app.joinChama, icon: Wallet, tone: 'blue' },
    { label: 'Approve Loans', to: primaryOrganizationId ? ROUTES.chama.loans(primaryOrganizationId) : ROUTES.app.myChamas, icon: CheckCircle, tone: 'purple' },
    { label: 'Welfare Claim', to: primaryOrganizationId ? ROUTES.chama.welfare(primaryOrganizationId) : ROUTES.app.myChamas, icon: Heart, tone: 'pink' },
    { label: 'Add Member', to: ROUTES.app.joinChama, icon: UserPlus, tone: 'green-soft' },
    { label: 'Schedule Meeting', to: ROUTES.more.meetings, icon: Calendar, tone: 'gold' },
    { label: 'Announcement', to: ROUTES.app.notifications, icon: Megaphone, tone: 'teal' },
    { label: 'Reports', to: ROUTES.more.reports, icon: BarChart3, tone: 'blue-soft' },
  ] as const;

  const accountTone = (index: number) => ['emerald', 'gold', 'navy', 'mint'][index % 4];
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'C';

  const mobileLayout = (
    <div className="chama360-mobile-home">
      <section className="chama360-wallet-card">
        <div className="chama360-wallet-shine" aria-hidden="true" />
        <div className="chama360-wallet-topline">
          <span>Wallet Overview</span>
          <button type="button" aria-label="Toggle balance visibility">
            <Wallet className="h-5 w-5" />
          </button>
        </div>
        <p className="chama360-wallet-label">Total Balance</p>
        <h2>KES {stats.walletTotal.toLocaleString()}</h2>
        <div className="chama360-wallet-breakdown">
          <div>
            <Wallet className="h-5 w-5" />
            <span>Savings</span>
            <strong>KES {stats.walletTotal.toLocaleString()}</strong>
          </div>
          <div>
            <ShieldCheck className="h-5 w-5" />
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>
          <div>
            <Heart className="h-5 w-5" />
            <span>Favorites</span>
            <strong>{stats.favorites}</strong>
          </div>
          <div>
            <BarChart3 className="h-5 w-5" />
            <span>Chamas</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
      </section>

      <section className="chama360-section">
        <div className="chama360-section-title">
          <h2>Quick Actions</h2>
          <Link to={ROUTES.app.mobile}>Edit</Link>
        </div>
        <div className="chama360-action-grid">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="chama360-action-card">
                <span className={`chama360-action-icon ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="chama360-search-section">
        <div className="chama360-search-row">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search Chamas..." />
        </div>
        <div className="chama360-chip-row">
          <Chip
            active={selectedStatus === 'all' && selectedPreset === 'all'}
            onClick={() => {
              setSelectedStatus('all');
              setSelectedPreset('all');
            }}
          >
            All
          </Chip>
          <Chip
            active={selectedStatus === 'active'}
            onClick={() => {
              setSelectedStatus('active');
              setSelectedPreset('all');
            }}
          >
            Active
          </Chip>
          <Chip
            active={selectedStatus === 'archived'}
            onClick={() => {
              setSelectedStatus('archived');
              setSelectedPreset('all');
            }}
          >
            Archived
          </Chip>
          <Chip active={selectedPreset === 'favorites'} onClick={() => setSelectedPreset('favorites')}>
            Favorites
          </Chip>
          <Chip active={selectedPreset === 'savings'} onClick={() => setSelectedPreset('savings')}>
            Savings
          </Chip>
          <Chip active={selectedPreset === 'recent'} onClick={() => setSelectedPreset('recent')}>
            Recent
          </Chip>
        </div>
      </section>

      <section className="chama360-section">
        <div className="chama360-section-title">
          <h2>Your Chamas</h2>
        </div>

        {loading ? (
          <div className="chama360-account-list">
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <EmptyState
            title="You do not have any Chamas yet."
            description="Create your first Chama to start saving, lending, and managing welfare."
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
          <div className="chama360-account-list">
            {filteredOrganizations.map((organization, index) => {
              const favorite = favorites.includes(organization.id);
              const archived = organization.status === 'ARCHIVED';
              const memberCount = Array.isArray(organization.members) ? organization.members.length : 0;
              const walletBalance = Number(organization.wallet?.balance ?? organization.balance ?? 0);

              return (
                <article key={organization.id} className="chama360-account-card">
                  <Link to={ROUTES.chama.dashboard(organization.id)} onClick={() => recordRecent(organization.id)} className="chama360-account-main">
                    <span className={`chama360-account-icon ${accountTone(index)}`}>{initials(organization.name)}</span>
                    <span className="chama360-account-copy">
                      <strong>{organization.name}</strong>
                      <span>{organization.organizationType}</span>
                      <em className={archived ? 'archived' : ''}>{getChamaStatusLabel(organization.status)}</em>
                    </span>
                    <span className="chama360-account-meta">
                      <strong>KES {walletBalance.toLocaleString()}</strong>
                      <span>{memberCount} members</span>
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <div className="chama360-account-tools">
                    <button type="button" onClick={() => toggleFavorite(organization.id)} aria-label="Toggle favorite">
                      <Star className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                    </button>
                    {!archived ? (
                      <button type="button" disabled={archivingId === organization.id} onClick={() => setArchiveCandidateId(organization.id)} aria-label="Archive chama">
                        <Archive className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );

  return (
    <div className="space-y-6">
      {creationResult?.createdOrganizationName ? <div className="success-banner flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" role="status"><span><strong>{creationResult.createdOrganizationName}</strong> was saved successfully and is now available in My Chamas.{creationResult.requiredPlan && creationResult.requiredPlan !== 'FREE' ? ` Upgrade to ${creationResult.requiredPlan} to unlock all selected modules.` : ''}</span>{creationResult.requiredPlan && creationResult.requiredPlan !== 'FREE' ? <Link className="rounded-lg bg-[var(--ds-primary)] px-3 py-2 font-black text-white" to={ROUTES.app.upgrade}>View plans</Link> : null}</div> : null}
      {compactLayout ? mobileLayout : <div className="chama360-wide-home">
        <section className="chama360-wide-hero">
          <div className="chama360-wide-hero-shine" aria-hidden="true" />
          <div className="chama360-wide-hero-main">
            <div className="chama360-wide-brand-row">
              <BrandMark className="brand-mark" />
              <span>
                <small>Good morning, {userFirstName}</small>
                <strong>CHAMA360 workspace</strong>
              </span>
            </div>
            <h1>My Chamas</h1>
            <p>Choose a Chama, review balances, and jump into the work that needs attention.</p>
            <div className="chama360-wide-hero-actions">
              <Link to={ROUTES.app.createChama} className="chama360-wide-button primary">
                <Plus className="h-5 w-5" />
                <span>Create Chama</span>
              </Link>
              <Link to={ROUTES.app.joinChama} className="chama360-wide-button secondary">
                <UserPlus className="h-5 w-5" />
                <span>Join Chama</span>
              </Link>
            </div>
          </div>
          <div className="chama360-wide-wallet-panel">
            <div>
              <span>Portfolio</span>
              <strong>{stats.total}</strong>
              <small>{stats.active} active groups</small>
            </div>
            <div>
              <span>Wallet total</span>
              <strong>KES {stats.walletTotal.toLocaleString()}</strong>
              <small>{stats.favorites} pinned accounts</small>
            </div>
          </div>
        </section>

        <section className="chama360-wide-panel chama360-wide-search-panel">
          <div className="chama360-wide-section-header">
            <div>
               <p>Your portfolio</p>
               <h2>Find and open a Chama</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshOrganizations()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
          <div className="chama360-wide-controls">
            <div className="chama360-wide-toggle">
              <button type="button" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''}>
                <List className="h-4 w-4" />
                <span>List</span>
              </button>
              <button type="button" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'active' : ''}>
                <LayoutGrid className="h-4 w-4" />
                <span>Grid</span>
              </button>
            </div>
            <Chip active={selectedStatus === 'all'} onClick={() => setSelectedStatus('all')}>All</Chip>
            <Chip active={selectedStatus === 'active'} onClick={() => setSelectedStatus('active')}>Active</Chip>
            <Chip active={selectedStatus === 'archived'} onClick={() => setSelectedStatus('archived')}>Archived</Chip>
          </div>
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search Chamas" />
        </section>

      <div className="space-y-6">
        {error ? (
          <Card className="p-5 text-rose-800">
            <p className="font-bold">Could not load your Chamas</p>
            <p className="mt-1 text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => void refreshOrganizations()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Try again
            </Button>
          </Card>
        ) : null}

        {loading ? (
          <section className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </section>
        ) : filteredOrganizations.length === 0 ? (
          <EmptyState
            title="You do not have any Chamas yet."
            description="Create your first Chama to start saving, lending, and managing welfare."
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
        ) : viewMode === 'grid' ? (
          <section className="chama360-wide-account-grid">
            {filteredOrganizations.map((organization) => {
              const favorite = favorites.includes(organization.id);
              const archived = organization.status === 'ARCHIVED';
              const memberCount = Array.isArray(organization.members) ? organization.members.length : 0;
              const walletBalance = Number(organization.wallet?.balance ?? organization.balance ?? 0);

              return (
                <Card key={organization.id} className="chama360-wide-account-card overflow-hidden p-0">
                  <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={ROUTES.chama.dashboard(organization.id)} onClick={() => recordRecent(organization.id)} className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">{organization.organizationType}</p>
                        <h2 className="mt-2 truncate text-xl font-black text-[var(--ds-secondary)]">{organization.name}</h2>
                      </Link>
                      <button type="button" onClick={() => toggleFavorite(organization.id)} className="chama360-wide-icon-button" aria-label="Toggle favorite">
                        <Star className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
                      </button>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--ds-text-muted)]">{organization.description || 'No description provided.'}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                        <p className="text-xs text-[var(--ds-text-muted)]">Members</p>
                        <p className="mt-1 font-bold text-[var(--ds-text)]">{memberCount}</p>
                      </div>
                      <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                        <p className="text-xs text-[var(--ds-text-muted)]">Wallet</p>
                        <p className="mt-1 font-bold text-[var(--ds-text)]">KES {walletBalance.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className={`rounded-full border px-3 py-1 ${getChamaStatusTone(organization.status)}`}>{getChamaStatusLabel(organization.status)}</span>
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-[var(--ds-text-muted)]">{organization.slug.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={ROUTES.chama.dashboard(organization.id)} onClick={() => recordRecent(organization.id)}>
                        <Button startIcon={<ArrowRight className="h-4 w-4" />}>Open workspace</Button>
                      </Link>
                      {!archived ? (
                        <Button variant="outline" disabled={archivingId === organization.id} onClick={() => setArchiveCandidateId(organization.id)} startIcon={<Archive className="h-4 w-4" />}>
                          {archivingId === organization.id ? 'Archiving...' : 'Archive'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        ) : (
          <section className="chama360-wide-list">
            {filteredOrganizations.map((organization) => {
              const favorite = favorites.includes(organization.id);
              const archived = organization.status === 'ARCHIVED';
              const memberCount = Array.isArray(organization.members) ? organization.members.length : 0;
              const walletBalance = Number(organization.wallet?.balance ?? organization.balance ?? 0);

              return (
                <Card key={organization.id} className="chama360-wide-account-card chama360-wide-account-row p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => toggleFavorite(organization.id)} className="chama360-wide-icon-button" aria-label="Toggle favorite">
                          <Star className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
                        </button>
                        <Link to={ROUTES.chama.dashboard(organization.id)} onClick={() => recordRecent(organization.id)} className="text-lg font-black text-[var(--ds-secondary)]">
                          {organization.name}
                        </Link>
                        <span className={`rounded-full border px-3 py-1 text-xs ${getChamaStatusTone(organization.status)}`}>{getChamaStatusLabel(organization.status)}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{organization.description || 'No description provided.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ds-text-muted)]">
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{organization.organizationType}</span>
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{memberCount} members</span>
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">KES {walletBalance.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={ROUTES.chama.dashboard(organization.id)} onClick={() => recordRecent(organization.id)}>
                        <Button startIcon={<ArrowRight className="h-4 w-4" />}>Open workspace</Button>
                      </Link>
                      {!archived ? (
                        <Button variant="outline" disabled={archivingId === organization.id} onClick={() => setArchiveCandidateId(organization.id)} startIcon={<Archive className="h-4 w-4" />}>
                          {archivingId === organization.id ? 'Archiving...' : 'Archive'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        )}
      </div>
      </div>}
      <ConfirmDialog
        open={Boolean(archiveCandidateId)}
        title="Archive this chama?"
        description="Members can still review its records, but active contributions, approvals, and day-to-day work will stop."
        confirmLabel="Archive chama"
        destructive
        busy={Boolean(archivingId)}
        onClose={() => setArchiveCandidateId(null)}
        onConfirm={() => { if (archiveCandidateId) void handleArchive(archiveCandidateId); }}
      />
    </div>
  );
};

const LoadingCard = () => (
  <Card className="p-5">
    <div className="loading-line w-20" />
    <div className="mt-4 loading-line w-3/4" />
    <div className="mt-3 loading-line w-full" />
    <div className="mt-2 loading-line w-5/6" />
    <div className="mt-6 flex items-center justify-between gap-3">
      <div className="loading-line h-8 w-24 rounded-full" />
      <div className="loading-line h-8 w-16 rounded-full" />
    </div>
  </Card>
);
