import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus, UserPlus } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { ROUTES } from '../config/routes';

const statusTone = (status?: string | null) =>
  status === 'ACTIVE' ? 'bg-emerald-500' : status === 'DRAFT' ? 'bg-amber-400' : status === 'SUSPENDED' ? 'bg-rose-400' : 'bg-slate-300';

// Deterministic pastel per chama so letter avatars are visually distinct.
const avatarTones = [
  'bg-emerald-100 text-emerald-800',
  'bg-teal-100 text-teal-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-lime-100 text-lime-800',
  'bg-indigo-100 text-indigo-800',
];
const avatarTone = (name: string) => avatarTones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarTones.length];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';

// Chama avatar: the group logo when one was uploaded during onboarding,
// otherwise a colored letter badge. A tiny status dot rides the corner.
const ChamaAvatar = ({ name, logoUrl, status, size = 'md' }: { name: string; logoUrl?: string | null; status?: string | null; size?: 'sm' | 'md' | 'lg' }) => {
  const dimensions = size === 'lg' ? 'h-11 w-11 text-base' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm';
  const dotClass = size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return (
    <span className="relative inline-flex shrink-0">
      {logoUrl ? (
        <img src={logoUrl} alt="" className={`${dimensions} rounded-xl object-cover`} />
      ) : (
        <span className={`${dimensions} inline-flex items-center justify-center rounded-xl font-black ${avatarTone(name)}`} aria-hidden="true">{initials(name)}</span>
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--ds-surface)] ${dotClass} ${statusTone(status)}`} aria-hidden="true" />
    </span>
  );
};

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
          <ChamaAvatar name={currentOrganization?.name ?? '?'} logoUrl={currentOrganization?.logoUrl} status={currentOrganization?.status} size="md" />
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
                    <ChamaAvatar name={membership.name} logoUrl={(membership as any).logoUrl} status={(membership as any).status} size="sm" />
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
