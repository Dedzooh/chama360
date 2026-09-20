import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, FileText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type OrganizationAuditLogRecord } from '../../services/organizationService';

export const AuditLogs = () => {
  const { currentOrganization } = useOrganizationWorkspace();
  const [logs, setLogs] = useState<OrganizationAuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await organizationService.listAuditLogs(currentOrganization.id);
      setLogs(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (!term) return true;
      return (
        log.action.toLowerCase().includes(term) ||
        log.entityType.toLowerCase().includes(term) ||
        log.entityId.toLowerCase().includes(term) ||
        `${log.user?.firstName ?? ''} ${log.user?.lastName ?? ''}`.toLowerCase().includes(term)
      );
    });
  }, [logs, searchTerm]);

  if (!currentOrganization) {
    return <div className="section-shell p-6">Open a Chama from My Chamas to review audit logs.</div>;
  }

  const entityCount = new Set(logs.map((log) => log.entityType)).size;
  const systemCount = logs.filter((log) => !log.user).length;
  const latestTime = logs[0]?.createdAt ? new Date(logs[0].createdAt).toLocaleDateString() : 'Waiting';

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-auditlogs">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Security trail</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Audit Logs</h1>
            <p>Review tracked actions, governance events, and system activity in one searchable trail.</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#audit-search">
              <Search className="h-4 w-4" />
              Search
            </a>
            <a href="#audit-activity">
              <Activity className="h-4 w-4" />
              Activity
            </a>
            <button type="button" onClick={() => void loadLogs()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><FileText className="h-5 w-5" /></span>
            <p>Total logs</p>
            <strong>{loading ? '...' : logs.length}</strong>
            <small>Tracked events</small>
          </article>
          <article>
            <span className="blue"><ShieldCheck className="h-5 w-5" /></span>
            <p>Entities</p>
            <strong>{loading ? '...' : entityCount}</strong>
            <small>{systemCount} system actions</small>
          </article>
          <article>
            <span className="gold"><Clock className="h-5 w-5" /></span>
            <p>Latest</p>
            <strong>{latestTime}</strong>
            <small>Most recent record</small>
          </article>
        </div>
      </section>

      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

      <section id="audit-search" className="section-shell overflow-hidden">
        <div className="section-header space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Filter</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Recent activity</h2>
            </div>
            <button type="button" onClick={() => void loadLogs()} className="btn btn-outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-(--border) bg-white px-4 py-3">
            <Search className="h-4 w-4 text-(--muted)" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search actions, users, or entities" />
          </label>
        </div>
        <div id="audit-activity" className="section-body space-y-3">
          {loading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state p-8 text-center text-(--muted)">No audit logs matched your search.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="dashboard-tile p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,137,92,0.12)] text-[var(--ds-primary)]">
                      <Activity className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-black text-(--secondary)">{log.action} {log.entityType}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-(--muted)">
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">Entity {log.entityId}</span>
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{log.entityType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-(--muted)">
                    <span className="rounded-full bg-white px-3 py-1 shadow-sm">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}</span>
                    {log.createdAt ? <span className="rounded-full bg-white px-3 py-1 shadow-sm">{new Date(log.createdAt).toLocaleString()}</span> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

