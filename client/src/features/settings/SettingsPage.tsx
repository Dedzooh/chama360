import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, BellRing, CreditCard, HeartHandshake, Layers3, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { getModuleLabel } from '../../config/chamaBlueprint';
import { documentsToText, getEnabledWelfareCategories, normalizeWelfareRules, textToDocuments, WELFARE_APPROVAL_OPTIONS, type WelfareCategoryRule, type WelfareRulesConfig } from '../../config/welfareRules';
import { Badge, Button, Card, ConfirmDialog, EmptyState, SelectField, TextField } from '../../design-system';

type OrganizationMetadata = {
  paymentSettings?: {
    mode?: 'MPESA_NUMBER' | 'PAYBILL';
    mpesaNumber?: string;
    paybillNumber?: string;
    accountNumber?: string;
    accountReference?: string;
    transactionDesc?: string;
    isEnabled?: boolean;
  };
  notificationSettings?: {
    sms?: boolean;
    email?: boolean;
    inApp?: boolean;
  };
  welfareRules?: WelfareRulesConfig;
};

type SettingsSnapshot = {
  form: { name: string; description: string };
  paymentForm: {
    mode: 'MPESA_NUMBER' | 'PAYBILL';
    mpesaNumber: string;
    paybillNumber: string;
    accountNumber: string;
    accountReference: string;
    transactionDesc: string;
    isEnabled: boolean;
  };
  notificationForm: { sms: boolean; email: boolean; inApp: boolean };
  welfareForm: WelfareRulesConfig;
};

