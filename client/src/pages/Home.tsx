import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  Wallet,
  FileText,
  Lock,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { BrandMark } from "../components/BrandLogo";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "../config/platform";

export const Home = () => {
  return (
    <div className="app-shell anime-sky">
      <header className="app-header">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark label={PLATFORM_NAME} />
            <div className="leading-tight">
              <p className="text-base font-semibold">{PLATFORM_NAME}</p>
              <p className="text-xs text-(--muted)">{PLATFORM_TAGLINE}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-(--muted)">
            <a href="#features" className="hover:text-(--text)">
              Features
            </a>
            <a href="#security" className="hover:text-(--text)">
              Security
            </a>
            <a href="#how" className="hover:text-(--text)">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="btn btn-outline">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary">
              Create organization
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 pb-20">
        {/* HERO */}
        <section className="max-w-6xl mx-auto pt-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-(--border) bg-white/70">
                <ShieldCheck className="w-4 h-4 text-(--primary)" />
                <span className="text-xs text-(--muted)">
                  Role-based access + full audit trails
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold mt-4 leading-tight anime-title">
                Manage every community organization with clarity and control.
              </h1>

              <p className="text-base sm:text-lg text-(--muted) mt-4 max-w-2xl">
                Track contributions, welfare, loans, meetings, and decisions in one workspace.
                Designed for accurate records, transparency, and accountable governance.
              </p>

              <div className="flex flex-wrap gap-3 mt-6">
                <Link to="/register" className="btn btn-primary">
                  Create organization
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/discover" className="btn btn-outline">
                  Explore groups
                </Link>
                <Link to="/login" className="btn btn-outline">
                  View demo
                </Link>
              </div>

              {/* Key bullets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7">
                {[
                  {
                    title: "Complete records",
                    desc: "Every payment, approval, and change is logged.",
                  },
                  {
                    title: "Clear governance",
                    desc: "Votes, minutes, and member roles in one place.",
                  },
                  {
                    title: "Loan tracking",
                    desc: "Eligibility, disbursement, and repayments made simple.",
                  },
                  {
                    title: "Real-time visibility",
                    desc: "Members see the same truth - no confusion.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-2xl border border-(--border) bg-white/60"
                    style={{
                      backdropFilter: "blur(14px)",
                      WebkitBackdropFilter: "blur(14px)",
                      boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
                    }}
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-(--muted) mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div className="lg:col-span-5">
              <div
                className="panel p-5 rounded-3xl border border-(--border) bg-white/70 anime-glass"
                style={{
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-(--muted)">Organization</p>
                    <p className="text-xl font-semibold">Nairobi Circle</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs border border-(--border)">
                    Updated
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-4 rounded-2xl border border-(--border) bg-white/60">
                    <p className="text-sm text-(--muted)">Members</p>
                    <p className="text-2xl font-semibold mt-1">42</p>
                    <p className="text-xs text-(--muted) mt-1">96% active</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-(--border) bg-white/60">
                    <p className="text-sm text-(--muted)">Monthly collection</p>
                    <p className="text-2xl font-semibold mt-1">KES 2.4M</p>
                    <p className="text-xs text-(--muted) mt-1">On schedule</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-(--border) bg-white/60">
                    <p className="text-sm text-(--muted)">Outstanding loans</p>
                    <p className="text-2xl font-semibold mt-1">9</p>
                    <p className="text-xs text-(--muted) mt-1">0 defaults</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-(--border) bg-white/60">
                    <p className="text-sm text-(--muted)">Reliability</p>
                    <p className="text-2xl font-semibold mt-1">97%</p>
                    <p className="text-xs text-(--muted) mt-1">Improving</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-(--border) pt-4">
                  <p className="text-sm font-semibold">Recent activity</p>
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Contribution received</p>
                        <p className="text-(--muted)">Faith K. contributed KES 12,000</p>
                      </div>
                      <span className="text-(--muted)">2m</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Member approved</p>
                        <p className="text-(--muted)">Victor N. joined the group</p>
                      </div>
                      <span className="text-(--muted)">19m</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <Link to="/register" className="btn btn-primary w-full justify-center">
                    Create organization
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="max-w-6xl mx-auto mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label">How it works</p>
              <h2 className="text-2xl font-bold mt-2">Set up once. Run smoothly.</h2>
              <p className="text-(--muted) mt-2 max-w-2xl">
                A simple process that keeps the group accountable without slowing you down.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              {
                icon: Users,
                title: "Create your organization",
                desc: "Add members and assign roles (Chair, Treasurer, Secretary).",
              },
              {
                icon: Wallet,
                title: "Define contributions & rules",
                desc: "Set schedules, penalties, loan rules, and approvals.",
              },
              {
                icon: BarChart3,
                title: "Track & report",
                desc: "View dashboards, statements, and audit logs anytime.",
              },
            ].map((step) => (
              <div key={step.title} className="panel p-6 rounded-3xl border border-(--border)">
                <step.icon className="w-6 h-6 text-(--primary)" />
                <h3 className="text-lg font-semibold mt-3">{step.title}</h3>
                <p className="text-sm text-(--muted) mt-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="max-w-6xl mx-auto mt-12">
          <p className="label">Features</p>
          <h2 className="text-2xl font-bold mt-2">Everything your community group needs.</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {[
              {
                icon: Wallet,
                title: "Contributions & schedules",
                desc: "Track dues, statuses, and payment history in one place.",
                bullets: ["Smart schedules", "Dues status", "Clear member balances"],
              },
              {
                icon: FileText,
                title: "Meetings & governance",
                desc: "Minutes, motions, approvals, and role changes—fully documented.",
                bullets: ["Minutes archive", "Approvals flow", "Role history"],
              },
              {
                icon: Users,
                title: "Member management",
                desc: "Invite, approve, and manage access with role-based permissions.",
                bullets: ["Invites & onboarding", "Role permissions", "Activity log"],
              },
              {
                icon: BarChart3,
                title: "Dashboards & reporting",
                desc: "Reliable summaries, trends, and statements for transparency.",
                bullets: ["Statements", "Trends", "Export-ready views"],
              },
            ].map((f) => (
              <div key={f.title} className="panel p-6 rounded-3xl border border-(--border)">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <f.icon className="w-6 h-6 text-(--primary)" />
                    <div>
                      <h3 className="text-lg font-semibold">{f.title}</h3>
                      <p className="text-sm text-(--muted) mt-1">{f.desc}</p>
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-(--primary)" />
                      <span className="text-(--muted)">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* SECURITY */}
        <section id="security" className="max-w-6xl mx-auto mt-12">
          <div className="panel p-8 rounded-3xl border border-(--border)">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-(--primary)" />
                <div>
                  <p className="label">Security</p>
                  <h2 className="text-2xl font-bold mt-1">Designed for trust and accountability.</h2>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="chip">Role-based access</span>
                <span className="chip">Audit logs</span>
                <span className="chip">Verified actions</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[
                {
                  title: "Role-based permissions",
                  desc: "Control what members can view and approve by role.",
                },
                {
                  title: "Audit trails",
                  desc: "Track payments, edits, approvals, and changes with timestamps.",
                },
                {
                  title: "Clear accountability",
                  desc: "Reduce disputes with shared visibility and record history.",
                },
              ].map((x) => (
                <div key={x.title} className="p-5 rounded-2xl border border-(--border) bg-white/60">
                  <p className="font-semibold">{x.title}</p>
                  <p className="text-sm text-(--muted) mt-2">{x.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto mt-12">
          <div className="panel p-8 rounded-3xl border border-(--border)">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <p className="label">Get started</p>
                <h3 className="text-2xl font-bold mt-2">Create a workspace in minutes.</h3>
                <p className="text-(--muted) mt-2 max-w-2xl">
                  Invite members, set rules, track contributions and loans, and keep governance transparent.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link to="/register" className="btn btn-primary">
                  Create organization
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="btn btn-outline">
                  View demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="max-w-6xl mx-auto mt-10 pt-8 border-t border-(--border)">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-10">
            <p className="text-sm text-(--muted)">
              © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-(--muted)">
              <a href="#security" className="hover:text-(--text)">Security</a>
              <a href="#features" className="hover:text-(--text)">Features</a>
              <Link to="/login" className="hover:text-(--text)">Sign in</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};



