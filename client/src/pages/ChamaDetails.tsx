import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Coins, FileText, Heart, Landmark, LayoutGrid, Repeat, Settings, ShieldCheck, Smartphone, TrendingUp, Users, Users2, Wallet, Sparkles } from "lucide-react";
import { Layout } from "../components/Layout";
import { chamaService } from "../services/chamaService";
import { Chama, ChamaType } from "../types";
import { useAuthStore } from "../store/authStore";

const safeText = (value: any, fallback = "—") => (value === null || value === undefined || value === "" ? fallback : String(value));

const formatMoney = (value: number, currency = "KES") => `${currency} ${Number.isFinite(value) ? value.toLocaleString() : "0"}`;

type Tab = "dashboard" | "members" | "contributions" | "loans" | "welfare" | "investments" | "meetings" | "reports" | "settings";

type Toast = { type: "success" | "error"; message: string } | null;

type SectionCard = {
  label: string;
  value: string;
  icon: any;
  hint?: string;
};

const typeMeta: Record<ChamaType, { label: string; accent: string; summary: string; icon: any; cards: SectionCard[] }> = {
  SAVINGS: {
    label: "Savings Chama",
    accent: "Savings",
    summary: "Total savings, monthly contributions, arrears, loans, and penalties.",
    icon: Wallet,
    cards: [
      { label: "Total Savings", value: "KES 245,000", icon: Wallet, hint: "Current balance" },
      { label: "Monthly Contributions", value: "KES 48,000", icon: Coins, hint: "This month" },
      { label: "Arrears", value: "KES 12,500", icon: Calendar, hint: "Outstanding" },
      { label: "Loans", value: "3 active", icon: TrendingUp, hint: "Issued" },
      { label: "Penalties", value: "KES 1,200", icon: Settings, hint: "This cycle" },
    ],
  },
  MERRY_GO_ROUND: {
    label: "Merry-Go-Round",
    accent: "ROSCA",
    summary: "Current round, beneficiary, next beneficiary, round contributions, and missed payments.",
    icon: Repeat,
    cards: [
      { label: "Current Round", value: "Round 4", icon: Repeat, hint: "Active cycle" },
      { label: "Current Beneficiary", value: "Mary W.", icon: Users, hint: "Receiving this round" },
      { label: "Next Beneficiary", value: "Kimdee", icon: Users2, hint: "Next up" },
      { label: "Round Contributions", value: "KES 96,000", icon: Coins, hint: "Collected" },
      { label: "Missed Payments", value: "2", icon: Settings, hint: "Needs follow-up" },
    ],
  },
  ROSCA: {
    label: "Merry-Go-Round",
    accent: "ROSCA",
    summary: "Current round, beneficiary, next beneficiary, round contributions, and missed payments.",
    icon: Repeat,
    cards: [
      { label: "Current Round", value: "Round 4", icon: Repeat, hint: "Active cycle" },
      { label: "Current Beneficiary", value: "Mary W.", icon: Users, hint: "Receiving this round" },
      { label: "Next Beneficiary", value: "Kimdee", icon: Users2, hint: "Next up" },
      { label: "Round Contributions", value: "KES 96,000", icon: Coins, hint: "Collected" },
      { label: "Missed Payments", value: "2", icon: Settings, hint: "Needs follow-up" },
    ],
  },
  INVESTMENT: {
    label: "Investment Chama",
    accent: "Investment",
    summary: "Portfolio value, shares, projects, profits, dividends, and assets.",
    icon: TrendingUp,
    cards: [
      { label: "Investment Portfolio", value: "KES 1,250,000", icon: TrendingUp, hint: "Total portfolio" },
      { label: "Shares", value: "12,400", icon: Coins, hint: "Units held" },
      { label: "Projects", value: "5 active", icon: Landmark, hint: "Tracked work" },
      { label: "Profits", value: "KES 185,000", icon: Wallet, hint: "This year" },
      { label: "Dividends", value: "KES 42,500", icon: Calendar, hint: "Due soon" },
      { label: "Assets", value: "9 registered", icon: FileText, hint: "Asset register" },
    ],
  },
  WELFARE: {
    label: "Welfare Chama",
    accent: "Welfare",
    summary: "Welfare fund, pending claims, approved claims, emergency cases, and member support history.",
    icon: Heart,
    cards: [
      { label: "Welfare Fund", value: "KES 89,000", icon: Heart, hint: "Available fund" },
      { label: "Pending Claims", value: "6", icon: Users, hint: "Waiting review" },
      { label: "Approved Claims", value: "18", icon: ShieldCheck, hint: "This month" },
      { label: "Emergency Cases", value: "2", icon: Calendar, hint: "Immediate support" },
      { label: "Member Support", value: "44 records", icon: FileText, hint: "Support history" },
    ],
  },
  BUSINESS: {
    label: "Business Chama",
    accent: "Business",
    summary: "Capital, operations, and active business projects.",
    icon: Landmark,
    cards: [
      { label: "Business Capital", value: "KES 380,000", icon: Landmark, hint: "Operating capital" },
      { label: "Projects", value: "4 running", icon: FileText, hint: "Business ideas" },
      { label: "Revenue", value: "KES 96,000", icon: Wallet, hint: "This month" },
      { label: "Expenses", value: "KES 41,500", icon: Settings, hint: "This month" },
      { label: "Profit", value: "KES 54,500", icon: TrendingUp, hint: "Net result" },
    ],
  },
  HOUSING: {
    label: "Housing Chama",
    accent: "Housing",
    summary: "Land, building, and housing reserve tracking.",
    icon: Landmark,
    cards: [
      { label: "Housing Reserve", value: "KES 620,000", icon: Landmark, hint: "Reserved funds" },
      { label: "Land Targets", value: "3 plots", icon: FileText, hint: "Land pipeline" },
      { label: "Building Projects", value: "1 active", icon: TrendingUp, hint: "Construction" },
      { label: "Housing Loans", value: "2 active", icon: Wallet, hint: "Financing" },
      { label: "Documents", value: "15 files", icon: FileText, hint: "Titles and deeds" },
    ],
  },
  FAMILY: {
    label: "Family Chama",
    accent: "Family",
    summary: "Family support, savings, and shared projects.",
    icon: Heart,
    cards: [
      { label: "Family Fund", value: "KES 89,000", icon: Heart, hint: "Available" },
      { label: "Support Requests", value: "3 open", icon: Users, hint: "Pending help" },
      { label: "Projects", value: "2 active", icon: FileText, hint: "Family goals" },
      { label: "Meetings", value: "Sunday", icon: Calendar, hint: "Next meeting" },
      { label: "Members", value: "24", icon: Users2, hint: "Family members" },
    ],
  },
  CHURCH: {
    label: "Church Chama",
    accent: "Church",
    summary: "Church support, stewardship, and member welfare.",
    icon: Heart,
    cards: [
      { label: "Church Fund", value: "KES 140,000", icon: Heart, hint: "Available" },
      { label: "Support Cases", value: "5 open", icon: Users, hint: "Welfare needs" },
      { label: "Meetings", value: "Weekly", icon: Calendar, hint: "Planning" },
      { label: "Reports", value: "12 generated", icon: FileText, hint: "Accountability" },
      { label: "Members", value: "68", icon: Users2, hint: "Congregation" },
    ],
  },
  YOUTH: {
    label: "Youth Chama",
    accent: "Youth",
    summary: "Youth savings, projects, and shared progress.",
    icon: Users,
    cards: [
      { label: "Youth Fund", value: "KES 54,000", icon: Wallet, hint: "Available" },
      { label: "Projects", value: "6 active", icon: FileText, hint: "Programs" },
      { label: "Meetings", value: "Biweekly", icon: Calendar, hint: "Planning" },
      { label: "Members", value: "32", icon: Users2, hint: "Active youth" },
      { label: "Voting", value: "Open", icon: ShieldCheck, hint: "Decisions" },
    ],
  },
  STAFF: {
    label: "Staff Chama",
    accent: "Staff",
    summary: "Workplace savings, loans, and staff welfare.",
    icon: Users,
    cards: [
      { label: "Staff Fund", value: "KES 210,000", icon: Wallet, hint: "Available" },
      { label: "Loans", value: "4 active", icon: TrendingUp, hint: "Employee support" },
      { label: "Welfare Cases", value: "3 open", icon: Heart, hint: "Staff support" },
      { label: "Members", value: "45", icon: Users2, hint: "Employees" },
      { label: "Meetings", value: "Monthly", icon: Calendar, hint: "HR and governance" },
    ],
  },
  FARMERS: {
    label: "Farmers Chama",
    accent: "Farmers",
    summary: "Agricultural savings, equipment, and project tracking.",
    icon: TrendingUp,
    cards: [
      { label: "Agribusiness Portfolio", value: "KES 760,000", icon: TrendingUp, hint: "Total value" },
      { label: "Equipment", value: "8 assets", icon: FileText, hint: "Registered" },
      { label: "Projects", value: "5 active", icon: Landmark, hint: "Farm initiatives" },
      { label: "Loans", value: "2 active", icon: Wallet, hint: "Financing" },
      { label: "Members", value: "26", icon: Users2, hint: "Farmers" },
    ],
  },
  WOMEN: {
    label: "Women's Chama",
    accent: "Women",
    summary: "Savings, support, and women-led initiatives.",
    icon: Heart,
    cards: [
      { label: "Women Fund", value: "KES 98,000", icon: Heart, hint: "Available" },
      { label: "Welfare", value: "4 cases", icon: Users, hint: "Support" },
      { label: "Projects", value: "3 active", icon: FileText, hint: "Initiatives" },
      { label: "Members", value: "31", icon: Users2, hint: "Members" },
      { label: "Meetings", value: "Sunday", icon: Calendar, hint: "Next meeting" },
    ],
  },
  MEN: {
    label: "Men's Chama",
    accent: "Men",
    summary: "Savings, support, and men-led group projects.",
    icon: Heart,
    cards: [
      { label: "Men Fund", value: "KES 112,000", icon: Heart, hint: "Available" },
      { label: "Welfare", value: "2 cases", icon: Users, hint: "Support" },
      { label: "Projects", value: "2 active", icon: FileText, hint: "Initiatives" },
      { label: "Members", value: "24", icon: Users2, hint: "Members" },
      { label: "Meetings", value: "Biweekly", icon: Calendar, hint: "Next meeting" },
    ],
  },
  COMMUNITY: {
    label: "Community Chama",
    accent: "Community",
    summary: "Shared community savings, meetings, and welfare.",
    icon: ShieldCheck,
    cards: [
      { label: "Community Fund", value: "KES 160,000", icon: Wallet, hint: "Available" },
      { label: "Welfare", value: "7 cases", icon: Heart, hint: "Support" },
      { label: "Meetings", value: "Monthly", icon: Calendar, hint: "Governance" },
      { label: "Members", value: "52", icon: Users2, hint: "Residents" },
      { label: "Reports", value: "12 generated", icon: FileText, hint: "Accountability" },
    ],
  },
  HYBRID: {
    label: "Hybrid Chama",
    accent: "Hybrid",
    summary: "One dashboard for savings, loans, welfare, investments, and meetings.",
    icon: Sparkles,
    cards: [
      { label: "Total Value", value: "KES 1,480,000", icon: Wallet, hint: "All modules" },
      { label: "Savings", value: "KES 245,000", icon: Coins, hint: "Core balance" },
      { label: "Investments", value: "KES 1,250,000", icon: TrendingUp, hint: "Portfolio" },
      { label: "Welfare", value: "KES 89,000", icon: Heart, hint: "Support fund" },
      { label: "Loans", value: "3 active", icon: Landmark, hint: "Issued" },
      { label: "Meetings", value: "Sunday", icon: Calendar, hint: "Next" },
    ],
  },
  ASCA: {
    label: "ASCA Chama",
    accent: "ASCA",
    summary: "Accumulating savings, lending, and rotating returns.",
    icon: Wallet,
    cards: [
      { label: "Total Balance", value: "KES 245,000", icon: Wallet, hint: "Fund" },
      { label: "Loans", value: "3 active", icon: Landmark, hint: "Issued" },
      { label: "Meetings", value: "Monthly", icon: Calendar, hint: "Cycle" },
      { label: "Members", value: "24", icon: Users2, hint: "Active" },
      { label: "Arrears", value: "KES 12,500", icon: Settings, hint: "Follow up" },
    ],
  },
  NORMAL: {
    label: "General Chama",
    accent: "General",
    summary: "Flexible group dashboard with configurable modules.",
    icon: Wallet,
    cards: [
      { label: "Balance", value: "KES 245,000", icon: Wallet, hint: "Current" },
      { label: "Members", value: "24", icon: Users2, hint: "Active" },
      { label: "Meetings", value: "Sunday", icon: Calendar, hint: "Next" },
      { label: "Reports", value: "12 generated", icon: FileText, hint: "Available" },
      { label: "Notifications", value: "6 unread", icon: Smartphone, hint: "Pending" },
    ],
  },
};

