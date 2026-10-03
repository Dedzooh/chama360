import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Download,
  HeartHandshake,
  Landmark,
  LogIn,
  PieChart,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Vote,
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { BrandLockup } from '../../components/BrandLogo';
import { trackCommercialEvent } from '../../utils/commercialFunnel';

const features = [
  {
    icon: Banknote,
    title: 'Contributions & payments',
    description: 'Members confirm their own M-Pesa and bank payments; treasurers reconcile from statements in one click.',
  },
  {
    icon: Landmark,
    title: 'Loans & guarantees',
    description: 'Structured loan applications with guarantor approval flows, repayment schedules, and live balances.',
  },
  {
    icon: HeartHandshake,
    title: 'Welfare funds',
    description: 'Configurable claim categories, limits, and committee approval for member support requests.',
  },
  {
    icon: CalendarCheck,
    title: 'Meetings & records',
    description: 'Schedule meetings, take attendance, and keep minutes attached to the group timeline.',
  },
  {
    icon: Vote,
    title: 'Transparent voting',
    description: 'Quorum-aware votes with clear outcomes — every decision documented and auditable.',
  },
  {
    icon: PieChart,
    title: 'Reports & statements',
    description: 'Member statements, group summaries, and exports treasurers can hand to auditors.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Create your chama',
    description: 'Set contribution rules, enable modules, and invite members by link or QR code.',
  },
  {
    step: '02',
    title: 'Members pay & confirm',
    description: 'Payments are submitted with proof, matched against statements, and settled automatically.',
  },
  {
    step: '03',
    title: 'Grow with confidence',
    description: 'Track loans, welfare, and investments with records every member can trust.',
  },
];

const trustStats = [
  { value: '24/7', label: 'Access anywhere', icon: Smartphone },
  { value: '100%', label: 'Auditable records', icon: ShieldCheck },
];

export const Splash = () => {
  useEffect(() => { trackCommercialEvent('LANDING_VISITED'); }, []);
  return (
    <main className="splash-page">
      <div className="splash-container">
        <section className="splash-hero" aria-labelledby="splash-title">
          <div className="splash-glow splash-glow-one" />
          <div className="splash-glow splash-glow-two" />

          <header className="splash-brand">
            <BrandLockup className="splash-brand-lockup" />
            <nav className="splash-nav" aria-label="Main navigation">
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <Link to={ROUTES.legal.centre}>Trust &amp; legal</Link>
            </nav>
            <Link to={ROUTES.auth.login} className="splash-nav-signin">Sign in <ArrowRight /></Link>
            <Link to={ROUTES.legal.download} className="splash-nav-menu" aria-label="Download CHAMAZ360">
              <Download aria-hidden="true" />
            </Link>
          </header>

          <div className="splash-hero-grid">
            <div className="splash-copy">
              <div className="splash-eyebrow">
                <CheckCircle2 aria-hidden="true" />
                Built for trusted savings groups
              </div>
              <h1 id="splash-title">Run your chama like a<br /><em>professional institution.</em></h1>
              <p>
                CHAMAZ360 unifies contributions, loans, welfare, meetings, and voting in one auditable
                platform — so treasurers stop chasing WhatsApp messages and members finally see the full picture.
              </p>

              <div className="splash-cta-row">
                <Link to={ROUTES.auth.login} className="splash-button splash-button-primary">
                  Sign in to continue
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link to={ROUTES.auth.register} className="splash-button splash-button-secondary">
                  <UserPlus aria-hidden="true" />
                  Create account
                </Link>
              </div>

              <div className="splash-trust-line">
                <ShieldCheck aria-hidden="true" />
                Private by design · Transparent by default · Built in Kenya
              </div>
            </div>

            <div className="splash-overview" aria-label="Platform highlights">
              <div className="splash-overview-head">
                <div>
                  <span>Live overview</span>
                  <strong>Your group, clear at a glance</strong>
                </div>
                <BarChart3 aria-hidden="true" />
              </div>
              <div className="splash-overview-stats">
                {trustStats.map(({ value, label, icon: Icon }) => (
                  <div className="splash-stat" key={label}>
                    <Icon aria-hidden="true" />
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="splash-feature-list">
                <span><CheckCircle2 /> Contributions &amp; loans</span>
                <span><CheckCircle2 /> Meetings &amp; governance</span>
                <span><CheckCircle2 /> Reports &amp; member records</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="splash-section" aria-label="Features">
          <div className="splash-section-head">
            <h2>Everything a chama needs, in one ledger</h2>
            <p>Purpose-built modules that work together — no spreadsheets, no lost WhatsApp threads.</p>
          </div>
          <div className="splash-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="splash-feature-card" key={title}>
                <span className="splash-feature-icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="splash-section" aria-label="How it works">
          <div className="splash-section-head">
            <h2>From signup to a fully reconciled month</h2>
            <p>Three steps — designed for treasurers who are volunteers, not accountants.</p>
          </div>
          <div className="splash-steps">
            {steps.map((item) => (
              <article className="splash-step" key={item.step}>
                <span className="splash-step-number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="splash-actions" aria-label="Quick actions">
          <Link className="splash-action splash-action-featured" to={ROUTES.auth.login}>
            <span className="splash-action-icon"><LogIn aria-hidden="true" /></span>
            <span className="splash-action-copy">
              <strong>Sign in</strong>
              <small>Access your chama workspace</small>
            </span>
            <ArrowRight className="splash-action-arrow" aria-hidden="true" />
          </Link>
          <Link className="splash-action" to={ROUTES.auth.register}>
            <span className="splash-action-icon"><UserPlus aria-hidden="true" /></span>
            <span className="splash-action-copy">
              <strong>Create account</strong>
              <small>Join CHAMAZ360 in minutes</small>
            </span>
            <ArrowRight className="splash-action-arrow" aria-hidden="true" />
          </Link>
          <Link className="splash-action" to={ROUTES.legal.download}>
            <span className="splash-action-icon"><Smartphone aria-hidden="true" /></span>
            <span className="splash-action-copy">
              <strong>Get the app</strong>
              <small>Android — everything, offline-tolerant</small>
            </span>
            <ArrowRight className="splash-action-arrow" aria-hidden="true" />
          </Link>
        </section>

        <footer className="splash-footer">
          <span>CHAMAZ360</span>
          <nav aria-label="Footer">
            <Link to={ROUTES.legal.centre}>Trust &amp; legal</Link>
            <Link to={ROUTES.legal.download}>Get the app</Link>
            <Link to={ROUTES.auth.login}>Sign in</Link>
          </nav>
          <span>Save · Grow · Govern · Support</span>
        </footer>
      </div>
    </main>
  );
};

