import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus, UserPlus } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { ROUTES } from '../config/routes';

const statusTone = (status?: string | null) =>
  status === 'ACTIVE' ? 'bg-emerald-500' : status === 'DRAFT' ? 'bg-amber-400' : status === 'SUSPENDED' ? 'bg-rose-400' : 'bg-slate-300';

// First-class chama switcher: the current chama + the user's role in it are
// always visible; tapping reveals every chama with its role plus Create/Join.
// This is one of the most-used controls in the product and is rendered in the
// desktop sidebar and mobile more menu.
export const ChamaSwitcher = () => {
  const navigate = useNavigate();
  const { currentOrganization, organizations, setActiveOrganizationId } = useOrganizationWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const switchTo = (organizationId: string) => {
    setActiveOrganizationId(organizationId);
    setOpen(false);
    navigate(ROUTES.chama.dashboard(organizationId));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3 text-left transition hover:border-[var(--ds-primary)]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusTone(currentOrganization?.status)}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-black text-[var(--ds-secondary)]">{currentOrganization?.name ?? 'No chama selected'}</span>
            <span className="block truncate text-xs font-semibold text-[var(--ds-text-muted)]">
              {(currentOrganization?.myRoleLabel ?? currentOrganization?.myRole ?? 'Member')}
            </span>
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--ds-text-muted)]" />
      </button>

      {open ? (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[0_8px_30px_rgba(15,45,31,0.12)]">
          <p className="px-4 pb-1 pt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Your chamas</p>
          <div className="max-h-72 overflow-y-auto">
            {organizations.map((membership) => {
              const active = membership.id === currentOrganization?.id;
              return (
                <button
                  key={membership.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => switchTo(membership.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--ds-surface-2)] ${active ? 'bg-emerald-50' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusTone(membership.status)}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[var(--ds-secondary)]">{membership.name}</span>
                      <span className="block truncate text-xs text-[var(--ds-text-muted)]">{membership.myRoleLabel ?? membership.myRole ?? 'Member'}</span>
                    </span>
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : null}
                </button>
              );
            })}
            {!organizations.length ? (
              <p className="px-4 py-3 text-sm text-[var(--ds-text-muted)]">You have not joined any chamas yet.</p>
            ) : null}
          </div>
          <div className="border-t border-[var(--ds-border)] p-2">
            <Link
              to={ROUTES.app.myChamas}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--ds-secondary)] transition hover:bg-[var(--ds-surface-2)]"
            >
              <Plus className="h-4 w-4 text-[var(--ds-primary)]" /> Create chama
            </Link>
            <Link
              to={ROUTES.app.joinChama}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--ds-secondary)] transition hover:bg-[var(--ds-surface-2)]"
            >
              <UserPlus className="h-4 w-4 text-[var(--ds-primary)]" /> Join a chama
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};