const MODULE_MENU = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutGrid },
  { id: "members" as const, label: "Members", icon: Users2 },
  { id: "contributions" as const, label: "Contributions", icon: Coins },
  { id: "loans" as const, label: "Loans", icon: Landmark },
  { id: "welfare" as const, label: "Welfare", icon: Heart },
  { id: "investments" as const, label: "Investments", icon: TrendingUp },
  { id: "meetings" as const, label: "Meetings", icon: Calendar },
  { id: "reports" as const, label: "Reports", icon: FileText },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

const SectionStat = ({ card }: { card: SectionCard }) => {
  const Icon = card.icon;
  return (
    <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-(--muted)">{card.label}</p>
          <p className="text-2xl font-semibold mt-1">{card.value}</p>
          {card.hint ? <p className="text-xs text-(--muted) mt-2">{card.hint}</p> : null}
        </div>
        <div className="p-2 rounded-2xl bg-[rgba(91,108,255,0.10)]">
          <Icon className="w-5 h-5 text-(--primary)" />
        </div>
      </div>
    </div>
  );
};

const DashboardSkeleton = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <SkeletonBox className="h-44" />
        <SkeletonBox className="h-56" />
        <SkeletonBox className="h-96" />
      </div>
    </Layout>
  );
};

const SkeletonBox = ({ className = "" }: { className?: string }) => <div className={`rounded-2xl bg-[rgba(15,23,42,0.06)] animate-pulse ${className}`} />;

