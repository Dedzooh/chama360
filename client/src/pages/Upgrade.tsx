import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarClock, Check, Crown, Download, FileText, MessageSquareText, ShieldCheck, Smartphone, X } from 'lucide-react';
import { SUBSCRIPTION_PLANS, getPlanPrice } from '../config/subscriptions';
import { ROUTES } from '../config/routes';
import { useSubscriptionStore } from '../store/subscriptionStore';
import api from '../config/api';
import { subscriptionService, type BillingOrganization } from '../services/subscriptionService';

type BillingDocument = { id: string; documentNumber: string; type: string; status: string; total: string; currency: string; issuedAt: string };

export const Upgrade = () => {
  const state = useSubscriptionStore();
  const { organizationId, setOrganization, paymentStatus, checkPayment } = state;
  const [phone, setPhone] = useState('');
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [organizations, setOrganizations] = useState<BillingOrganization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
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
  const downloadDocument = async (document: BillingDocument) => { const response = await api.get(`/subscriptions/billing/documents/${document.id}/pdf`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = window.document.createElement('a'); link.href = url; link.download = `${document.documentNumber}.pdf`; link.click(); URL.revokeObjectURL(url); };
  const submitCustomRequest = async () => {
    if (!state.organizationId) return;
    setCustomLoading(true); setCustomMessage('');
    try {
      const response = await api.post('/subscriptions/custom-request', { ...customForm, organizationId: state.organizationId, estimatedMembers: customForm.estimatedMembers ? Number(customForm.estimatedMembers) : undefined });
      setCustomMessage(response.data.message);
    } catch (requestError: any) {
      setCustomMessage(requestError?.response?.data?.error?.message ?? 'Unable to send your requirements. Please try again.');
    } finally { setCustomLoading(false); }
  };

  return <div className="subscription-page">
    <section className="subscription-hero"><span><Crown /> CHAMA360 plans</span><h1>Choose the tools your chama needs</h1><p>One subscription covers the whole chama. Members use the features paid for by that chama. Choose monthly flexibility or save two months with annual billing.</p></section>
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
    {state.plan !== 'FREE' ? <section className={`subscription-status ${state.inGracePeriod ? 'is-warning' : ''}`}>
      {state.inGracePeriod ? <AlertTriangle /> : <CalendarClock />}
      <div><strong>{state.inGracePeriod ? 'Renew now to keep premium access' : `${state.plan} plan is active`}</strong><p>{state.currentPeriodEnd ? `${state.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal is due'} ${new Date(state.currentPeriodEnd).toLocaleDateString()}` : `${state.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'} subscription`}{state.daysRemaining !== null ? ` · ${Math.max(0, state.daysRemaining)} day${state.daysRemaining === 1 ? '' : 's'} remaining` : ''}</p></div>
      <button type="button" disabled={state.loading} onClick={() => void (state.cancelAtPeriodEnd ? state.resumeSubscription() : state.cancelSubscription())}>{state.cancelAtPeriodEnd ? 'Keep subscription' : 'Cancel at period end'}</button>
    </section> : null}
    {state.organizationId && state.pendingPlan ? <div className="success-banner px-4 py-3 text-sm">Your {state.pendingPlan} upgrade request for {selectedOrganization?.name ?? 'this Chama'} is pending secure checkout.</div> : null}
    {state.organizationId && state.pendingPlan && state.pendingRequestId ? <section className="subscription-checkout" aria-labelledby="mpesa-checkout-title">
      <div><Smartphone /><div><h2 id="mpesa-checkout-title">Pay with M-Pesa</h2><p>KES {selectedPrice?.toLocaleString()} for {state.billingCycle === 'ANNUAL' ? 'one year' : 'one month'} of {state.pendingPlan}. The prompt is sent only after you confirm below.</p></div></div>
      <label>Kenyan mobile number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={state.loading || state.paymentStatus === 'PROCESSING'} /></label>
      <button type="button" disabled={state.loading || state.paymentStatus === 'PROCESSING' || phone.trim().length < 9} onClick={() => void state.checkout(phone)}>{state.paymentStatus === 'PROCESSING' ? 'Waiting for M-Pesa confirmation…' : `Send M-Pesa prompt · KES ${selectedPrice?.toLocaleString()}`}</button>
      <small>Confirm the business name and amount on your phone before entering your PIN. CHAMA360 never asks for or stores your M-Pesa PIN.</small>
    </section> : null}
    <section className="subscription-grid">{SUBSCRIPTION_PLANS.map((plan) => {
      const price = getPlanPrice(plan, state.billingCycle, selectedOrganization?.memberCount);
      return <article key={plan.id} className={plan.popular ? 'is-popular' : ''}>{plan.popular ? <span className="subscription-popular">Recommended</span> : null}<h2>{plan.name}</h2><p>{plan.description}</p>{plan.id === 'ENTERPRISE' ? <strong>Tailored quote<small> based on requirements</small></strong> : <strong>KES {price.toLocaleString()}<small>{plan.monthlyPrice ? (state.billingCycle === 'ANNUAL' ? '/year' : '/month') : ' forever free'}</small></strong>}<ul>{plan.features.map((item) => <li key={item}><Check /> {item}</li>)}</ul><button type="button" disabled={!state.organizationId || state.loading || (state.plan === plan.id && (state.daysRemaining === null || state.daysRemaining > 7)) || plan.id === 'FREE'} onClick={() => plan.id === 'ENTERPRISE' ? setCustomOpen(true) : void state.requestPlan(plan.id)}>{plan.id === 'ENTERPRISE' ? 'Contact CHAMA360' : state.plan === plan.id ? (state.daysRemaining !== null && state.daysRemaining <= 7 ? `Renew ${plan.name}` : 'Current plan') : `Choose ${plan.name}`}</button></article>;
    })}</section>
    {customOpen ? <section className="section-shell p-5" aria-labelledby="custom-package-title">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--ds-primary)]">Custom organization package</p><h2 id="custom-package-title" className="mt-1 text-2xl font-black text-[var(--ds-secondary)]">Tell us what your Chama needs</h2><p className="mt-2 text-sm text-[var(--ds-text-muted)]">CHAMA360 will review your structure, workflows, integrations, member capacity, and support requirements before providing a scope and quote.</p></div><button type="button" aria-label="Close custom package form" onClick={() => setCustomOpen(false)}><X /></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>Contact name<input className="input mt-1 w-full" value={customForm.contactName} onChange={(event) => setCustomForm({ ...customForm, contactName: event.target.value })} /></label>
        <label>Work email<input className="input mt-1 w-full" type="email" value={customForm.contactEmail} onChange={(event) => setCustomForm({ ...customForm, contactEmail: event.target.value })} /></label>
        <label>Phone number<input className="input mt-1 w-full" type="tel" value={customForm.contactPhone} onChange={(event) => setCustomForm({ ...customForm, contactPhone: event.target.value })} /></label>
        <label>Estimated members<input className="input mt-1 w-full" type="number" min="1" value={customForm.estimatedMembers} onChange={(event) => setCustomForm({ ...customForm, estimatedMembers: event.target.value })} /></label>
        <label className="sm:col-span-2">Preferred timeline<input className="input mt-1 w-full" placeholder="For example: launch within 8 weeks" value={customForm.preferredTimeline} onChange={(event) => setCustomForm({ ...customForm, preferredTimeline: event.target.value })} /></label>
        <label className="sm:col-span-2">Requirements<textarea className="input mt-1 min-h-36 w-full" placeholder="Describe the type of Chama, workflows, approvals, reports, payment integrations, branches, roles, and any special requirements." value={customForm.requirements} onChange={(event) => setCustomForm({ ...customForm, requirements: event.target.value })} /></label>
      </div>
      <button className="mt-5 inline-flex items-center gap-2" type="button" disabled={customLoading || customForm.contactName.trim().length < 2 || !customForm.contactEmail.includes('@') || customForm.requirements.trim().length < 20} onClick={() => void submitCustomRequest()}><MessageSquareText /> {customLoading ? 'Sending requirements…' : 'Send requirements to CHAMA360'}</button>
      {customMessage ? <p className="mt-3 text-sm font-semibold text-[var(--ds-secondary)]" role="status">{customMessage}</p> : null}
    </section> : null}
    {state.organizationId ? <section className="section-shell billing-history"><div className="section-header"><p>Invoices and receipts</p><h2>Billing history</h2></div><div className="section-body">{documents.length ? <div className="billing-document-list">{documents.map((document) => <article key={document.id}><FileText/><span><strong>{document.documentNumber}</strong><small>{document.type} · {new Date(document.issuedAt).toLocaleDateString()}</small></span><b>{document.currency} {Number(document.total).toLocaleString()}</b><em className={`billing-status status-${document.status.toLowerCase()}`}>{document.status}</em><button type="button" onClick={() => void downloadDocument(document)}><Download/> PDF</button></article>)}</div> : <p className="empty-copy">Invoices and receipts will appear here when a plan is selected.</p>}</div></section> : null}
    <div className="subscription-trust"><ShieldCheck /> One clear chama subscription, secure checkout, and no charge without confirmation. <Link to={`${ROUTES.legal.centre}#billing`}>Billing and refund terms</Link></div>
  </div>;
};
