import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarClock, Check, Crown, Download, FileText, MessageSquareText, ShieldCheck, Smartphone, X } from 'lucide-react';
import { SETUP_SERVICES, SMS_CREDIT_PACKS, SUBSCRIPTION_PLANS, TRAINING_SERVICES, VAULT_ADDON, getPlanPrice } from '../../config/subscriptions';
import { ROUTES } from '../../config/routes';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import api from '../../config/api';
import { subscriptionService, type BillingOrganization } from '../../services/subscriptionService';

type BillingDocument = { id: string; documentNumber: string; type: string; status: string; total: string; currency: string; issuedAt: string };

export const Upgrade = () => {
  const state = useSubscriptionStore();
  const { organizationId, setOrganization, paymentStatus, checkPayment } = state;
  const [phone, setPhone] = useState('');
  const [smsPurchaseCredits, setSmsPurchaseCredits] = useState<100 | 500 | 1000 | null>(null);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [organizations, setOrganizations] = useState<BillingOrganization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState('');
  const [referral, setReferral] = useState<{ code: string; reward: string; referrals: Array<{ code: string; status: string; referredOrganization?: { name: string } | null }> } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [customServiceType, setCustomServiceType] = useState<'ASSISTED_SETUP' | 'DATA_MIGRATION' | 'OFFICIAL_TRAINING' | 'SMS_CREDITS' | 'CHAMA_VAULT' | 'ENTERPRISE_IMPLEMENTATION'>('ENTERPRISE_IMPLEMENTATION');
  const [customForm, setCustomForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', estimatedMembers: '', preferredTimeline: '', requirements: '' });
  const selectedPrice = state.pendingAmount;
  const selectedOrganization = organizations.find((organization) => organization.id === state.organizationId);

  useEffect(() => {
    let active = true;
    setOrganizationsLoading(true);
    subscriptionService.getBillingOrganizations()
      .then(({ organizations: available }) => {
        if (!active) return;
        setOrganizations(available);
        setOrganizationsError('');
        const selectedIsAvailable = available.some((organization) => organization.id === organizationId);
        if (!selectedIsAvailable) void setOrganization(available.length === 1 ? available[0].id : null);
      })
      .catch(() => { if (active) setOrganizationsError('Unable to load the Chamas you manage. Please refresh and try again.'); })
      .finally(() => { if (active) setOrganizationsLoading(false); });
    return () => { active = false; };
  }, [organizationId, setOrganization]);

  useEffect(() => {
    if (paymentStatus !== 'PROCESSING') return undefined;
    const timer = window.setInterval(() => void checkPayment(), 4000);
    return () => window.clearInterval(timer);
  }, [checkPayment, paymentStatus]);
  useEffect(() => { if (!state.organizationId) { setDocuments([]); return; } void api.get('/subscriptions/billing/documents', { params: { organizationId: state.organizationId } }).then((response) => setDocuments(response.data.documents)).catch(() => setDocuments([])); }, [state.organizationId, state.paymentStatus]);
  useEffect(() => { void api.get('/subscriptions/referrals/me').then((response) => setReferral(response.data)).catch(() => setReferral(null)); void api.post('/subscriptions/funnel-events', { eventType: 'PRICING_VIEWED', organizationId: state.organizationId || undefined }).catch(() => undefined); }, []);
  const downloadDocument = async (document: BillingDocument) => { const response = await api.get(`/subscriptions/billing/documents/${document.id}/pdf`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = window.document.createElement('a'); link.href = url; link.download = `${document.documentNumber}.pdf`; link.click(); URL.revokeObjectURL(url); };
  const submitCustomRequest = async () => {
    if (!state.organizationId) return;
    setCustomLoading(true); setCustomMessage('');
    try {
      const response = await api.post('/subscriptions/custom-request', { ...customForm, organizationId: state.organizationId, serviceType: customServiceType, estimatedMembers: customForm.estimatedMembers ? Number(customForm.estimatedMembers) : undefined });
      setCustomMessage(response.data.message);
    } catch (requestError: any) {
      setCustomMessage(requestError?.response?.data?.error?.message ?? 'Unable to send your requirements. Please try again.');
    } finally { setCustomLoading(false); }
  };
  const purchaseSmsCredits = async () => {
    if (!state.organizationId || !smsPurchaseCredits || phone.trim().length < 9) return;
    setCustomLoading(true); setCustomMessage('');
    try {
      const response = await subscriptionService.purchaseSmsCredits(state.organizationId, smsPurchaseCredits, phone);
      setCustomMessage(response.customerMessage); setSmsPurchaseCredits(null);
    } catch (purchaseError: any) {
      setCustomMessage(purchaseError?.response?.data?.error?.message ?? 'Unable to start SMS credit checkout.');
    } finally { setCustomLoading(false); }
  };

  return <div className="subscription-page">
    <section className="subscription-hero"><span><Crown /> CHAMAZ360 plans</span><h1>Choose the operating package your organization needs</h1><p>Start with practical Chama operations, then upgrade for records, governance, automation, or a tailored enterprise engagement. Annual billing saves roughly two months.</p></section>
    <section className="subscription-organization-picker" aria-labelledby="billing-organization-title">
      <div className="subscription-organization-icon"><Building2 /></div>
      <div>
        <p>Organization subscription</p>
        <h2 id="billing-organization-title">Which Chama are you purchasing for?</h2>
        <small>Choose the chama receiving the features. Your other chamas keep their own plans.</small>
      </div>
      <label>
        <span>Select Chama</span>
        <select value={state.organizationId ?? ''} disabled={organizationsLoading || !organizations.length || state.paymentStatus === 'PROCESSING'} onChange={(event) => void state.setOrganization(event.target.value || null)}>
          <option value="">{organizationsLoading ? 'Loading your Chamas…' : 'Choose a Chama'}</option>
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.roleLabel ?? organization.role}</option>)}
        </select>
      </label>
      {selectedOrganization ? <div className="subscription-organization-selection"><Check /><span><strong>{selectedOrganization.name}</strong><small>{selectedOrganization.memberCount} active members · Currently on {selectedOrganization.subscription.plan} · Purchase applies only to this chama</small></span></div> : null}
      {!organizationsLoading && !organizationsError && !organizations.length ? <p className="subscription-organization-empty">You do not currently administer a Chama. Create a Chama or ask its founder to give you an administrator role before purchasing a plan.</p> : null}
      {organizationsError ? <p className="subscription-organization-empty" role="alert">{organizationsError}</p> : null}
    </section>
    <div className="billing-cycle-toggle" role="group" aria-label="Billing period"><button type="button" className={state.billingCycle === 'MONTHLY' ? 'is-active' : ''} onClick={() => state.setBillingCycle('MONTHLY')}>Monthly</button><button type="button" className={state.billingCycle === 'ANNUAL' ? 'is-active' : ''} onClick={() => state.setBillingCycle('ANNUAL')}>Annual <small>Save 2 months</small></button></div>
    {state.message ? <div className="success-banner px-4 py-3 text-sm">{state.message}</div> : null}
    {!state.organizationId ? <section className="subscription-status is-warning"><AlertTriangle /><div><strong>Select a chama to subscribe</strong><p>Plans are purchased for the whole chama and managed by its administrators.</p></div></section> : null}
    {state.plan !== 'FREE' ? <section className={`subscription-status ${state.inGracePeriod || state.trialEndsAt ? 'is-warning' : ''}`}>
      {state.inGracePeriod ? <AlertTriangle /> : <CalendarClock />}
      <div><strong>{state.trialEndsAt ? `Your ${state.plan} trial ends in ${Math.max(0, state.daysRemaining ?? 0)} day${state.daysRemaining === 1 ? '' : 's'}` : state.inGracePeriod ? 'Renew now to keep premium access' : `${state.plan} plan is active`}</strong><p>{state.trialEndsAt ? 'Upgrade before the trial ends to keep Growth tools.' : state.currentPeriodEnd ? `${state.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal is due'} ${new Date(state.currentPeriodEnd).toLocaleDateString()}` : `${state.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'} subscription`}{!state.trialEndsAt && state.daysRemaining !== null ? ` · ${Math.max(0, state.daysRemaining)} day${state.daysRemaining === 1 ? '' : 's'} remaining` : ''}</p></div>
      <button type="button" disabled={state.loading} onClick={() => void (state.cancelAtPeriodEnd ? state.resumeSubscription() : state.cancelSubscription())}>{state.cancelAtPeriodEnd ? 'Keep subscription' : 'Cancel at period end'}</button>
    </section> : null}
    {state.organizationId && state.pendingPlan ? <div className="success-banner px-4 py-3 text-sm">Your {state.pendingPlan} upgrade request for {selectedOrganization?.name ?? 'this Chama'} is pending secure checkout.</div> : null}
    {state.organizationId && state.pendingPlan && state.pendingRequestId ? <section className="subscription-checkout" aria-labelledby="mpesa-checkout-title">
      <div><Smartphone /><div><h2 id="mpesa-checkout-title">Pay with M-Pesa</h2><p>KES {selectedPrice?.toLocaleString()} for {state.billingCycle === 'ANNUAL' ? 'one year' : 'one month'} of {state.pendingPlan}. The prompt is sent only after you confirm below.</p></div></div>
      <label>Kenyan mobile number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={state.loading || state.paymentStatus === 'PROCESSING'} /></label>
      <button type="button" disabled={state.loading || state.paymentStatus === 'PROCESSING' || phone.trim().length < 9} onClick={() => void state.checkout(phone)}>{state.paymentStatus === 'PROCESSING' ? 'Waiting for M-Pesa confirmation…' : `Send M-Pesa prompt · KES ${selectedPrice?.toLocaleString()}`}</button>
      <small>Confirm the business name and amount on your phone before entering your PIN. CHAMAZ360 never asks for or stores your M-Pesa PIN.</small>
    </section> : null}
    <section className="subscription-grid">{SUBSCRIPTION_PLANS.map((plan) => {
      const price = getPlanPrice(plan, state.billingCycle, selectedOrganization?.memberCount);
      const annualSavings = plan.monthlyPrice ? plan.monthlyPrice * 12 - plan.annualPrice : 0;
      return <article key={plan.id} className={plan.popular ? 'is-popular' : ''}>{plan.popular ? <span className="subscription-popular">Recommended</span> : null}<h2>{plan.name}</h2><p>{plan.description}</p>{plan.id === 'ENTERPRISE' ? <strong>Tailored quote<small> setup + subscription</small></strong> : <><strong>KES {price.toLocaleString()}<small>{plan.monthlyPrice ? (state.billingCycle === 'ANNUAL' ? '/year' : '/month') : ' forever free'}</small></strong>{state.billingCycle === 'ANNUAL' && annualSavings ? <em className="subscription-savings">Save KES {annualSavings.toLocaleString()} · almost 2 months free</em> : null}</>}<ul>{plan.features.map((item) => <li key={item}><Check /> {item}</li>)}<li><Check /> Storage: {plan.storage.label}</li></ul><button type="button" disabled={!state.organizationId || state.loading || (state.plan === plan.id && (state.daysRemaining === null || state.daysRemaining > 7)) || plan.id === 'FREE'} onClick={() => { if (plan.id === 'ENTERPRISE') { setCustomOpen(true); return; } void api.post('/subscriptions/funnel-events', { eventType: 'CHECKOUT_STARTED', organizationId: state.organizationId || undefined, plan: plan.id, billingCycle: state.billingCycle }).catch(() => undefined); void state.requestPlan(plan.id); }}>{plan.id === 'ENTERPRISE' ? 'Contact CHAMAZ360' : state.plan === plan.id ? (state.daysRemaining !== null && state.daysRemaining <= 7 ? `Renew ${plan.name}` : 'Current plan') : `Choose ${plan.name}`}</button></article>;
    })}</section>
    {referral ? <section className="section-shell p-5"><div className="section-header"><p>Growth program</p><h2>Refer a Chama</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Share your code with another organization. When it purchases an annual plan, you receive one month free.</p></div><div className="mt-4 flex flex-wrap items-center gap-3"><strong className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] px-4 py-3 text-lg tracking-[0.14em] text-[var(--ds-secondary)]">{referral.code}</strong><button type="button" className="btn btn-outline" onClick={() => void navigator.clipboard?.writeText(referral.code)}>Copy code</button></div>{referral.referrals.length ? <div className="mt-4 space-y-2 text-sm text-[var(--ds-text-muted)]">{referral.referrals.slice(0, 5).map((item) => <p key={item.code}>{item.referredOrganization?.name ?? item.code} · {item.status}</p>)}</div> : null}</section> : null}
    <section className="section-shell p-5" aria-labelledby="services-title">
      <div className="section-header"><p>Optional services and usage</p><h2 id="services-title">Pay for the work and capacity you actually need</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Core security, access control, transaction integrity, basic auditability, and each member's own financial information remain protected for every plan.</p></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4"><h3 className="font-black text-[var(--ds-secondary)]">CHAMAZ360 Assisted Setup</h3><div className="mt-3 space-y-3">{SETUP_SERVICES.map((service) => <button key={service.name} type="button" className="block w-full text-left" onClick={() => { setCustomServiceType(service.name === 'Data Migration + Setup' ? 'DATA_MIGRATION' : service.name === 'Enterprise Implementation' ? 'ENTERPRISE_IMPLEMENTATION' : 'ASSISTED_SETUP'); setCustomOpen(true); }}><strong className="text-sm text-[var(--ds-secondary)]">{service.name} · {service.price}</strong><span className="mt-1 block text-xs text-[var(--ds-text-muted)]">{service.description}</span></button>)}</div></div>
        <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4"><h3 className="font-black text-[var(--ds-secondary)]">CHAMAZ360 Official Training</h3><div className="mt-3 space-y-3">{TRAINING_SERVICES.map((service) => <button key={service.name} type="button" className="block w-full text-left" onClick={() => { setCustomServiceType('OFFICIAL_TRAINING'); setCustomOpen(true); }}><strong className="text-sm text-[var(--ds-secondary)]">{service.name} · {service.price}</strong><span className="mt-1 block text-xs text-[var(--ds-text-muted)]">Available separately from subscription.</span></button>)}</div></div>
        <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] p-4"><h3 className="font-black text-[var(--ds-secondary)]">Usage and continuity</h3><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Email and in-app notifications remain included. SMS is sold as usage-based credits, and M-Pesa automation stays a transparent Pro subscription feature with no CHAMAZ360 percentage fee.</p><div className="mt-3 space-y-2">{SMS_CREDIT_PACKS.map((pack) => <button key={pack.credits} type="button" className="block w-full text-left text-sm font-bold text-[var(--ds-primary)]" onClick={() => setSmsPurchaseCredits(pack.credits as 100 | 500 | 1000)}>{pack.credits.toLocaleString()} SMS credits · {pack.price}</button>)}<button type="button" className="mt-2 block w-full text-left" onClick={() => { setCustomServiceType('CHAMA_VAULT'); setCustomOpen(true); }}><strong className="text-sm text-[var(--ds-secondary)]">{VAULT_ADDON.name} · {VAULT_ADDON.price}</strong><span className="mt-1 block text-xs text-[var(--ds-text-muted)]">{VAULT_ADDON.description}</span></button></div></div>
      </div>
      <div className="mt-5 rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-4"><strong className="text-sm text-[var(--ds-secondary)]">Refer a Chama</strong><p className="mt-1 text-sm text-[var(--ds-text-muted)]">Referral rewards can be tracked against annual paid conversions. Contact CHAMAZ360 to register a referral and eligibility.</p></div>
    </section>
    {smsPurchaseCredits ? <section className="section-shell p-5" aria-labelledby="sms-purchase-title"><div className="section-header"><p>SMS usage credits</p><h2 id="sms-purchase-title">Buy {smsPurchaseCredits.toLocaleString()} SMS credits</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">Enter the Kenyan mobile number that should receive the M-Pesa prompt. Credits are added only after the payment callback is verified.</p></div><div className="mt-4 flex flex-wrap gap-3"><input className="input" type="tel" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} /><button type="button" className="btn btn-primary" disabled={customLoading || phone.trim().length < 9} onClick={() => void purchaseSmsCredits()}>{customLoading ? 'Sending prompt…' : 'Send M-Pesa prompt'}</button><button type="button" className="btn btn-outline" onClick={() => setSmsPurchaseCredits(null)}>Cancel</button></div>{customMessage ? <p className="mt-3 text-sm font-semibold" role="status">{customMessage}</p> : null}</section> : null}
    {customOpen ? <section className="section-shell p-5" aria-labelledby="custom-package-title">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--ds-primary)]">Custom / Enterprise engagement</p><h2 id="custom-package-title" className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">Setup plus ongoing subscription</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">For large Chamas, welfare associations, investment groups, SACCO-like organizations, church and alumni groups, staff welfare programs, and multi-branch organizations. We scope setup, migration, onboarding, integrations, support, and the recurring subscription together before quoting.</p></div><button type="button" aria-label="Close custom package form" onClick={() => setCustomOpen(false)}><X /></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>Requested service<select className="input mt-1 w-full" value={customServiceType} onChange={(event) => setCustomServiceType(event.target.value as typeof customServiceType)}><option value="ASSISTED_SETUP">Assisted setup</option><option value="DATA_MIGRATION">Data migration + setup</option><option value="OFFICIAL_TRAINING">Official training</option><option value="SMS_CREDITS">SMS credits</option><option value="CHAMA_VAULT">Chama Vault</option><option value="ENTERPRISE_IMPLEMENTATION">Enterprise implementation</option></select></label>
        <label>Contact name<input className="input mt-1 w-full" value={customForm.contactName} onChange={(event) => setCustomForm({ ...customForm, contactName: event.target.value })} /></label>
        <label>Work email<input className="input mt-1 w-full" type="email" value={customForm.contactEmail} onChange={(event) => setCustomForm({ ...customForm, contactEmail: event.target.value })} /></label>
        <label>Phone number<input className="input mt-1 w-full" type="tel" value={customForm.contactPhone} onChange={(event) => setCustomForm({ ...customForm, contactPhone: event.target.value })} /></label>
        <label>Estimated members<input className="input mt-1 w-full" type="number" min="1" value={customForm.estimatedMembers} onChange={(event) => setCustomForm({ ...customForm, estimatedMembers: event.target.value })} /></label>
        <label className="sm:col-span-2">Preferred timeline<input className="input mt-1 w-full" placeholder="For example: launch within 8 weeks" value={customForm.preferredTimeline} onChange={(event) => setCustomForm({ ...customForm, preferredTimeline: event.target.value })} /></label>
        <label className="sm:col-span-2">Requirements<textarea className="input mt-1 min-h-36 w-full" placeholder="Describe the type of Chama, workflows, approvals, reports, payment integrations, branches, roles, and any special requirements." value={customForm.requirements} onChange={(event) => setCustomForm({ ...customForm, requirements: event.target.value })} /></label>
      </div>
      <button className="mt-5 inline-flex items-center gap-2" type="button" disabled={customLoading || customForm.contactName.trim().length < 2 || !customForm.contactEmail.includes('@') || customForm.requirements.trim().length < 20} onClick={() => void submitCustomRequest()}><MessageSquareText /> {customLoading ? 'Sending requirements…' : 'Send requirements to CHAMAZ360'}</button>
      {customMessage ? <p className="mt-3 text-sm font-semibold text-[var(--ds-secondary)]" role="status">{customMessage}</p> : null}
    </section> : null}
    {state.organizationId ? <section className="section-shell billing-history"><div className="section-header"><p>Invoices and receipts</p><h2>Billing history</h2></div><div className="section-body">{documents.length ? <div className="billing-document-list">{documents.map((document) => <article key={document.id}><FileText/><span><strong>{document.documentNumber}</strong><small>{document.type} · {new Date(document.issuedAt).toLocaleDateString()}</small></span><b>{document.currency} {Number(document.total).toLocaleString()}</b><em className={`billing-status status-${document.status.toLowerCase()}`}>{document.status}</em><button type="button" onClick={() => void downloadDocument(document)}><Download/> PDF</button></article>)}</div> : <p className="empty-copy">Invoices and receipts will appear here when a plan is selected.</p>}</div></section> : null}
    <div className="subscription-trust"><ShieldCheck /> One clear chama subscription, secure checkout, and no charge without confirmation. <Link to={`${ROUTES.legal.centre}#billing`}>Billing and refund terms</Link></div>
  </div>;
};

