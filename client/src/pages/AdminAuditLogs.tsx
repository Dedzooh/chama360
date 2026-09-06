import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, FileText, RefreshCcw, ShieldCheck } from 'lucide-react';
import { AdminWorkspaceFrame } from '../components/admin/AdminWorkspaceFrame';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService, type OrganizationAuditLogRecord } from '../services/organizationService';
import { ROUTES } from '../config/routes';

export const AdminAuditLogs = () => {
  const { organizations } = useOrganizationWorkspace();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [logs, setLogs] = useState<OrganizationAuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!organizationId && organizations[0]?.id) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  const loadLogs = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const data = await organizationService.listAuditLogs(organizationId);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, reloadIndex]);

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId) ?? organizations[0] ?? null;
  const recentLogs = useMemo(() => logs.slice(0, 12), [logs]);

  return (
    <AdminWorkspaceFrame title="Audit logs" subtitle="Review system activity across organizations and follow the trail to the workspace." >
      <div className="space-y-6">
        <section className="section-shell overflow-hidden">
          <div className="section-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Scope</p>
              <h2 className="text-xl font-semibold">Choose organization</h2>
            </div>
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 lg:w-[26rem]">
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="section-body flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setReloadIndex((value) => value + 1)} className="btn btn-outline">
              <RefreshCcw className="h-4 w-4" />
              Refresh view
            </button>
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Clock3 className="h-4 w-4" />
              {loading ? 'Loading logs...' : `${recentLogs.length} recent entries`}
            </span>
            {selectedOrganization ? (
              <Link to={ROUTES.chama.dashboard(selectedOrganization.id)} className="btn btn-primary">
                Open workspace
              </Link>
            ) : null}
          </div>
        </section>

        <section className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-slate-500">Activity</p>
            <h2 className="text-xl font-semibold">Recent events</h2>
          </div>
          <div className="section-body space-y-3">
            {recentLogs.length === 0 ? (
              <div className="empty-state p-8 text-center text-(--muted)">No audit records available yet.</div>
            ) : recentLogs.map((log) => (
              <article key={log.id} className="dashboard-tile p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-(--secondary)">{log.action}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {log.entityType} {log.entityId}
                    </p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-(--primary)" />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{log.user?.email ?? 'System'}</span>
                  <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Recent'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};
