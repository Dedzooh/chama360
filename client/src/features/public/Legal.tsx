import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { PublicPageFrame } from '../../components/PublicPageFrame';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@chamaz360.co.ke';
const updated = '14 July 2026';

export const Legal = () => (
  <PublicPageFrame
    eyebrow="Legal and support centre"
    title="Clear rules for using CHAMA360"
    description={`Last updated ${updated}. These documents explain account use, subscriptions, payments, privacy, and support.`}
    navigation={<nav className="flex flex-wrap gap-2" aria-label="Legal sections">
        <Link className="btn btn-outline" to={ROUTES.legal.download}>Download Android app</Link>
        <a className="btn btn-outline" href="#terms">Terms</a><a className="btn btn-outline" href="#privacy">Privacy</a><a className="btn btn-outline" href="#deletion">Account deletion</a><a className="btn btn-outline" href="#billing">Billing & refunds</a><a className="btn btn-outline" href="#support">Support</a>
      </nav>}
  >
      <div className="space-y-5">
        <section id="terms" className="section-shell p-6 sm:p-8"><h2 className="text-2xl font-black text-[var(--ds-secondary)]">Terms of Service</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ds-text-muted)]">
          <p>CHAMA360 provides record-keeping, communication, governance, reporting, and payment-support tools for Chamas and other organizations. It does not promise investment returns, replace professional financial or legal advice, or hold itself out as a bank.</p>
          <p>You must provide accurate information, protect your credentials, and use only accounts and organizations you are authorized to manage. Organization administrators are responsible for member permissions, approvals, uploaded records, internal rules, and the accuracy of entries made by their users.</p>
          <p>Users must not misuse the service for fraud, unlawful activity, unauthorized access, harassment, or manipulation of financial and governance records. Access may be restricted where necessary to protect users, comply with law, investigate abuse, or maintain the service.</p>
          <p>The service may change as features, providers, regulations, and security requirements evolve. Material changes will be communicated through the app or registered contact details.</p>
        </div></section>

        <section id="privacy" className="section-shell p-6 sm:p-8"><h2 className="text-2xl font-black text-[var(--ds-secondary)]">Privacy Policy</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ds-text-muted)]">
          <p>We process account identity, contact details, organization membership, financial records, governance activity, device/session data, support communications, and documents that users choose to provide. We use this information to operate and secure CHAMA360, deliver requested features, process subscriptions, provide support, prevent abuse, and meet legal obligations.</p>
          <p>Information may be shared with authorized organization members, contracted infrastructure and communication providers, payment providers such as M-Pesa, professional advisers, or public authorities where lawfully required. We do not sell personal data.</p>
          <p>We retain information only for operational, contractual, security, audit, dispute, and legal purposes. Safeguards include access controls, authenticated sessions, audit records, and protected provider credentials. No internet service can guarantee absolute security.</p>
          <p>Subject to applicable law, individuals may request access, correction, objection or restriction, deletion where retention is not required, and information about relevant data transfers. Contact us using the address below. Kenyan users may also contact the Office of the Data Protection Commissioner.</p>
        </div></section>

        <section id="deletion" className="section-shell p-6 sm:p-8"><h2 className="text-2xl font-black text-[var(--ds-secondary)]">Account deletion</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ds-text-muted)]">
          <p>Signed-in users can request account deletion from Profile and Security after confirming their current password. Providing a reason is optional. Access is disabled immediately and authenticated sessions are revoked when the request is accepted.</p>
          <p>Account profile and identity data will be deleted or anonymized under the published retention schedule. Financial transactions, disputes, security events, and audit records may be retained where needed to meet legal obligations, prevent fraud, resolve claims, and preserve the integrity of organization records. Retained records are restricted from ordinary account use.</p>
          <p>If you cannot sign in, contact support from the email address registered to the account. We will verify account ownership before processing the request.</p>
        </div></section>

        <section id="billing" className="section-shell p-6 sm:p-8"><h2 className="text-2xl font-black text-[var(--ds-secondary)]">Subscriptions, cancellation and refunds</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ds-text-muted)]">
          <p>Paid plans apply to the selected organization for the displayed billing period. The amount and organization are shown before an M-Pesa request is sent. CHAMA360 never asks for or stores an M-Pesa PIN.</p>
          <p>Cancellation stops renewal at the end of the paid period; access remains available until that date unless suspended for misuse or legal reasons. Downgrading may limit premium features, member capacity, automation, and exports.</p>
          <p>Refund requests are reviewed for duplicate charges, incorrect amounts, failed activation after confirmed payment, or other valid service issues. Approved refunds are recorded using a traceable reversal reference and credit note. Completed service periods, custom work already delivered, and charges caused by inaccurate user instructions may not be refundable except where required by law.</p>
          <p>Custom packages are quoted separately after requirements review. Scope, delivery milestones, support, fees, taxes, and cancellation terms must be agreed before custom implementation begins.</p>
        </div></section>

        <section id="support" className="section-shell p-6 sm:p-8"><h2 className="text-2xl font-black text-[var(--ds-secondary)]">Support and complaints</h2><div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ds-text-muted)]"><p>Email <a className="font-bold text-[var(--ds-primary)]" href={`mailto:${supportEmail}`}>{supportEmail}</a> with your organization name, account email, issue description, and relevant transaction reference. Never send passwords or M-Pesa PINs.</p><p>Payment and privacy complaints will be acknowledged, investigated using available audit records, and escalated where appropriate. Emergency access or suspected fraud should be reported immediately.</p></div></section>
      </div>
      <p className="mt-6 text-center text-xs text-[var(--ds-text-muted)]">Launch note: final business identity, regulatory registration details, physical address, and legal-counsel approval must be inserted before public release.</p>
  </PublicPageFrame>
);

