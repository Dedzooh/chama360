import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Banknote, ClipboardCheck, Gauge, Landmark, ScrollText, Settings, ShieldCheck } from 'lucide-react';
import { ROUTES } from '../../config/routes';

type AdminWorkspaceFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

const adminLinks = [
  { label: 'Dashboard', to: ROUTES.admin.home, icon: Gauge },
  { label: 'Roles', to: ROUTES.admin.roles, icon: ShieldCheck },
  { label: 'Approvals', to: ROUTES.admin.approvals, icon: ClipboardCheck },
  { label: 'Wallet', to: ROUTES.admin.wallet, icon: Landmark },
  { label: 'Settings', to: ROUTES.admin.chamaSettings, icon: Settings },
  { label: 'Audit logs', to: ROUTES.admin.auditLogs, icon: ScrollText },
  { label: 'M-Pesa', to: ROUTES.admin.mpesa, icon: Banknote },
] as const;

export const AdminWorkspaceFrame = ({ title, subtitle, children }: AdminWorkspaceFrameProps) => {
  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-admin">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Administration</span>
            <strong>CHAMA360</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="chama360-module-hero-actions">
            <NavLink to={ROUTES.admin.home}>
              <Gauge className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink to={ROUTES.admin.approvals}>
              <ClipboardCheck className="h-4 w-4" />
              Approvals
            </NavLink>
            <NavLink to={ROUTES.admin.mpesa}>
              <Banknote className="h-4 w-4" />
              M-Pesa
            </NavLink>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Gauge className="h-5 w-5" /></span>
            <p>Console</p>
            <strong>Live</strong>
            <small>Admin workspace</small>
          </article>
          <article>
            <span className="blue"><ShieldCheck className="h-5 w-5" /></span>
            <p>Controls</p>
            <strong>7</strong>
            <small>Management areas</small>
          </article>
          <article>
            <span className="gold"><Banknote className="h-5 w-5" /></span>
            <p>Payments</p>
            <strong>M-Pesa</strong>
            <small>STK and reconciliation</small>
          </article>
        </div>
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header flex flex-wrap gap-2">
          {adminLinks.map(({ icon: Icon, ...link }) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.to === ROUTES.admin.home}
              className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="section-body">{children}</div>
      </section>
    </div>
  );
};
