import { FormEvent, useEffect, useState } from 'react';
import { Flag, RefreshCw } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type DisputeRecord } from '../../services/organizationService';
import { Badge, Button, Card, EmptyState, SelectField, TextField } from '../../design-system';

const labels: Record<string, string> = { OPEN: 'Submitted', UNDER_REVIEW: 'Under review', VOTING: 'Group vote', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const tones: Record<string, 'warning' | 'success' | 'error' | 'neutral'> = { OPEN: 'warning', UNDER_REVIEW: 'warning', VOTING: 'warning', RESOLVED: 'success', CLOSED: 'neutral' };

export const DisputesPage = () => {
  const { currentOrganization } = useOrganizationWorkspace();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, 'UNDER_REVIEW' | 'VOTING' | 'RESOLVED' | 'CLOSED'>>({});
  const role = (currentOrganization?.myRole ?? '').toUpperCase();
  const canManage = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'].includes(role);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true); setError('');
    try { setDisputes(await organizationService.listDisputes(currentOrganization.id)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load disputes.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentOrganization?.id]);

  const updateStatus = async (event: FormEvent, dispute: DisputeRecord) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    const resolution = (notes[dispute.id] ?? '').trim();
    if (resolution.length < 3) { setError('Add a brief update before saving.'); return; }
    setSavingId(dispute.id); setError('');
    try {
      const nextStatus = statuses[dispute.id] ?? 'UNDER_REVIEW';
      await organizationService.updateDisputeStatus(currentOrganization.id, dispute.id, nextStatus, resolution);
      setNotes((current) => ({ ...current, [dispute.id]: '' }));
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update this dispute.'); }
    finally { setSavingId(''); }
  };

  if (!currentOrganization) return <EmptyState title="No chama selected" description="Open a Chama to see your disputes." />;
  return <div className="space-y-6 chama360-workspace-page">
    <section className="chama360-module-hero"><div className="chama360-module-hero-main"><div className="chama360-module-hero-topline"><span>Member support</span><strong>{canManage ? 'Review queue' : 'Private to you'}</strong></div><div className="chama360-module-hero-copy"><h1>{canManage ? 'Disputes' : 'My disputes'}</h1><p>See each case’s current status and the updates recorded by your group.</p></div><div className="chama360-module-hero-actions"><button type="button" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh</button></div></div></section>
    {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card> : null}
    {loading ? <Card className="p-6">Loading disputes…</Card> : disputes.length ? <div className="space-y-4">{disputes.map((dispute) => <Card key={dispute.id} className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--ds-text-muted)]">{dispute.category.replaceAll('_', ' ')}{dispute.relatedEntityType ? ` · ${dispute.relatedEntityType.replaceAll('_', ' ')}` : ''}</p><h2 className="mt-1 font-bold text-[var(--ds-secondary)]">Case {dispute.id.slice(-8).toUpperCase()}</h2>{canManage && dispute.raisedBy ? <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Raised by {dispute.raisedBy.firstName} {dispute.raisedBy.lastName}</p> : null}</div><Badge tone={tones[dispute.status] ?? 'neutral'}>{labels[dispute.status] ?? dispute.status}</Badge></div>
      <p className="text-sm leading-6">{dispute.description}</p><p className="text-xs text-[var(--ds-text-muted)]">Submitted {new Date(dispute.createdAt).toLocaleString('en-KE')}</p>
      {dispute.activity?.length ? <ol className="space-y-2 border-l-2 border-[var(--ds-border)] pl-4">{dispute.activity.map((entry, index) => <li key={`${entry.at}-${index}`} className="text-sm"><strong>{labels[entry.status] ?? entry.status}</strong><span className="ml-2 text-xs text-[var(--ds-text-muted)]">{new Date(entry.at).toLocaleString('en-KE')}</span>{entry.note ? <p className="mt-1 text-[var(--ds-text-muted)]">{entry.note}</p> : null}</li>)}</ol> : null}
      {dispute.resolution?.note ? <div className="rounded-xl bg-[var(--ds-surface-2)] p-3 text-sm"><strong>Latest response</strong><p className="mt-1">{dispute.resolution.note}</p></div> : null}
      {canManage && !['RESOLVED', 'CLOSED'].includes(dispute.status) ? <form className="grid gap-3 border-t border-[var(--ds-border)] pt-4 sm:grid-cols-[190px_1fr_auto] sm:items-end" onSubmit={(event) => void updateStatus(event, dispute)}><SelectField label="Update status" value={statuses[dispute.id] ?? 'UNDER_REVIEW'} onChange={(event) => setStatuses((current) => ({ ...current, [dispute.id]: event.target.value as 'UNDER_REVIEW' | 'VOTING' | 'RESOLVED' | 'CLOSED' }))}><option value="UNDER_REVIEW">Under review</option>{['OWNER', 'FOUNDER', 'CHAIR', 'ADMIN'].includes(role) ? <option value="VOTING">Group vote</option> : null}<option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></SelectField><TextField label="Message for the member" value={notes[dispute.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [dispute.id]: event.target.value }))} /><Button type="submit" disabled={savingId === dispute.id || (notes[dispute.id] ?? '').trim().length < 3} startIcon={<Flag className="h-4 w-4" />}>{savingId === dispute.id ? 'Saving…' : 'Post update'}</Button></form> : null}
    </Card>)}</div> : <EmptyState title="No disputes yet" description={canManage ? 'Member cases that need review will appear here.' : 'If you disagree with a loan or welfare decision, open its details and choose “Raise a dispute”.'} />}
  </div>;
};
