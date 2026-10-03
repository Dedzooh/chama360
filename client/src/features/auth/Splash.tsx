import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  LogIn,
  Plus,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Download,
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { BrandLockup } from '../../components/BrandLogo';
import { trackCommercialEvent } from '../../utils/commercialFunnel';

const highlights = [
  { value: '24/7', label: 'Access anywhere', icon: Smartphone },
  { value: 'Secure', label: 'Protected records', icon: ShieldCheck },
];

const actions = [
  {
    label: 'Sign in',
    description: 'Access your chama workspace',
    to: ROUTES.auth.login,
    icon: LogIn,
  },
  {
    label: 'Create account',
    description: 'Join CHAMAZ360 in minutes',
    to: ROUTES.auth.register,
    icon: UserPlus,
  },
  {
    label: 'Start a Chama',
    description: 'Sign in, then create your group',
    to: ROUTES.auth.login,
    icon: Plus,
  },
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
              <Link to={ROUTES.legal.centre}>Trust &amp; legal</Link>
              <Link to={ROUTES.legal.download}>Get the app</Link>
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
              <h1 id="splash-title">Build wealth.<br /><em>Together.</em></h1>
              <p>
                One trusted platform for contributions, loans, welfare, meetings, and transparent group decisions—built for modern African communities.
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
                {highlights.map(({ value, label, icon: Icon }) => (
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

        <section id="features" className="splash-actions" aria-label="Quick actions">
          {actions.map(({ label, description, to, icon: Icon }, index) => (
            <Link className={`splash-action${index === 0 ? ' splash-action-featured' : ''}`} to={to} key={label}>
              <span className="splash-action-icon"><Icon aria-hidden="true" /></span>
              <span className="splash-action-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight className="splash-action-arrow" aria-hidden="true" />
            </Link>
          ))}
        </section>

        <section className="splash-proof" aria-label="Platform promise">
          <div><strong>One source of truth</strong><span>Every contribution, decision, and member record in one place.</span></div>
          <div><strong>Made for real groups</strong><span>Flexible workflows for savings, welfare, loans, and investments.</span></div>
          <Link to={ROUTES.legal.download}><Download /> Download Android app <ArrowRight /></Link>
        </section>

        <footer className="splash-footer">
          <span>CHAMAZ360</span>
          <span>Save · Grow · Govern · Support</span>
        </footer>
      </div>
    </main>
  );
};