export const Settings = () => {
  const { currentOrganization, refreshOrganizations } = useOrganizationWorkspace();
  const [form, setForm] = useState({ name: '', description: '' });
  const [paymentForm, setPaymentForm] = useState({
    mode: 'MPESA_NUMBER' as 'MPESA_NUMBER' | 'PAYBILL',
    mpesaNumber: '',
    paybillNumber: '',
    accountNumber: '',
    accountReference: '',
    transactionDesc: '',
    isEnabled: true,
  });
  const [notificationForm, setNotificationForm] = useState({
    sms: true,
    email: true,
    inApp: true,
  });
  const [welfareForm, setWelfareForm] = useState<WelfareRulesConfig>(() => normalizeWelfareRules(undefined, true));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'payments' | 'welfare' | 'notifications'>('overview');
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsSnapshot | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'SUSPENDED' | 'CLOSED' | 'ARCHIVED' | null>(null);

  useEffect(() => {
    const metadata = (currentOrganization?.metadata ?? {}) as OrganizationMetadata;
    setForm({
      name: currentOrganization?.name ?? '',
      description: currentOrganization?.description ?? '',
    });
    setPaymentForm({
      mode: metadata.paymentSettings?.mode ?? 'MPESA_NUMBER',
      mpesaNumber: metadata.paymentSettings?.mpesaNumber ?? '',
      paybillNumber: metadata.paymentSettings?.paybillNumber ?? '',
      accountNumber: metadata.paymentSettings?.accountNumber ?? '',
      accountReference: metadata.paymentSettings?.accountReference ?? '',
      transactionDesc: metadata.paymentSettings?.transactionDesc ?? '',
      isEnabled: metadata.paymentSettings?.isEnabled ?? true,
    });
    setNotificationForm({
      sms: metadata.notificationSettings?.sms ?? true,
      email: metadata.notificationSettings?.email ?? true,
      inApp: metadata.notificationSettings?.inApp ?? true,
    });
    const nextWelfareForm = normalizeWelfareRules(metadata.welfareRules, Boolean(currentOrganization?.enabledModules?.welfare));
    setWelfareForm(nextWelfareForm);
    setSavedSnapshot({
      form: { name: currentOrganization?.name ?? '', description: currentOrganization?.description ?? '' },
      paymentForm: {
        mode: metadata.paymentSettings?.mode ?? 'MPESA_NUMBER',
        mpesaNumber: metadata.paymentSettings?.mpesaNumber ?? '',
        paybillNumber: metadata.paymentSettings?.paybillNumber ?? '',
        accountNumber: metadata.paymentSettings?.accountNumber ?? '',
        accountReference: metadata.paymentSettings?.accountReference ?? '',
        transactionDesc: metadata.paymentSettings?.transactionDesc ?? '',
        isEnabled: metadata.paymentSettings?.isEnabled ?? true,
      },
      notificationForm: {
        sms: metadata.notificationSettings?.sms ?? true,
        email: metadata.notificationSettings?.email ?? true,
        inApp: metadata.notificationSettings?.inApp ?? true,
      },
      welfareForm: nextWelfareForm,
    });
  }, [currentOrganization?.description, currentOrganization?.enabledModules?.welfare, currentOrganization?.metadata, currentOrganization?.name]);

  const currentSnapshot: SettingsSnapshot = { form, paymentForm, notificationForm, welfareForm };
  const hasUnsavedChanges = savedSnapshot ? JSON.stringify(currentSnapshot) !== JSON.stringify(savedSnapshot) : false;
  const paymentError = paymentForm.mode === 'MPESA_NUMBER'
    ? paymentForm.mpesaNumber.trim() && !/^\+?254\d{9}$/.test(paymentForm.mpesaNumber.trim())
      ? 'Use a Kenyan number like 254712345678.'
      : ''
    : paymentForm.paybillNumber.trim() && !/^\d{5,7}$/.test(paymentForm.paybillNumber.trim())
      ? 'Enter a valid 5 to 7 digit PayBill number.'
      : '';

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await organizationService.updateOrganization(currentOrganization.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        metadata: {
          ...((currentOrganization.metadata ?? {}) as OrganizationMetadata),
        },
      });
      setMessage('Settings updated successfully.');
      await refreshOrganizations();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!savedSnapshot) return;
    setForm(savedSnapshot.form);
    setPaymentForm(savedSnapshot.paymentForm);
    setNotificationForm(savedSnapshot.notificationForm);
    setWelfareForm(savedSnapshot.welfareForm);
    setMessage('Unsaved changes discarded.');
    setError('');
  };

  const saveEnterpriseSettings = async (section: 'payment' | 'welfare' | 'notification' | 'all' = 'all') => {
    if (!currentOrganization?.id) return;
    if (paymentError) {
      setActiveSection('payments');
      setError(paymentError);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await organizationService.updateOrganization(currentOrganization.id, {
        metadata: {
          ...((currentOrganization.metadata ?? {}) as OrganizationMetadata),
          paymentSettings: {
            ...paymentForm,
            mpesaNumber: paymentForm.mode === 'MPESA_NUMBER' ? paymentForm.mpesaNumber.trim() || undefined : undefined,
            paybillNumber: paymentForm.mode === 'PAYBILL' ? paymentForm.paybillNumber.trim() || undefined : undefined,
            accountNumber: paymentForm.accountNumber.trim() || undefined,
            accountReference: paymentForm.accountReference.trim() || undefined,
            transactionDesc: paymentForm.transactionDesc.trim() || undefined,
          },
          notificationSettings: {
            ...notificationForm,
          },
          welfareRules: {
            ...welfareForm,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      setSavedSnapshot(currentSnapshot);
      setMessage(`${section === 'all' ? 'Settings' : `${section[0].toUpperCase()}${section.slice(1)} settings`} saved successfully.`);
      await refreshOrganizations();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save enterprise settings');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED') => {
    if (!currentOrganization?.id) return;
    if (status !== 'ACTIVE') {
      setPendingStatus(status);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await organizationService.updateOrganization(currentOrganization.id, { status });
      setMessage(`Organization moved to ${status.toLowerCase()}.`);
      await refreshOrganizations();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatus || !currentOrganization?.id) return;
    const status = pendingStatus;
    setPendingStatus(null);
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await organizationService.updateOrganization(currentOrganization.id, { status });
      setMessage(`Organization moved to ${status.toLowerCase()}.`);
      await refreshOrganizations();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage settings." />;
  }

  const enabledModules = Object.entries(currentOrganization.enabledModules ?? {})
    .filter(([, enabled]) => enabled)
    .map(([module]) => getModuleLabel(module));
  const enabledWelfareCategories = getEnabledWelfareCategories(welfareForm);
  const enabledSettingsSections = [
    { value: 'overview' as const, label: 'General' },
    ...(currentOrganization.enabledModules?.mpesa ? [{ value: 'payments' as const, label: 'Payments' }] : []),
    ...(currentOrganization.enabledModules?.welfare ? [{ value: 'welfare' as const, label: 'Welfare' }] : []),
    { value: 'notifications' as const, label: 'Notifications' },
  ];

  const patchWelfareRules = (patch: Partial<WelfareRulesConfig>) => {
    setWelfareForm((current) => ({ ...current, ...patch }));
  };

  const patchWelfareCategory = (key: string, patch: Partial<WelfareCategoryRule>) => {
    setWelfareForm((current) => ({
      ...current,
      categories: current.categories.map((category) => (category.key === key ? { ...category, ...patch } : category)),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-settings">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Settings</span>
            <strong>{currentOrganization.status}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Organization settings</h1>
            <small>Update basics, configure payments, review modules, and control lifecycle status.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <button type="button" onClick={() => setActiveSection('overview')} className={activeSection === 'overview' ? 'is-active' : ''}>
              <Save className="h-4 w-4" />
              Overview
            </button>
            <button type="button" onClick={() => setActiveSection('payments')} className={activeSection === 'payments' ? 'is-active' : ''}>
              <CreditCard className="h-4 w-4" />
              Payments
            </button>
            <button type="button" onClick={() => setActiveSection('welfare')} className={activeSection === 'welfare' ? 'is-active' : ''}>
              <HeartHandshake className="h-4 w-4" />
              Welfare
            </button>
            <button type="button" onClick={() => setActiveSection('notifications')} className={activeSection === 'notifications' ? 'is-active' : ''}>
              <BellRing className="h-4 w-4" />
              Notifications
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Layers3 className="h-5 w-5" /></span>
            <p>Modules</p>
            <strong>{enabledModules.length}</strong>
            <small>Enabled capabilities</small>
          </article>
          <article>
            <span className="blue"><CreditCard className="h-5 w-5" /></span>
            <p>Payments</p>
            <strong>{paymentForm.isEnabled ? 'On' : 'Off'}</strong>
            <small>{paymentForm.mode}</small>
          </article>
          <article>
            <span className="gold"><BellRing className="h-5 w-5" /></span>
            <p>Notifications</p>
            <strong>{[notificationForm.sms, notificationForm.email, notificationForm.inApp].filter(Boolean).length}</strong>
            <small>Active channels</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}
      {message ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</Card> : null}

      {hasUnsavedChanges ? (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[var(--ds-radius-lg)] border border-amber-300 bg-amber-50 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-amber-950">You have unsaved changes</p>
            <p className="text-sm text-amber-800">Save them before leaving this page.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={discardChanges}>Discard</Button>
            <Button type="button" loading={saving} onClick={() => void saveEnterpriseSettings('all')} startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>Save changes</Button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto border-b border-[var(--ds-border)] pb-2" role="tablist" aria-label="Settings sections">
        {enabledSettingsSections.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeSection === value}
            onClick={() => setActiveSection(value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${activeSection === value ? 'bg-[var(--ds-secondary)] text-white' : 'bg-[var(--ds-surface-3)] text-[var(--ds-text-muted)] hover:text-[var(--ds-secondary)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' ? <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card id="organization-basics" className="p-6">
          <p className="text-sm text-[var(--ds-text-muted)]">Basics</p>
          <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Edit organization</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextField label="Name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Description</span>
              <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={5} className="input min-h-32 w-full" />
            </label>
            <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
              Save general settings
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-[var(--ds-text-muted)]">Personal account</p>
          <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Your account settings</h2>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">Password, MFA, active sessions, and personal notification preferences are managed separately.</p>
          <div className="mt-5 grid gap-3">
            <Link to="/profile" className="btn btn-outline">Open profile and security</Link>
            <Link to="/notifications" className="btn btn-outline">Open personal notifications</Link>
          </div>
        </Card>

      </section> : null}

      {activeSection === 'payments' ? <section id="enterprise-settings" className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <div>
            <p className="font-semibold text-[var(--ds-secondary)]">Payment settings</p>
            <p className="text-sm text-[var(--ds-text-muted)]">Save the default payment profile for contributions and reconciliation.</p>
          </div>
          {!paymentForm.isEnabled ? <div className="rounded-[var(--ds-radius-lg)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">M-Pesa defaults are currently disabled. Enable them below before members can use this payment profile.</div> : null}
          <SelectField label="Mode" value={paymentForm.mode} onChange={(event) => setPaymentForm((current) => ({ ...current, mode: event.target.value as 'MPESA_NUMBER' | 'PAYBILL' }))}>
            <option value="MPESA_NUMBER">M-Pesa Number</option>
            <option value="PAYBILL">PayBill</option>
          </SelectField>
          {paymentForm.mode === 'MPESA_NUMBER' ? (
            <TextField label="M-Pesa number" placeholder="2547..." value={paymentForm.mpesaNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, mpesaNumber: event.target.value }))} />
          ) : (
            <TextField label="PayBill number" placeholder="123456" value={paymentForm.paybillNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, paybillNumber: event.target.value }))} />
          )}
          {paymentError ? <p className="text-sm font-semibold text-rose-700" role="alert">{paymentError}</p> : <p className="text-sm text-[var(--ds-text-muted)]">Use the number members will see when making contributions.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Account number" value={paymentForm.accountNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, accountNumber: event.target.value }))} />
            <TextField label="Account reference" value={paymentForm.accountReference} onChange={(event) => setPaymentForm((current) => ({ ...current, accountReference: event.target.value }))} />
          </div>
          <TextField label="Transaction description" value={paymentForm.transactionDesc} onChange={(event) => setPaymentForm((current) => ({ ...current, transactionDesc: event.target.value }))} />
          <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Enable M-Pesa defaults</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Use these settings across contribution payment flows.</p>
            </div>
            <input type="checkbox" checked={paymentForm.isEnabled} onChange={(event) => setPaymentForm((current) => ({ ...current, isEnabled: event.target.checked }))} />
          </label>
          <Button type="button" onClick={() => void saveEnterpriseSettings('payment')} loading={saving} className="w-full" startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
            Save payment settings
          </Button>
        </Card>

      </section> : null}

      {activeSection === 'welfare' ? <section id="welfare-rules-settings" className="grid gap-6">
        <Card className="space-y-4 p-6">
          <div>
            <p className="font-semibold text-[var(--ds-secondary)]">Welfare rules</p>
            <p className="text-sm text-[var(--ds-text-muted)]">Customize welfare contributions, claim limits, categories, and approval expectations.</p>
          </div>
          {!welfareForm.enabled ? <div className="rounded-[var(--ds-radius-lg)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Welfare is disabled for this Chama. Enable it below to make these rules available to members.</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Monthly contribution"
              type="number"
              min="0"
              value={welfareForm.monthlyContribution}
              onChange={(event) => patchWelfareRules({ monthlyContribution: Number(event.target.value) })}
            />
            <TextField label="Maximum claim" type="number" min="0" value={welfareForm.maxClaimAmount} onChange={(event) => patchWelfareRules({ maxClaimAmount: Number(event.target.value) })} />
            <TextField
              label="Waiting period days"
              type="number"
              min="0"
              value={welfareForm.waitingPeriodDays}
              onChange={(event) => patchWelfareRules({ waitingPeriodDays: Number(event.target.value) })}
            />
            <TextField label="Reminder day" type="number" min="1" max="28" value={welfareForm.reminderDay} onChange={(event) => patchWelfareRules({ reminderDay: Number(event.target.value) })} />
          </div>
          <SelectField label="Approval model" value={welfareForm.approvalMode} onChange={(event) => patchWelfareRules({ approvalMode: event.target.value as WelfareRulesConfig['approvalMode'] })}>
            {WELFARE_APPROVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--ds-secondary)]">Enabled</span>
              <input type="checkbox" checked={welfareForm.enabled} onChange={(event) => patchWelfareRules({ enabled: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--ds-secondary)]">Partial approvals</span>
              <input type="checkbox" checked={welfareForm.allowPartialApproval} onChange={(event) => patchWelfareRules({ allowPartialApproval: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--ds-secondary)]">Documents</span>
              <input type="checkbox" checked={welfareForm.requireDocuments} onChange={(event) => patchWelfareRules({ requireDocuments: event.target.checked })} />
            </label>
          </div>
          <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
            <p className="text-sm font-semibold text-[var(--ds-secondary)]">{enabledWelfareCategories.length} active claim categories</p>
            <div className="mt-3 grid gap-3">
              {welfareForm.categories.map((category) => (
                <div key={category.key} className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-[var(--ds-secondary)]">{category.label}</span>
                    <input type="checkbox" checked={category.enabled} onChange={(event) => patchWelfareCategory(category.key, { enabled: event.target.checked })} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField label="Limit" type="number" min="0" value={category.limit} onChange={(event) => patchWelfareCategory(category.key, { limit: Number(event.target.value) })} />
                    <TextField label="Documents" value={documentsToText(category.documents)} onChange={(event) => patchWelfareCategory(category.key, { documents: textToDocuments(event.target.value) })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button type="button" onClick={() => void saveEnterpriseSettings('welfare')} loading={saving} className="w-full" startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
            Save welfare settings
          </Button>
        </Card>

      </section> : null}

      {activeSection === 'notifications' ? <section className="grid gap-6">
        <Card className="space-y-4 p-6">
          <div>
            <p className="font-semibold text-[var(--ds-secondary)]">Notification defaults</p>
            <p className="text-sm text-[var(--ds-text-muted)]">Set the channels this organization should favor.</p>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">In-app</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Show alerts inside the app.</p>
            </div>
            <input type="checkbox" checked={notificationForm.inApp} onChange={(event) => setNotificationForm((current) => ({ ...current, inApp: event.target.checked }))} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">Email</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Send email notifications to members.</p>
            </div>
            <input type="checkbox" checked={notificationForm.email} onChange={(event) => setNotificationForm((current) => ({ ...current, email: event.target.checked }))} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--ds-secondary)]">SMS</p>
              <p className="text-sm text-[var(--ds-text-muted)]">Use SMS for urgent reminders.</p>
            </div>
            <input type="checkbox" checked={notificationForm.sms} onChange={(event) => setNotificationForm((current) => ({ ...current, sms: event.target.checked }))} />
          </label>
          <Button type="button" onClick={() => void saveEnterpriseSettings('notification')} loading={saving} className="w-full" startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
            Save notification settings
          </Button>
        </Card>
      </section> : null}

      {activeSection === 'overview' ? <Card className="border-rose-200 bg-rose-50/50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 text-rose-700" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-rose-700">Danger zone</p>
            <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Organization lifecycle</h2>
            <p className="mt-1 text-sm text-[var(--ds-text-muted)]">These actions can interrupt access or hide the Chama from normal workflows.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void updateStatus('ACTIVE')} disabled={saving} startIcon={<RefreshCcw className="h-4 w-4" />}>
            Activate
          </Button>
          <Button variant="outline" onClick={() => void updateStatus('SUSPENDED')} disabled={saving} startIcon={<Archive className="h-4 w-4" />}>
            Suspend
          </Button>
          <Button variant="outline" onClick={() => void updateStatus('CLOSED')} disabled={saving} startIcon={<Archive className="h-4 w-4" />}>
            Close
          </Button>
          <Button onClick={() => void updateStatus('ARCHIVED')} disabled={saving} startIcon={<Archive className="h-4 w-4" />}>
            Archive
          </Button>
        </div>
      </Card> : null}

      {activeSection === 'overview' ? <Card className="p-6">
        <p className="text-sm text-[var(--ds-text-muted)]">Enabled modules</p>
        <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Current setup</h2>
        <div className="mt-4">
          {enabledModules.length === 0 ? (
            <EmptyState title="No modules are currently enabled." description="Enable modules in the wizard or edit them here when the backend supports it." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledModules.map((module) => (
                <Badge key={module} tone="neutral">
                  {module}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card> : null}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={`Move organization to ${pendingStatus?.toLowerCase() ?? 'a new status'}?`}
        description="This may affect member access, payments, and normal Chama workflows. You can change the status again later."
        confirmLabel={`Confirm ${pendingStatus?.toLowerCase() ?? 'change'}`}
        destructive
        busy={saving}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => void confirmStatusChange()}
      />
    </div>
  );
};
