import { Link, useLocation } from 'react-router-dom';
import { Heart, Home, Menu, Plus, Users, Wallet } from 'lucide-react';
import { ROUTES } from '../config/routes';

interface BottomNavProps {
  activeOrganizationId?: string;
  onMoreToggle: () => void;
  onQuickAction: () => void;
}

const getLabel = (value: string) => {
  switch (value) {
    case 'home':
      return 'Home';
    case 'members':
      return 'Members';
    case 'finance':
      return 'Finance';
    case 'welfare':
      return 'Welfare';
    default:
      return 'More';
  }
};

export const BottomNav = ({ activeOrganizationId, onMoreToggle, onQuickAction }: BottomNavProps) => {
  const location = useLocation();
  const membersLink = activeOrganizationId ? `/chamas/${activeOrganizationId}/members` : ROUTES.app.myChamas;
  const financeLink = activeOrganizationId ? `/chamas/${activeOrganizationId}/contributions` : ROUTES.app.myChamas;
  const welfareLink = activeOrganizationId ? `/chamas/${activeOrganizationId}/welfare` : ROUTES.app.myChamas;

  const items = [
    { value: 'home', to: ROUTES.app.home, icon: Home },
    { value: 'members', to: membersLink, icon: Users },
    { value: 'finance', to: financeLink, icon: Wallet },
    { value: 'welfare', to: welfareLink, icon: Heart },
    { value: 'more', icon: Menu },
  ] as const;

  const activeValue =
    location.pathname === ROUTES.app.home || location.pathname === ROUTES.app.myChamas
      ? 'home'
      : location.pathname.includes('/members')
        ? 'members'
        : location.pathname.includes('/contributions') || location.pathname.includes('/loans')
          ? 'finance'
          : location.pathname.includes('/welfare')
            ? 'welfare'
            : 'more';

  return (
    <div className="chama360-bottom-wrap fixed bottom-2 left-0 right-0 z-40 md:hidden">
      <div className="relative mx-auto w-full max-w-[760px] px-3 pb-[max(0.45rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onQuickAction}
          className="chama360-bottom-fab absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] text-white shadow-[0_18px_40px_rgba(15,132,95,0.34)] transition duration-150 active:scale-95 animate-[pulse_6s_ease-in-out_infinite]"
          aria-label="Quick action"
        >
          <Plus className="h-6 w-6" />
          <span className="chama360-bottom-fab-text">Add</span>
        </button>

        <nav className="chama360-bottom-nav rounded-[1.9rem] border border-white/35 bg-[rgba(255,255,255,0.78)] px-2 pb-2 pt-4 shadow-[0_-18px_40px_rgba(16,38,31,0.16)] backdrop-blur-2xl">
          <div className="grid grid-cols-5 gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active =
                item.value === activeValue ||
                (item.value !== 'more' && (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)));
              const label = getLabel(item.value);

              const baseClass =
                'chama360-bottom-item flex min-h-[3.65rem] flex-col items-center justify-center gap-1 rounded-[1rem] px-1 text-[10px] font-extrabold transition duration-150 active:scale-95';
              const activeClass = active ? 'bg-[rgba(15,132,95,0.10)] text-[var(--ds-primary-strong)] shadow-[0_10px_22px_rgba(15,132,95,0.10)]' : 'text-[var(--ds-text-muted)]';

              const icon = (
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    active ? 'bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] text-white shadow-[0_10px_18px_rgba(15,132,95,0.24)]' : 'border border-[rgba(7,20,38,0.06)] bg-white text-[var(--ds-text-muted)] shadow-[0_8px_16px_rgba(7,20,38,0.05)]'
                  }`}
                >
                  <Icon className="h-[1.05rem] w-[1.05rem]" />
                </span>
              );
              const labelNode = (
                <span className={`chama360-bottom-label overflow-hidden text-[10px] transition-all ${active ? 'text-[var(--ds-primary-strong)]' : 'text-[var(--ds-text-muted)]'}`}>
                  {label}
                </span>
              );

              if (item.value === 'more') {
                return (
                  <button key={item.value} type="button" onClick={onMoreToggle} className={`${baseClass} ${activeClass}`}>
                    {icon}
                    {labelNode}
                  </button>
                );
              }

              return (
                <Link key={item.value} to={item.to!} className={`${baseClass} ${activeClass}`}>
                  {icon}
                  {labelNode}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};
