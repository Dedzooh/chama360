import { ReactNode, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  Home,
  Users,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Menu,
  Plus,
  X,
  Sparkles,
  MessageSquareMore,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { PLATFORM_NAME, PLATFORM_SUBTITLE } from "../config/platform";
import { BOTTOM_NAV, MORE_MENU } from "../config/appNavigation";
import { BrandMark } from "./BrandLogo";

interface LayoutProps {
  children: ReactNode;
}

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  section?: "primary" | "management" | "system";
};

export const Layout = ({ children }: LayoutProps) => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const navItems: NavItem[] = useMemo(
    () => [
      { to: "/dashboard", label: "Home", icon: Home, section: "primary" },
      { to: "/modules", label: "Modules", icon: Sparkles, section: "primary" },

      { to: "/chamas/create", label: "Create workspace", icon: Plus, section: "management" },
      { to: "/discover", label: "Discover groups", icon: Users, section: "management" },
      { to: "/contributions", label: "Finance", icon: DollarSign, section: "management" },
      { to: "/loans", label: "Loans", icon: FileText, section: "management" },

      { to: "/settings", label: "Settings", icon: Settings, section: "system" },
    ],
    []
  );

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const closeSidebarOnMobile = () => setSidebarOpen(false);
  const closeMoreMenu = () => setMoreOpen(false);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Account";

  const primary = navItems.filter((i) => i.section === "primary");
  const management = navItems.filter((i) => i.section === "management");
  const system = navItems.filter((i) => i.section === "system");

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:border focus:border-(--border) focus:rounded-xl focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="app-header">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-2 rounded-xl bg-white/70 border border-(--border) shadow-sm hover:shadow transition md:hidden"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
              <BrandMark label={PLATFORM_NAME} />
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight truncate">{PLATFORM_NAME}</p>
                <p className="text-xs text-(--muted) leading-tight truncate">{PLATFORM_SUBTITLE}</p>
              </div>
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <Link to="/dashboard" className="btn btn-ghost">
              Home
            </Link>
            <Link to="/modules" className="btn btn-ghost">
              Modules
            </Link>
            <Link to="/discover" className="btn btn-ghost">
              Discover
            </Link>
            <Link to="/contributions" className="btn btn-ghost">
              Finance
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/chamas/create" className="btn btn-primary hidden md:inline-flex">
              <Plus className="w-4 h-4" />
              Create workspace
            </Link>

            <div className="flex items-center gap-3 px-3 py-2 bg-white/70 border border-(--border) rounded-full shadow-sm">
              <span className="text-sm text-(--muted) hidden sm:inline">{fullName}</span>
              <button onClick={handleLogout} className="btn btn-ghost !px-3 !py-1">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 md:hidden"
            onClick={closeSidebarOnMobile}
            aria-hidden="true"
          />
        )}

        <aside
          className={[
            "app-sidebar w-72 min-h-[calc(100vh-78px)] p-4 z-30 md:static md:block",
            sidebarOpen ? "fixed left-0 top-[78px]" : "hidden md:block",
          ].join(" ")}
          aria-label="Sidebar"
        >
          <div className="panel p-4 mb-4">
            <p className="text-xs text-(--muted) uppercase tracking-[0.2em]">Organization</p>
            <p className="text-lg font-semibold mt-2 truncate">Nairobi Welfare Circle</p>
            <p className="text-sm text-(--muted)">Records, finance, welfare, and governance.</p>

            <div className="badge-row mt-3">
              <span className="badge">Audit logs</span>
              <span className="badge hot">Role access</span>
            </div>

            <Link
              to="/chamas/create"
              onClick={closeSidebarOnMobile}
              className="btn btn-primary w-full justify-center mt-4 md:hidden"
            >
              <Plus className="w-4 h-4" />
              Create workspace
            </Link>
          </div>

          <nav className="space-y-4">
            <div>
              <p className="text-xs text-(--muted) uppercase tracking-[0.2em] px-2 mb-2">
                Home
              </p>
              <div className="space-y-2">
                {primary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={closeSidebarOnMobile}
                      className={`nav-link ${isActive(item.to) ? "active" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-(--muted) uppercase tracking-[0.2em] px-2 mb-2">
                Operations
              </p>
              <div className="space-y-2">
                {management.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={closeSidebarOnMobile}
                      className={`nav-link ${isActive(item.to) ? "active" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-(--muted) uppercase tracking-[0.2em] px-2 mb-2">
                System
              </p>
              <div className="space-y-2">
                {system.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={closeSidebarOnMobile}
                      className={`nav-link ${isActive(item.to) ? "active" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="mt-6 panel p-4">
            <p className="text-sm text-(--muted)">Next workflow</p>
            <p className="text-xl font-semibold mt-1">Welfare approvals</p>
            <p className="text-xs text-(--muted) mt-2">Ready for phase 2 expansion</p>
          </div>
        </aside>

        <main id="main-content" className="flex-1 p-6 lg:p-10">
          {children}
        </main>


      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-(--border) bg-white/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5">
          {BOTTOM_NAV.map((item) => {
            const isMore = item.label === "More";
            const active = isMore ? moreOpen : isActive(item.to);
            const Icon =
              item.label === "Home"
                ? Home
                : item.label === "Members"
                  ? Users
                  : item.label === "Finance"
                    ? DollarSign
                    : item.label === "Welfare"
                      ? Heart
                      : MessageSquareMore;

            return isMore ? (
              <button
                key={item.label}
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex flex-col items-center gap-1 py-3 text-xs ${active ? "text-(--primary)" : "text-(--muted)"}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-3 text-xs ${active ? "text-(--primary)" : "text-(--muted)"}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={closeMoreMenu} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white border-t border-(--border) p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold">More</p>
              <button onClick={closeMoreMenu} className="p-2 rounded-full border border-(--border)">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MORE_MENU.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={closeMoreMenu}
                  className="p-4 rounded-2xl border border-(--border) bg-white/80"
                >
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-(--muted) mt-1">Open {item.label.toLowerCase()}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}      </div>
    </div>
  );
};

