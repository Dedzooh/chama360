import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Building2, Landmark, Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type InvestmentAsset, type InvestmentPosition, type InvestmentSummary } from '../../services/organizationService';
import { Badge, Button, Card, Dialog, EmptyState, MetricCard, SelectField, TextField } from '../../design-system';

const money = (value: number) => `KES ${Number(value || 0).toLocaleString()}`;
const managers = ['OWNER', 'FOUNDER', 'CHAIR', 'TREASURER', 'ADMIN'];
const emptySummary: InvestmentSummary = { assetCount: 0, activeAssets: 0, purchaseCost: 0, currentValue: 0, gainLoss: 0, returnPercent: 0 };

export const Investments = () => {
  const { currentOrganization } = useOrganizationWorkspace();
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [positions, setPositions] = useState<InvestmentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [valuationAsset, setValuationAsset] = useState<InvestmentAsset | null>(null);
  const [valuation, setValuation] = useState('');
  const [form, setForm] = useState({ name: '', category: 'TREASURY_BOND', purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: '', currentValue: '', units: '1', notes: '' });
  const canManage = useMemo(() => managers.includes((currentOrganization?.myRole ?? '').toUpperCase()), [currentOrganization?.myRole]);

  const load = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true); setError('');
    try { const result = await organizationService.listInvestments(currentOrganization.id); setAssets(result.assets); setPositions(result.positions); setSummary(result.summary ?? emptySummary); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load investments'); }
    finally { setLoading(false); }
  }, [currentOrganization?.id]);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!currentOrganization?.id) return;
    setSaving(true); setError('');
    try {
      await organizationService.createInvestment(currentOrganization.id, { name: form.name, category: form.category as InvestmentAsset['category'], purchaseDate: form.purchaseDate, purchaseCost: Number(form.purchaseCost), currentValue: Number(form.currentValue), units: Number(form.units), status: 'ACTIVE', notes: form.notes || undefined });
      setForm({ name: '', category: 'TREASURY_BOND', purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: '', currentValue: '', units: '1', notes: '' }); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not record investment'); }
    finally { setSaving(false); }
  };

  const updateValue = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentOrganization?.id || !valuationAsset || !Number.isFinite(Number(valuation)) || Number(valuation) < 0) return;
    setSaving(true); setError('');
    try { await organizationService.updateInvestment(currentOrganization.id, valuationAsset.id, { currentValue: Number(valuation) }); setValuationAsset(null); await load(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update valuation'); }
    finally { setSaving(false); }
  };

  if (!currentOrganization) return <EmptyState title="No Chama selected" description="Open an investment Chama to view its portfolio." />;
  const positive = summary.gainLoss >= 0;
  return <div className="space-y-6">
    <section className="chama360-module-hero chama360-module-hero-contributions">
      <div className="chama360-module-hero-main"><div className="chama360-module-hero-topline"><span>Investment portfolio</span><strong>{currentOrganization.name}</strong></div><div className="chama360-module-hero-copy"><h1>Investments</h1><p>Track pooled assets, valuations, growth, and investment decisions in one transparent ledger.</p></div><div className="chama360-module-hero-actions"><button type="button" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Sync portfolio</button></div></div>
      <div className="chama360-module-hero-stats"><article><span className="green"><BriefcaseBusiness className="h-5 w-5" /></span><p>Assets</p><strong>{summary.assetCount}</strong><small>{summary.activeAssets} active</small></article><article><span className="blue"><Landmark className="h-5 w-5" /></span><p>Portfolio value</p><strong>{money(summary.currentValue)}</strong><small>Latest valuation</small></article><article><span className="gold">{positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}</span><p>Return</p><strong>{summary.returnPercent.toFixed(1)}%</strong><small>{money(summary.gainLoss)}</small></article></div>
    </section>
    {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card> : null}
    <section className="grid gap-3 sm:grid-cols-3"><MetricCard title="Purchase cost" value={money(summary.purchaseCost)} caption="Capital invested" tone="emerald" icon={<Landmark className="h-5 w-5" />} /><MetricCard title="Current value" value={money(summary.currentValue)} caption="Latest valuation" tone="success" icon={<TrendingUp className="h-5 w-5" />} /><MetricCard title="Gain / loss" value={money(summary.gainLoss)} caption={`${summary.returnPercent.toFixed(2)}% return`} tone={positive ? 'success' : 'error'} icon={positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} /></section>
    <section className="section-shell overflow-hidden">
      <div className="section-header"><p className="text-sm text-[var(--ds-text-muted)]">{canManage ? 'Ownership register' : 'Private member view'}</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">{canManage ? 'Member investment positions' : 'My investment position'}</h2><p className="mt-1 text-sm text-[var(--ds-text-muted)]">Estimated portfolio ownership is allocated according to each member's confirmed contribution share.</p></div>
      <div className="section-body">
        {positions.length ? <div className="space-y-3">{positions.map((position) => <Card key={position.memberId} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-[var(--ds-secondary)]">{position.member.firstName} {position.member.lastName}</h3><p className="text-sm text-[var(--ds-text-muted)]">Confirmed contributions: {money(position.contributed)}</p></div><Badge tone="success">{position.ownershipPercent.toFixed(2)}% ownership</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div><small className="text-[var(--ds-text-muted)]">Estimated portfolio value</small><p className="font-black text-[var(--ds-secondary)]">{money(position.estimatedValue)}</p></div><div><small className="text-[var(--ds-text-muted)]">Allocated portfolio gain</small><p className={`font-black ${position.estimatedGain >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(position.estimatedGain)}</p></div><div className="col-span-2 sm:col-span-1"><small className="text-[var(--ds-text-muted)]">Contribution share</small><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ds-surface-2)]"><div className="h-full rounded-full bg-[var(--ds-primary)]" style={{ width: `${Math.min(position.ownershipPercent, 100)}%` }} /></div></div></div></Card>)}</div> : <EmptyState title="No member positions available" description="Positions appear after confirmed member contributions are recorded." />}
      </div>
    </section>
    <section className={`grid gap-6 ${canManage ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
      <div className="space-y-3">{loading ? <Card className="h-32 animate-pulse" /> : assets.length ? assets.map((asset) => { const gain = Number(asset.currentValue) - Number(asset.purchaseCost); return <Card key={asset.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Building2 className="h-5 w-5" /></span><div><h3 className="font-black text-[var(--ds-secondary)]">{asset.name}</h3><p className="text-sm text-[var(--ds-text-muted)]">{asset.category.replaceAll('_', ' ')} · Purchased {asset.purchaseDate}</p></div></div><Badge tone={asset.status === 'ACTIVE' ? 'success' : 'neutral'}>{asset.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><small className="text-[var(--ds-text-muted)]">Cost</small><p className="font-bold">{money(asset.purchaseCost)}</p></div><div><small className="text-[var(--ds-text-muted)]">Current value</small><p className="font-bold">{money(asset.currentValue)}</p></div><div><small className="text-[var(--ds-text-muted)]">Gain / loss</small><p className={`font-bold ${gain >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(gain)}</p></div><div><small className="text-[var(--ds-text-muted)]">Units</small><p className="font-bold">{asset.units}</p></div></div>{asset.notes ? <p className="mt-3 text-sm text-[var(--ds-text-muted)]">{asset.notes}</p> : null}{canManage ? <Button className="mt-4" variant="outline" disabled={saving} onClick={() => { setValuationAsset(asset); setValuation(String(asset.currentValue)); }}>Update valuation</Button> : null}</Card>; }) : <EmptyState title="No investments recorded yet" description="The treasurer can add the Chama's first asset to start the portfolio ledger." />}</div>
      {canManage ? <Card className="h-fit p-5"><p className="text-sm text-[var(--ds-text-muted)]">Portfolio management</p><h2 className="text-xl font-black text-[var(--ds-secondary)]">Record investment</h2><form className="mt-4 space-y-4" onSubmit={create}><TextField label="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="TREASURY_BOND">Treasury bond</option><option value="MONEY_MARKET">Money market</option><option value="REAL_ESTATE">Real estate</option><option value="SHARES">Shares</option><option value="BUSINESS">Business</option><option value="OTHER">Other</option></SelectField><TextField label="Purchase date" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required /><div className="grid grid-cols-2 gap-3"><TextField label="Purchase cost" type="number" min="1" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} required /><TextField label="Current value" type="number" min="0" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} required /></div><TextField label="Units" type="number" min="0.01" step="0.01" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} required /><TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><Button type="submit" className="w-full" loading={saving} startIcon={<Plus className="h-4 w-4" />}>Add to portfolio</Button></form></Card> : null}
    </section>
    <Dialog open={Boolean(valuationAsset)} title="Update asset valuation" description={valuationAsset ? `Record the latest verified value for ${valuationAsset.name}.` : undefined} onClose={() => { if (!saving) setValuationAsset(null); }}>
      <form className="space-y-4" onSubmit={updateValue}>
        <TextField label="Current value (KES)" type="number" min="0" step="0.01" value={valuation} onChange={(event) => setValuation(event.target.value)} required autoFocus />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" disabled={saving} onClick={() => setValuationAsset(null)}>Cancel</Button><Button type="submit" loading={saving}>Save valuation</Button></div>
      </form>
    </Dialog>
  </div>;
};