export const ChamaDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [chama, setChama] = useState<Chama | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<Toast>(null);

  const loadData = useCallback(async (chamaId: string) => {
    try {
      setLoading(true);
      const [chamaData, membersData] = await Promise.all([chamaService.getChamaById(chamaId), chamaService.getMembers(chamaId)]);
      setChama(chamaData);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error) {
      console.error("Failed to load chama details:", error);
      setToast({ type: "error", message: "Failed to load chama details." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    void loadData(id);
  }, [id, loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentType = ((chama?.type === "MERRY_GO_ROUND" ? "ROSCA" : chama?.type) || "SAVINGS") as ChamaType;
  const meta = typeMeta[currentType] || typeMeta.SAVINGS;
  const currentMembers = Number(chama?.currentMembers ?? members.length ?? 0);
  const balanceValue = (chama as any)?.balance ?? (chama as any)?.walletBalance ?? (chama as any)?.fundBalance ?? (chama as any)?.portfolioValue ?? 245000;
  const monthlyValue = (chama as any)?.monthlyContributions ?? 48000;
  const pendingPayments = (chama as any)?.pendingPayments ?? 6;
  const loansIssued = (chama as any)?.activeLoans ?? 3;
  const nextMeeting = (chama as any)?.nextMeeting ?? "Sunday";

  const isMemberManager = useMemo(() => {
    if (!user || !chama?.memberships) return false;
    return chama.memberships.some((m) => m.userId === user.id && (m.role === "FOUNDER" || m.role === "CHAIR" || m.role === "SECRETARY"));
  }, [chama?.memberships, user]);

  if (loading) return <DashboardSkeleton />;
  if (!chama) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-(--muted)">Chama not found</p>
          <button onClick={() => navigate(-1)} className="btn btn-outline mt-4">
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {toast ? (
        <div className="fixed top-5 right-5 z-[999]">
          <div className={`px-4 py-3 rounded-2xl border shadow-sm backdrop-blur-md ${toast.type === "success" ? "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.25)]" : "bg-[rgba(239,68,68,0.10)] border-[rgba(239,68,68,0.25)]"}`}>
            <p className="text-sm text-(--text) font-medium">{toast.message}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="btn btn-ghost">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <section className="panel p-6 fade-up lively-card">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <p className="label">{meta.accent}</p>
              <h1 className="text-3xl font-bold mb-2">{chama.name}</h1>
              <span className="pill">{meta.label}</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigator.clipboard.writeText(chama.shareableLink || "").then(() => setToast({ type: "success", message: "Invite link copied." })).catch(() => setToast({ type: "error", message: "No invite link available." }))} className="btn btn-outline">
                Share
              </button>
              <Link to="/settings" className="btn btn-primary">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </div>
          </div>

          {chama.description ? <p className="text-(--muted) mb-6 max-w-3xl">{chama.description}</p> : null}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Total Balance</p>
              <p className="text-2xl font-semibold mt-1">{formatMoney(Number(balanceValue), chama.currency || "KES")}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Members</p>
              <p className="text-2xl font-semibold mt-1">{currentMembers}/{safeText(chama.maxMembers, "0")}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">This Month</p>
              <p className="text-2xl font-semibold mt-1">{formatMoney(Number(monthlyValue), chama.currency || "KES")}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Pending Payments</p>
              <p className="text-2xl font-semibold mt-1">{pendingPayments}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Loans Issued</p>
              <p className="text-2xl font-semibold mt-1">{loansIssued}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Next Meeting</p>
              <p className="text-2xl font-semibold mt-1">{safeText(nextMeeting)}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Dashboard Type</p>
              <p className="text-2xl font-semibold mt-1">{meta.label}</p>
            </div>
            <div className="rounded-3xl border border-(--border) bg-white/70 p-4">
              <p className="text-sm text-(--muted)">Visibility</p>
              <p className="text-2xl font-semibold mt-1">{safeText(chama.visibility)}</p>
            </div>
          </div>
        </section>

        <section className="panel p-4 fade-up lively-card">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {MODULE_MENU.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition ${active ? "border-(--primary) bg-[rgba(91,108,255,0.10)] text-(--primary-strong)" : "border-(--border) bg-white/70 text-(--muted) hover:text-(--text)"}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === "dashboard" ? (
          <section className="panel p-6 fade-up lively-card space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="label">Dashboard</p>
                <h2 className="text-2xl font-bold mt-1">{meta.label}</h2>
                <p className="text-(--muted) mt-2 max-w-3xl">{meta.summary}</p>
              </div>
              <div className="badge-row">
                <span className="badge">Active cycle</span>
                <span className="badge hot">98% on-time</span>
                <span className="badge">Next payout in 6d</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {meta.cards.map((card) => <SectionStat key={card.label} card={card} />)}
            </div>
          </section>
        ) : null}

        {activeTab === "members" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="label">Members</p>
                <h2 className="text-2xl font-bold mt-1">Member directory</h2>
              </div>
              {isMemberManager ? <button className="btn btn-outline">Add Member</button> : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {members.map((member: any) => (
                <div key={member.userId || member.id} className="rounded-3xl border border-(--border) bg-white/70 p-4">
                  <p className="font-semibold">{[member.user?.firstName, member.user?.lastName].filter(Boolean).join(" ") || member.firstName || member.name || "Member"}</p>
                  <p className="text-sm text-(--muted) mt-1">{member.user?.email || member.email || ""}</p>
                  <div className="badge-row mt-3">
                    <span className="badge">{member.role || "MEMBER"}</span>
                    <span className="badge hot">{member.status || "ACTIVE"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "contributions" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="label">Contributions</p>
                <h2 className="text-2xl font-bold mt-1">Contribution workflow</h2>
              </div>
              <Link to="/contributions" className="btn btn-primary">Record Contribution</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Total Balance", value: formatMoney(Number(balanceValue), chama.currency || "KES"), icon: Wallet, hint: "Ledger balance" }} />
              <SectionStat card={{ label: "Monthly Contributions", value: formatMoney(Number(monthlyValue), chama.currency || "KES"), icon: Coins, hint: "This month" }} />
              <SectionStat card={{ label: "Arrears", value: formatMoney(12500, chama.currency || "KES"), icon: Settings, hint: "Follow up" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "loans" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="label">Loans</p>
                <h2 className="text-2xl font-bold mt-1">Loan management</h2>
              </div>
              <Link to="/loans" className="btn btn-primary">Apply Loan</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Loans Issued", value: String(loansIssued), icon: Landmark, hint: "Active loans" }} />
              <SectionStat card={{ label: "Pending Payments", value: String(pendingPayments), icon: Settings, hint: "Needs action" }} />
              <SectionStat card={{ label: "Next Meeting", value: safeText(nextMeeting), icon: Calendar, hint: "Loan committee" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "welfare" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div>
              <p className="label">Welfare</p>
              <h2 className="text-2xl font-bold mt-1">Welfare support dashboard</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Welfare Fund", value: formatMoney(89000, chama.currency || "KES"), icon: Heart, hint: "Available fund" }} />
              <SectionStat card={{ label: "Pending Claims", value: "6", icon: Users, hint: "Awaiting review" }} />
              <SectionStat card={{ label: "Emergency Cases", value: "2", icon: Calendar, hint: "Immediate support" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "investments" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div>
              <p className="label">Investments</p>
              <h2 className="text-2xl font-bold mt-1">Portfolio dashboard</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Investment Portfolio", value: formatMoney(1250000, chama.currency || "KES"), icon: TrendingUp, hint: "Total value" }} />
              <SectionStat card={{ label: "Shares", value: "12,400", icon: Coins, hint: "Units held" }} />
              <SectionStat card={{ label: "Dividends", value: formatMoney(42500, chama.currency || "KES"), icon: Wallet, hint: "Due soon" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "meetings" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div>
              <p className="label">Meetings</p>
              <h2 className="text-2xl font-bold mt-1">Meeting dashboard</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Next Meeting", value: safeText(nextMeeting), icon: Calendar, hint: "Schedule" }} />
              <SectionStat card={{ label: "Attendance", value: "92%", icon: Users2, hint: "Average" }} />
              <SectionStat card={{ label: "Notices", value: "6 sent", icon: FileText, hint: "Announcements" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "reports" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div>
              <p className="label">Reports</p>
              <h2 className="text-2xl font-bold mt-1">Reporting and exports</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Statements", value: "12", icon: FileText, hint: "Generated" }} />
              <SectionStat card={{ label: "Audit Logs", value: "34", icon: ShieldCheck, hint: "Available" }} />
              <SectionStat card={{ label: "Exports", value: "CSV / PDF", icon: Settings, hint: "Download ready" }} />
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="panel p-6 fade-up lively-card space-y-4">
            <div>
              <p className="label">Settings</p>
              <h2 className="text-2xl font-bold mt-1">Chama settings</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionStat card={{ label: "Visibility", value: safeText(chama.visibility), icon: Settings, hint: "Access control" }} />
              <SectionStat card={{ label: "Status", value: safeText(chama.status), icon: ShieldCheck, hint: "Lifecycle" }} />
              <SectionStat card={{ label: "Type", value: meta.label, icon: meta.icon, hint: "Identity" }} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/modules" className="btn btn-outline">Open modules menu</Link>
              <Link to="/chamas/create" className="btn btn-primary">Create another chama</Link>
            </div>
          </section>
        ) : null}
      </div>
    </Layout>
  );
};

