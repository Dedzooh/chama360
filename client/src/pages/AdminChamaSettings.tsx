import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Settings2, ShieldCheck } from 'lucide-react';
import { AdminWorkspaceFrame } from '../components/admin/AdminWorkspaceFrame';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { ROUTES } from '../config/routes';

const settingLabels = [
  { key: 'contributions', label: 'Contributions' },
  { key: 'loans', label: 'Loans' },
  { key: 'welfare', label: 'Welfare' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'documents', label: 'Documents' },
  { key: 'voting', label: 'Voting' },
] as const;

export const AdminChamaSettings = () => {
  const { organizations } = useOrganizationWorkspace();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');

  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0] ?? null;
  const selectedOrganizationValue = selectedOrganizationId || selectedOrganization?.id || '';
  const enabledModules = selectedOrganization?.enabledModules ?? {};

  return (
    <AdminWorkspaceFrame
      title="Chama settings"
      subtitle="Review enabled modules and the current governance shape for each organization."
    >
      <div className="space-y-6">
        <section className="section-shell overflow-hidden">
          <div className="section-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Scope</p>
              <h2 className="text-xl font-semibold">Choose organization</h2>
            </div>
            <select value={selectedOrganizationValue} onChange={(event) => setSelectedOrganizationId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 lg:w-[26rem]">
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="section-body">
            {selectedOrganization ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="dashboard-tile p-5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-(--primary)" />
                    <h3 className="text-lg font-semibold">{selectedOrganization.name}</h3>
                  </div>
                  <p className="mt-3 text-sm text-(--muted)">{selectedOrganization.description || 'No description provided.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{selectedOrganization.status}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{selectedOrganization.organizationType}</span>
                  </div>
                </div>
                <div className="dashboard-tile p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-(--primary)" />
                    <h3 className="text-lg font-semibold">Enabled modules</h3>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {settingLabels.map((setting) => {
                      const enabled = Boolean(enabledModules[setting.key]);
                      return (
                        <div key={setting.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm font-medium text-slate-700">{setting.label}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {enabled ? <Check className="h-4 w-4" /> : null}
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state p-8 text-center text-(--muted)">Create or join a chama to inspect settings.</div>
            )}
          </div>
        </section>

        <section className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-slate-500">Controls</p>
            <h2 className="text-xl font-semibold">Configuration shortcuts</h2>
          </div>
          <div className="section-body flex flex-wrap gap-3">
            <Link to={selectedOrganization ? ROUTES.chama.settings(selectedOrganization.id) : ROUTES.app.myChamas} className="btn btn-primary">
              Open workspace settings
            </Link>
            <Link to={ROUTES.admin.roles} className="btn btn-outline">
              Review roles
            </Link>
            <Link to={ROUTES.admin.approvals} className="btn btn-outline">
              Review approvals
            </Link>
          </div>
        </section>
      </div>
    </AdminWorkspaceFrame>
  );
};
