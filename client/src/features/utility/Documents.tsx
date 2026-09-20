import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuthStore } from '../../store/authStore';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService } from '../../services/organizationService';
import { subscriptionService } from '../../services/subscriptionService';

type DocumentRecord = {
  id: string;
  type: string;
  status: string;
  uploadedAt?: string;
};

const documentTypes = ['NATIONAL_ID', 'PASSPORT', 'DRIVING_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT'] as const;

export const Documents = () => {
  const user = useAuthStore((state) => state.user);
  const { currentOrganization } = useOrganizationWorkspace();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [organizationStorage, setOrganizationStorage] = useState<{ usedBytes: number; storageLimitMb: number | null } | null>(null);
  const [organizationFile, setOrganizationFile] = useState<File | null>(null);
  const [organizationFileName, setOrganizationFileName] = useState('');
  const [form, setForm] = useState({
    type: 'NATIONAL_ID',
    frontImage: '',
    backImage: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
  });

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getDocuments();
      setDocuments(response.documents ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    void Promise.all([subscriptionService.getCurrent(currentOrganization.id), organizationService.getOrganizationDocumentUsage(currentOrganization.id)]).then(([data, usage]) => setOrganizationStorage({ usedBytes: usage.usedBytes, storageLimitMb: data.usage?.storageLimitMb ?? null })).catch(() => undefined);
  }, [currentOrganization?.id]);

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await userService.uploadDocument({
        type: form.type as any,
        frontImage: form.frontImage.trim(),
        backImage: form.backImage.trim() || undefined,
        documentNumber: form.documentNumber.trim(),
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        issuingAuthority: form.issuingAuthority.trim() || undefined,
      });
      setForm({
        type: 'NATIONAL_ID',
        frontImage: '',
        backImage: '',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        issuingAuthority: '',
      });
      setMessage('Document uploaded successfully.');
      await loadDocuments();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => ({
    total: documents.length,
    approved: documents.filter((doc) => doc.status === 'APPROVED').length,
    pending: documents.filter((doc) => doc.status === 'PENDING').length,
  }), [documents]);

  const uploadOrganizationFile = async () => {
    if (!currentOrganization?.id || !organizationFile) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read file')); reader.readAsDataURL(organizationFile); });
      await organizationService.uploadOrganizationDocument(currentOrganization.id, { name: organizationFileName || organizationFile.name, contentType: organizationFile.type || 'application/octet-stream', data });
      const usage = await organizationService.getOrganizationDocumentUsage(currentOrganization.id); setOrganizationStorage((current) => current ? { ...current, usedBytes: usage.usedBytes } : current);
      setMessage('Organization document uploaded successfully.'); setOrganizationFile(null); setOrganizationFileName('');
    } catch (uploadError: any) {
      const details = uploadError?.response?.data?.error?.details;
      setError(details?.code === 'STORAGE_LIMIT_EXCEEDED' ? `Storage almost full: ${Math.round(details.usedBytes / 1048576)} MB used of ${Math.round(details.limitBytes / 1048576)} MB. Required: ${Math.round(details.requiredBytes / 1048576)} MB.` : uploadError instanceof Error ? uploadError.message : 'Failed to upload organization document');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-documents">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Documents</span>
            <strong>KYC profile</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{user ? `${user.firstName} ${user.lastName}` : 'Your account'}</p>
            <h1>Member documents</h1>
            <small>Upload identity documents and keep your verification profile current.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#document-upload">
              <Upload className="h-4 w-4" />
              Upload
            </a>
            <button type="button" onClick={() => void loadDocuments()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><FileText className="h-5 w-5" /></span>
            <p>Documents</p>
            <strong>{counts.total}</strong>
            <small>Total uploaded</small>
          </article>
          <article>
            <span className="blue"><CheckCircle2 className="h-5 w-5" /></span>
            <p>Approved</p>
            <strong>{counts.approved}</strong>
            <small>Verified files</small>
          </article>
          <article>
            <span className="gold"><Clock3 className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{counts.pending}</strong>
            <small>Awaiting review</small>
          </article>
        </div>
      </section>

      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}
      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}

      {currentOrganization ? <section className="section-shell overflow-hidden"><div className="section-header"><p className="text-sm text-slate-500">Chama records</p><h2 className="text-xl font-semibold">Organization documents</h2></div><div className="section-body space-y-4"><p className="text-sm text-slate-600">Store minutes, receipts, constitutions, welfare evidence, and other Chama records. Storage is enforced by your subscription.</p>{organizationStorage?.storageLimitMb ? <><p className="text-sm font-semibold text-[var(--ds-secondary)]">{Math.round(organizationStorage.usedBytes / 1048576)} MB of {organizationStorage.storageLimitMb >= 1024 ? `${organizationStorage.storageLimitMb / 1024} GB` : `${organizationStorage.storageLimitMb} MB`} used</p><div className="h-2 overflow-hidden rounded-full bg-[var(--ds-surface-2)]"><div className="h-full rounded-full bg-[var(--ds-primary)]" style={{ width: `${Math.min(100, (organizationStorage.usedBytes / (organizationStorage.storageLimitMb * 1048576)) * 100)}%` }} /></div></> : null}<div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-sm font-medium text-slate-700">File<input type="file" className="mt-1 w-full input" onChange={(event) => setOrganizationFile(event.target.files?.[0] ?? null)} /></label><label className="text-sm font-medium text-slate-700">Display name<input className="mt-1 w-full input" value={organizationFileName} onChange={(event) => setOrganizationFileName(event.target.value)} placeholder="Optional" /></label><button type="button" className="btn btn-primary" disabled={saving || !organizationFile} onClick={() => void uploadOrganizationFile()}><Upload className="h-4 w-4" /> Upload file</button></div></div></section> : null}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="section-shell overflow-hidden">
          <div className="section-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Uploaded files</p>
              <h2 className="text-xl font-semibold">Document list</h2>
            </div>
            <button type="button" onClick={() => void loadDocuments()} className="btn btn-outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="section-body space-y-3">
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state p-6 text-center text-(--muted)">
                <FileText className="mx-auto h-10 w-10" />
                <p className="mt-3">No documents uploaded yet.</p>
              </div>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="dashboard-tile p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-(--secondary)">{document.type}</p>
                      <p className="text-sm text-(--muted)">{document.uploadedAt ? new Date(document.uploadedAt).toLocaleString() : 'Recently uploaded'}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{document.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form id="document-upload" onSubmit={submitDocument} className="section-shell overflow-hidden">
          <div className="section-header">
            <p className="text-sm text-slate-500">Upload</p>
            <h2 className="text-xl font-semibold">Add document</h2>
          </div>
          <div className="section-body space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Document type</span>
              <select value={form.type} onChange={(event) => updateField('type', event.target.value)} className="mt-1 w-full input">
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Front image / URL</span>
              <input value={form.frontImage} onChange={(event) => updateField('frontImage', event.target.value)} className="mt-1 w-full input" placeholder="Paste an image URL or base64 string" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Back image / URL</span>
              <input value={form.backImage} onChange={(event) => updateField('backImage', event.target.value)} className="mt-1 w-full input" placeholder="Optional" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Document number</span>
              <input value={form.documentNumber} onChange={(event) => updateField('documentNumber', event.target.value)} className="mt-1 w-full input" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Issue date</span>
                <input value={form.issueDate} onChange={(event) => updateField('issueDate', event.target.value)} type="date" className="mt-1 w-full input" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Expiry date</span>
                <input value={form.expiryDate} onChange={(event) => updateField('expiryDate', event.target.value)} type="date" className="mt-1 w-full input" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Issuing authority</span>
              <input value={form.issuingAuthority} onChange={(event) => updateField('issuingAuthority', event.target.value)} className="mt-1 w-full input" />
            </label>
            <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload document
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

