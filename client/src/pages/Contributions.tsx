import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Banknote, BellRing, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, FileDown, Plus, RefreshCw, RotateCcw, Smartphone, Wallet } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useAuthStore } from '../store/authStore';
import { organizationService, type ContributionRecord, type ContributionSummary } from '../services/organizationService';
import { mpesaService } from '../services/mpesaService';
import { Badge, Button, Card, Chip, Dialog, EmptyState, MetricCard, SelectField, TextField } from '../design-system';

const CURRENCY = 'KES';
const formatMoney = (value: number | string | undefined | null) => `${CURRENCY} ${Number(value ?? 0).toLocaleString()}`;

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
  PARTIAL: 'bg-sky-50 text-sky-700 border-sky-200',
  REVERSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const financeRoles = ['OWNER', 'FOUNDER', 'TREASURER', 'ADMIN'];

export const Contributions = () => {
  const compactLayout = useCompactLayout();
  const { currentOrganization, refreshOrganizations } = useOrganizationWorkspace();
  const user = useAuthStore((state) => state.user);
  const paymentSettings = (currentOrganization?.metadata as { paymentSettings?: { mode?: string; mpesaNumber?: string; paybillNumber?: string; accountNumber?: string; accountReference?: string; transactionDesc?: string; isEnabled?: boolean } } | undefined)?.paymentSettings;
  const organizationSettings = (currentOrganization as { settings?: { contributionRules?: Record<string, any>; notificationRules?: Record<string, any> } } | null)?.settings;
  const contributionRules = organizationSettings?.contributionRules ?? {};
  const notificationRules = organizationSettings?.notificationRules ?? {};
  const [summary, setSummary] = useState<ContributionSummary | null>(null);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [contributionType, setContributionType] = useState('MONTHLY');
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [paymentMethod, setPaymentMethod] = useState(paymentSettings?.isEnabled ? 'MPESA' : 'CASH');
  const [reference, setReference] = useState('');
  const [contributionStatus, setContributionStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'paid' | 'pending' | 'reversed'>('all');
  const [actionContribution, setActionContribution] = useState<ContributionRecord | null>(null);
  const [actionMode, setActionMode] = useState<'mark-paid' | 'reverse' | null>(null);
  const [actionPaymentMethod, setActionPaymentMethod] = useState<'CASH' | 'MPESA' | 'BANK'>('CASH');
  const [actionReference, setActionReference] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [stkContribution, setStkContribution] = useState<ContributionRecord | null>(null);
  const [stkPhone, setStkPhone] = useState(user?.phone ?? '');
  const [stkMessage, setStkMessage] = useState<string | null>(null);
  const [calendarPeriod, setCalendarPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [exportingStatement, setExportingStatement] = useState(false);
  const memberReferenceSuffix = (user?.phone ?? user?.id ?? 'MEMBER').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  const memberReferencePrefix = (paymentSettings?.accountNumber ?? paymentSettings?.accountReference ?? 'CHAMA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  const memberPaymentReference = `${memberReferencePrefix}${memberReferenceSuffix}`.slice(0, 12);

  const members = currentOrganization?.members ?? [];
  const canRecord = useMemo(() => financeRoles.includes((currentOrganization?.myRole ?? '').toUpperCase()), [currentOrganization?.myRole]);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, contributionData] = await Promise.all([organizationService.getContributionSummary(currentOrganization.id), organizationService.listContributions(currentOrganization.id)]);
      setSummary(summaryData);
      setContributions(contributionData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (paymentSettings?.isEnabled) {
      setPaymentMethod('MPESA');
      setReference(paymentSettings.accountReference ?? '');
    }
  }, [paymentSettings?.accountReference, paymentSettings?.isEnabled]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.createContribution(currentOrganization.id, {
        memberId,
        amount: Number(amount),
        contributionType,
        period,
        paymentMethod,
        reference: reference || undefined,
        status: contributionStatus,
        paidAt: contributionStatus === 'PAID' ? new Date().toISOString() : undefined,
      });
      setMemberId('');
      setAmount('');
      setReference('');
      setPeriod(new Date().toISOString().slice(0, 7));
      await loadData();
      await refreshOrganizations();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to record contribution');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (contribution: ContributionRecord) => {
    setActionContribution(contribution);
    setActionMode('mark-paid');
    setActionPaymentMethod('CASH');
    setActionReference('');
  };

  const submitMarkPaid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !actionContribution) return;
    if (actionPaymentMethod !== 'CASH' && !actionReference.trim()) {
      setError(`Enter the ${actionPaymentMethod === 'MPESA' ? 'M-Pesa' : 'bank'} transaction reference.`);
      return;
    }
    setSaving(true); setError(null);
    try { await organizationService.markContributionPaid(currentOrganization.id, actionContribution.id, { paymentMethod: actionPaymentMethod, reference: actionReference.trim() || undefined, paidAt: new Date().toISOString() }); setActionMode(null); setActionContribution(null); await loadData(); await refreshOrganizations(); }
    catch (markError) { setError(markError instanceof Error ? markError.message : 'Failed to mark contribution as paid'); }
    finally { setSaving(false); }
  };

  const handleReverse = async (contribution: ContributionRecord) => {
    setActionContribution(contribution);
    setActionMode('reverse');
    setReverseReason('');
  };

  const submitReverse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !actionContribution || reverseReason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.reverseContribution(currentOrganization.id, actionContribution.id, reverseReason.trim());
      setActionMode(null);
      setActionContribution(null);
      await loadData();
    } catch (reverseError) {
      setError(reverseError instanceof Error ? reverseError.message : 'Failed to reverse contribution');
    } finally {
      setSaving(false);
    }
  };

  const closeActionDialog = () => {
    if (saving) return;
    setActionMode(null);
    setActionContribution(null);
    setActionReference('');
    setReverseReason('');
  };

  const openStkPayment = (contribution: ContributionRecord) => {
    setStkContribution(contribution);
    setStkPhone(user?.phone ?? '');
    setStkMessage(null);
    setError(null);
  };

  const submitStkPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stkContribution || !stkPhone.trim()) return;
    setSaving(true); setError(null); setStkMessage(null);
    try {
      const result = await mpesaService.initiate({
        contributionId: stkContribution.id,
        phoneNumber: stkPhone.trim(),
        accountReference: memberPaymentReference || 'CHAMA360',
        transactionDesc: (paymentSettings?.transactionDesc ?? 'Contribution').slice(0, 13),
      });
      setStkMessage(result.data.customerMessage || 'STK Push sent. Check your phone and enter your M-Pesa PIN.');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Could not send the STK Push');
    } finally { setSaving(false); }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage contributions." />;
  }

  const total = summary?.total ?? 0;
  const paid = summary?.paid ?? 0;
  const pending = summary?.pending ?? 0;
  const reversed = summary?.reversed ?? 0;
  const filteredContributions = contributions.filter((item) => {
    if (ledgerFilter === 'paid') return item.status === 'PAID';
    if (ledgerFilter === 'pending') return item.status === 'PENDING' || item.status === 'OVERDUE' || item.status === 'PARTIAL';
    if (ledgerFilter === 'reversed') return item.status === 'REVERSED';
    return true;
  });
  const monthlyAmount = Number(contributionRules.amount ?? 0);
  const deadlineDay = Number(contributionRules.deadlineDay ?? (contributionRules.dueDate ? new Date(contributionRules.dueDate).getUTCDate() : 10));
  const penaltyAmount = Number(contributionRules.penaltyRules?.lateContributionPenalty ?? contributionRules.latePenalty ?? 0);
  const myContributions = contributions.filter((item) => item.memberId === user?.id);
  const myPenalties = myContributions.reduce((sum, item) => sum + Number(item.penalties ?? 0), 0);
  const myAllocatedPeriods = [...new Set(myContributions.flatMap((item) => item.allocations?.map((allocation) => allocation.period) ?? []))].sort();
  const paidThroughPeriod = myAllocatedPeriods.at(-1) ?? null;
  const formatPeriod = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  };
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const nextContributionPeriod = (() => {
    if (!paidThroughPeriod || paidThroughPeriod < currentPeriod) return currentPeriod;
    const [year, month] = paidThroughPeriod.split('-').map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
  })();
  const [nextDueYear, nextDueMonth] = nextContributionPeriod.split('-').map(Number);
  const nextDueDay = Math.min(Math.max(deadlineDay, 1), new Date(Date.UTC(nextDueYear, nextDueMonth, 0)).getUTCDate());
  const nextDueDate = new Date(Date.UTC(nextDueYear, nextDueMonth - 1, nextDueDay));
  const nextDueLabel = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(nextDueDate);
  const reminderDays = Array.isArray(notificationRules.reminderDaysBefore) ? notificationRules.reminderDaysBefore.filter((day: unknown) => Number.isFinite(Number(day))).map(Number) : [7, 3, 1];
  const remindersEnabled = notificationRules.inApp !== false || notificationRules.email === true || notificationRules.sms === true;
  const advancePayment = myContributions
    .filter((item) => item.status === 'PAID' && monthlyAmount > 0 && Number(item.amount) >= monthlyAmount * 2)
    .sort((left, right) => Number(right.amount) - Number(left.amount))[0];
  const monthsCovered = advancePayment?.allocations?.length ?? (advancePayment && monthlyAmount > 0 ? Math.floor(Number(advancePayment.amount) / monthlyAmount) : 0);
  const coverageLabel = (() => {
    const firstPeriod = advancePayment?.allocations?.[0]?.period ?? advancePayment?.period;
    const lastPeriod = advancePayment?.allocations?.[monthsCovered - 1]?.period;
    if (!firstPeriod || monthsCovered < 1) return null;
    const [year, month] = firstPeriod.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const [endYear, endMonth] = (lastPeriod ?? firstPeriod).split('-').map(Number);
    const end = new Date(Date.UTC(endYear, endMonth - 1 + (lastPeriod ? 0 : monthsCovered - 1), 1));
    const format = new Intl.DateTimeFormat('en-KE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${format.format(start)} – ${format.format(end)}`;
  })();

  const downloadMemberStatement = async () => {
    setExportingStatement(true);
    setError(null);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(6, 83, 63);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text('CHAMA360 Member Contribution Statement', 14, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(currentOrganization.name, 14, 21);
      doc.setTextColor(28, 42, 54);

      const memberName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Member';
      const tableTheme = {
        headStyles: { fillColor: [9, 111, 81] as [number, number, number], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 248, 245] as [number, number, number] },
        styles: { fontSize: 8, cellPadding: 2.4 },
        margin: { left: 14, right: 14 },
      };
      autoTable(doc, {
        ...tableTheme,
        startY: 37,
        head: [['Member', 'Monthly amount', 'Paid through', 'Next deadline', 'Outstanding penalties']],
        body: [[memberName, formatMoney(monthlyAmount), paidThroughPeriod ? formatPeriod(paidThroughPeriod) : 'No advance coverage', nextDueLabel, formatMoney(myPenalties)]],
      });
      autoTable(doc, {
        ...tableTheme,
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Period', 'Amount', 'Status', 'Penalty', 'Paid date', 'Reference']],
        body: myContributions.length ? myContributions.map((item) => [item.period ?? '—', formatMoney(item.amount), item.status, formatMoney(item.penalties), item.paidAt?.slice(0, 10) ?? '—', item.reference ?? '—']) : [['—', '—', 'No contribution records', '—', '—', '—']],
      });
      if (myAllocatedPeriods.length) {
        autoTable(doc, {
          ...tableTheme,
          startY: (doc as any).lastAutoTable.finalY + 8,
          head: [['Advance-covered month', 'Coverage status']],
          body: myAllocatedPeriods.map((coveredPeriod) => [formatPeriod(coveredPeriod), 'Paid in advance']),
        });
      }
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 120);
        doc.text(`Generated ${new Date().toLocaleString('en-KE')} · Private member statement`, 14, 287);
        doc.text(`Page ${page} of ${pages}`, pageWidth - 14, 287, { align: 'right' });
      }
      const safeName = memberName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      doc.save(`${safeName || 'member'}-contribution-statement.pdf`);
    } catch (statementError) {
      setError(statementError instanceof Error ? statementError.message : 'Could not generate your statement.');
    } finally {
      setExportingStatement(false);
    }
  };

  const memberPositionPanel = (
    <section className="section-shell overflow-hidden">
      <div className="section-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--ds-text-muted)]">My member portal</p>
          <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Contribution position</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={myPenalties > 0 ? 'error' : 'success'}>{myPenalties > 0 ? `${formatMoney(myPenalties)} penalty` : 'No penalties'}</Badge>
          <Button variant="outline" loading={exportingStatement} onClick={() => void downloadMemberStatement()} startIcon={!exportingStatement ? <FileDown className="h-4 w-4" /> : undefined}>My PDF statement</Button>
        </div>
      </div>
      <div className="section-body grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--ds-primary)]"><CalendarDays className="h-5 w-5" /><strong>Monthly deadline</strong></div>
          <p className="mt-3 text-2xl font-black text-[var(--ds-secondary)]">{nextDueLabel}</p>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{paidThroughPeriod ? `Paid through ${formatPeriod(paidThroughPeriod)} · ` : ''}{monthlyAmount ? `${formatMoney(monthlyAmount)} monthly` : 'Amount set by the Chama'}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-700"><Clock3 className="h-5 w-5" /><strong>Late-payment rule</strong></div>
          <p className="mt-3 text-2xl font-black text-[var(--ds-secondary)]">{penaltyAmount ? formatMoney(penaltyAmount) : 'Configured'}</p>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Applied after the deadline{contributionRules.gracePeriodDays ? ` and ${contributionRules.gracePeriodDays}-day grace period` : ''}.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-emerald-700"><Smartphone className="h-5 w-5" /><strong>M-Pesa payment</strong></div>
          <p className="mt-3 text-2xl font-black text-[var(--ds-secondary)]">{paymentSettings?.mode === 'PAYBILL' ? paymentSettings.paybillNumber ?? 'PayBill' : 'STK Push'}</p>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{paymentSettings?.mode === 'PAYBILL' ? <>Your account: <strong className="text-[var(--ds-secondary)]">{memberPaymentReference}</strong></> : `STK reference: ${memberPaymentReference}`}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sky-700"><BellRing className="h-5 w-5" /><strong>Reminders</strong></div>
          <p className="mt-3 text-2xl font-black text-[var(--ds-secondary)]">{remindersEnabled ? 'Active' : 'Off'}</p>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{remindersEnabled ? `${reminderDays.join(', ')} day reminders, due-today and overdue alerts.` : 'An administrator can enable contribution reminders.'}</p>
        </Card>
      </div>
      {advancePayment ? (
        <div className="mx-4 mb-4 rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:mx-5 sm:mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">Advance contribution received</p><p className="mt-1 text-2xl font-black">{formatMoney(advancePayment.amount)}</p></div>
            <Badge tone="success">{monthsCovered} months covered</Badge>
          </div>
          <p className="mt-3 text-sm">Coverage: <strong>{coverageLabel}</strong> · Paid {advancePayment.paidAt?.slice(0, 10)} · Ref {advancePayment.reference}</p>
          {summary?.creditBalance ? <p className="mt-1 text-sm">Unallocated credit: <strong>{formatMoney(summary.creditBalance)}</strong></p> : null}
        </div>
      ) : null}
    </section>
  );

  const moveCalendarMonth = (offset: number) => {
    const [year = 1970, month = 1] = calendarPeriod.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setCalendarPeriod(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const [calendarYear = 1970, calendarMonth = 1] = calendarPeriod.split('-').map(Number);
  const calendarDate = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
  const daysInCalendarMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
  const calendarOffset = calendarDate.getUTCDay();
  const calendarDeadline = Math.min(Math.max(deadlineDay, 1), daysInCalendarMonth);
  const calendarRecords = contributions.filter((item) => item.period === calendarPeriod);
  const calendarAllocations = contributions.flatMap((item) => item.allocations ?? []).filter((allocation) => allocation.period === calendarPeriod);
  const calendarPaid = calendarRecords.filter((item) => item.status === 'PAID').length;
  const calendarOverdue = calendarRecords.filter((item) => item.status === 'OVERDUE').length;
  const calendarPending = calendarRecords.filter((item) => ['PENDING', 'PARTIAL'].includes(item.status)).length;
  const calendarPenalties = calendarRecords.reduce((sum, item) => sum + Number(item.penalties ?? 0), 0);
  const calendarLabel = new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarDate);
  const calendarState = calendarAllocations.length > 0 ? 'Advance covered' : calendarPaid > 0 ? 'Paid' : calendarOverdue > 0 ? 'Overdue' : calendarPending > 0 ? 'Pending' : 'No obligation';
  const calendarStateTone = calendarState === 'Paid' || calendarState === 'Advance covered' ? 'success' : calendarState === 'Overdue' ? 'error' : calendarState === 'Pending' ? 'warning' : 'neutral';

  const contributionCalendar = (
    <section className="section-shell overflow-hidden">
      <div className="section-header flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-[var(--ds-text-muted)]">Contribution calendar</p><h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">{calendarLabel}</h2></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" aria-label="Previous month" onClick={() => moveCalendarMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setCalendarPeriod(new Date().toISOString().slice(0, 7))}>Today</Button>
          <Button variant="outline" aria-label="Next month" onClick={() => moveCalendarMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="section-body grid gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
          <div className="grid grid-cols-7 overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-border)] gap-px">
            {Array.from({ length: calendarOffset }).map((_, index) => <div key={`blank-${index}`} className="min-h-12 bg-[var(--ds-surface-2)] sm:min-h-16" />)}
            {Array.from({ length: daysInCalendarMonth }, (_, index) => index + 1).map((day) => {
              const isDeadline = day === calendarDeadline;
              return <div key={day} className={`relative min-h-12 bg-[var(--ds-surface)] p-2 text-sm sm:min-h-16 ${isDeadline ? 'ring-2 ring-inset ring-amber-400' : ''}`}><span className={isDeadline ? 'font-black text-amber-700' : 'text-[var(--ds-text)]'}>{day}</span>{isDeadline ? <span className="mt-1 block text-[10px] font-bold uppercase text-amber-700">Deadline</span> : null}</div>;
            })}
          </div>
        </div>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2"><strong className="text-[var(--ds-secondary)]">Month position</strong><Badge tone={calendarStateTone}>{calendarState}</Badge></div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ds-text-muted)]">Deadline</dt><dd className="font-semibold">Day {calendarDeadline}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ds-text-muted)]">Paid records</dt><dd className="font-semibold text-emerald-700">{calendarPaid}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ds-text-muted)]">Advance allocations</dt><dd className="font-semibold text-sky-700">{calendarAllocations.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ds-text-muted)]">Pending</dt><dd className="font-semibold text-amber-700">{calendarPending}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ds-text-muted)]">Overdue</dt><dd className="font-semibold text-rose-700">{calendarOverdue}</dd></div>
            <div className="flex justify-between gap-3 border-t border-[var(--ds-border)] pt-3"><dt className="text-[var(--ds-text-muted)]">Penalties</dt><dd className="font-black text-rose-700">{formatMoney(calendarPenalties)}</dd></div>
          </dl>
        </Card>
      </div>
    </section>
  );

  const mobileLayout = (
    <div className="space-y-4 md:hidden">
      <section className="chama360-module-hero chama360-module-hero-contributions">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>{canRecord ? 'Finance workflow' : 'My contribution records'}</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Contributions</h1>
            <p>{canRecord ? 'Track member payments, record receipts, and keep the chama ledger ready for review.' : 'See your paid and open contributions, download your statement, and check how to pay.'}</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#contribution-ledger-mobile">
              <ClipboardList className="h-4 w-4" />
              {canRecord ? 'Ledger' : 'My records'}
            </a>
            {canRecord ? <a href="#record-contribution-mobile"><Plus className="h-4 w-4" />Record</a> : null}
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Wallet className="h-5 w-5" /></span>
            <p>Total</p>
            <strong>{loading ? '...' : total}</strong>
            <small>{canRecord ? 'Group ledger records' : 'Your records'}</small>
          </article>
          <article>
            <span className="blue"><CheckCircle2 className="h-5 w-5" /></span>
            <p>Paid</p>
            <strong>{loading ? '...' : paid}</strong>
            <small>{canRecord ? 'Completed receipts' : 'Your paid records'}</small>
          </article>
          <article>
            <span className="gold"><Banknote className="h-5 w-5" /></span>
            <p>Mode</p>
            <strong>{paymentSettings?.isEnabled ? 'M-Pesa' : 'Cash'}</strong>
            <small>{pending} pending items</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      {memberPositionPanel}

      {contributionCalendar}

      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard title="Total" value={loading ? '...' : total.toString()} caption="Records" tone="emerald" icon={<Wallet className="h-5 w-5" />} className="p-4" />
        <MetricCard title="Paid" value={loading ? '...' : paid.toString()} caption="Completed" tone="success" icon={<Badge tone="success">Paid</Badge>} className="p-4" />
        <MetricCard title="Pending" value={loading ? '...' : pending.toString()} caption="Open" tone="warning" icon={<Badge tone="warning">Due</Badge>} className="p-4" />
        <MetricCard title="Reversed" value={loading ? '...' : reversed.toString()} caption="Voided" tone="error" icon={<Badge tone="error">Reset</Badge>} className="p-4" />
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Search</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Ledger filters</h2>
        </div>
        <div className="section-body space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={ledgerFilter === 'all'} onClick={() => setLedgerFilter('all')}>
              All
            </Chip>
            <Chip active={ledgerFilter === 'paid'} onClick={() => setLedgerFilter('paid')}>
              Paid
            </Chip>
            <Chip active={ledgerFilter === 'pending'} onClick={() => setLedgerFilter('pending')}>
              Pending
            </Chip>
            <Chip active={ledgerFilter === 'reversed'} onClick={() => setLedgerFilter('reversed')}>
              Reversed
            </Chip>
            <Chip active={false} onClick={() => void loadData()}>
              Refresh
            </Chip>
          </div>
        </div>
      </section>

      <section id="contribution-ledger-mobile" className="space-y-3">
        {loading ? (
          <>
            <div className="h-20 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
            <div className="h-20 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
            <div className="h-20 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
          </>
        ) : filteredContributions.length === 0 ? (
          <EmptyState title="No contribution records yet." description={canRecord ? 'Record a contribution to start the ledger.' : 'Your group treasurer will add contribution records here.'} />
        ) : (
          filteredContributions.map((contribution) => {
            const canReverse = canRecord && contribution.status !== 'REVERSED';
            const canMarkPaid = canRecord && ['PENDING', 'OVERDUE', 'PARTIAL', 'FAILED'].includes(contribution.status);
            const canSelfPay = !canRecord && paymentSettings?.isEnabled && contribution.memberId === user?.id && ['PENDING', 'OVERDUE', 'PARTIAL'].includes(contribution.status);
            return (
              <Card key={contribution.id} className="mobile-finance-card overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{contribution.contributionType ?? 'Contribution'}</p>
                      <h3 className="mt-2 text-lg font-black text-[var(--ds-secondary)]">
                        {contribution.member?.firstName ?? 'Member'} {contribution.member?.lastName ?? ''}
                      </h3>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[contribution.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{contribution.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                      <p className="text-xs text-[var(--ds-text-muted)]">Amount</p>
                      <p className="mt-1 font-bold text-[var(--ds-text)]">{formatMoney(contribution.amount)}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
                      <p className="text-xs text-[var(--ds-text-muted)]">Method</p>
                      <p className="mt-1 font-bold text-[var(--ds-text)]">{contribution.paymentMethod ?? 'Unpaid'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ds-text-muted)]">
                    {contribution.period ? <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">Period {contribution.period}</span> : null}
                    {contribution.paidAt ? <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">Paid {contribution.paidAt.slice(0, 10)}</span> : null}
                    {contribution.reference ? <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">Ref {contribution.reference}</span> : null}
                  </div>
                  <div className="mt-4 grid gap-2">{canSelfPay ? <Button className="w-full" disabled={saving} onClick={() => openStkPayment(contribution)} startIcon={<Smartphone className="h-4 w-4" />}>Pay with STK Push</Button> : null}{canMarkPaid ? <Button className="w-full" disabled={saving} onClick={() => void handleMarkPaid(contribution)} startIcon={<CheckCircle2 className="h-4 w-4" />}>Mark member paid</Button> : null}{canReverse ? <Button variant="outline" className="w-full" disabled={saving} onClick={() => void handleReverse(contribution)} startIcon={<RotateCcw className="h-4 w-4" />}>Reverse</Button> : null}</div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <section id="record-contribution-mobile" className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">{canRecord ? 'Record' : 'Payment guidance'}</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">{canRecord ? 'New contribution' : 'How to contribute'}</h2>
        </div>
        <div className="section-body">
          {canRecord ? <form onSubmit={handleSubmit} className="space-y-4">
            <SelectField label="Member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId ?? member.id}>
                  {member.user?.firstName} {member.user?.lastName}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <TextField label="Period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Type" value={contributionType} onChange={(event) => setContributionType(event.target.value)} />
              <SelectField label="Member payment status" value={contributionStatus} onChange={(event) => setContributionStatus(event.target.value as 'PAID' | 'PENDING')}><option value="PAID">Paid</option><option value="PENDING">Not paid / Due</option></SelectField>
              <SelectField label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="CASH">Cash</option>
                <option value="MPESA">M-Pesa</option>
                <option value="BANK">Bank</option>
              </SelectField>
            </div>
            <TextField label="Reference" value={reference} onChange={(event) => setReference(event.target.value)} />
            <Button type="submit" loading={saving} startIcon={!saving ? <Plus className="h-4 w-4" /> : undefined} className="w-full">
              Record contribution
            </Button>
          </form> : <div className="space-y-3 text-sm text-[var(--ds-text-muted)]"><p>Your treasurer confirms contributions after M-Pesa reconciliation.</p>{paymentSettings?.isEnabled ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><strong>{paymentSettings.mode === 'PAYBILL' ? `PayBill ${paymentSettings.paybillNumber ?? ''}` : 'M-Pesa STK Push'}</strong><p className="mt-1">Use your personal account reference: <strong>{memberPaymentReference}</strong></p><p className="mt-1 text-xs">This reference identifies your payment during automatic reconciliation.</p></div> : null}</div>}
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      {compactLayout ? mobileLayout : <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-contributions">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>{canRecord ? 'Finance workflow' : 'My contribution records'}</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Contributions</h1>
            <p>{canRecord ? 'Track payments, record receipts, and review the contribution ledger with clear finance controls.' : 'See your paid and open contributions, download your statement, and check how to pay.'}</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#contribution-ledger">
              <ClipboardList className="h-4 w-4" />
              {canRecord ? 'Ledger' : 'My records'}
            </a>
            {canRecord ? <a href="#record-contribution"><Plus className="h-4 w-4" />Record</a> : null}
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Wallet className="h-5 w-5" /></span>
            <p>Total</p>
            <strong>{loading ? '...' : total}</strong>
            <small>{canRecord ? 'Group ledger records' : 'Your records'}</small>
          </article>
          <article>
            <span className="blue"><CheckCircle2 className="h-5 w-5" /></span>
            <p>Paid</p>
            <strong>{loading ? '...' : paid}</strong>
            <small>{canRecord ? 'Completed receipts' : 'Your paid records'}</small>
          </article>
          <article>
            <span className="gold"><Banknote className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{loading ? '...' : pending}</strong>
            <small>{reversed} reversed</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      {memberPositionPanel}

      {contributionCalendar}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Total" value={loading ? '...' : total.toString()} caption="Records" tone="emerald" icon={<Wallet className="h-5 w-5" />} />
        <MetricCard title="Paid" value={loading ? '...' : paid.toString()} caption="Completed" tone="success" icon={<Badge tone="success">Paid</Badge>} />
        <MetricCard title="Pending" value={loading ? '...' : pending.toString()} caption="Awaiting payment" tone="warning" icon={<Badge tone="warning">Open</Badge>} />
        <MetricCard title="Reversed" value={loading ? '...' : reversed.toString()} caption="Voided receipts" tone="error" icon={<Badge tone="error">Reset</Badge>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card id="contribution-ledger" className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Ledger</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">{canRecord ? 'Contribution records' : 'My contribution records'}</h2>
            </div>
            <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={ledgerFilter === 'all'} onClick={() => setLedgerFilter('all')}>
              All
            </Chip>
            <Chip active={ledgerFilter === 'paid'} onClick={() => setLedgerFilter('paid')}>
              Paid
            </Chip>
            <Chip active={ledgerFilter === 'pending'} onClick={() => setLedgerFilter('pending')}>
              Pending
            </Chip>
            <Chip active={ledgerFilter === 'reversed'} onClick={() => setLedgerFilter('reversed')}>
              Reversed
            </Chip>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
                <div className="h-16 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
                <div className="h-16 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
              </div>
            ) : filteredContributions.length === 0 ? (
              <EmptyState title="No contribution records match this filter." description="Switch filters or record a new contribution to update the ledger." />
            ) : (
              filteredContributions.map((contribution) => {
                const canReverse = canRecord && contribution.status !== 'REVERSED';
                const canMarkPaid = canRecord && ['PENDING', 'OVERDUE', 'PARTIAL', 'FAILED'].includes(contribution.status);
                const canSelfPay = !canRecord && paymentSettings?.isEnabled && contribution.memberId === user?.id && ['PENDING', 'OVERDUE', 'PARTIAL'].includes(contribution.status);
                return (
                  <Card key={contribution.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ds-secondary)]">{contribution.contributionType ?? 'Contribution'}</p>
                        <p className="text-sm text-[var(--ds-text-muted)]">
                          {contribution.member?.firstName ?? 'Member'} {contribution.member?.lastName ?? ''}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone[contribution.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{contribution.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ds-text-muted)]">
                      <span>{formatMoney(contribution.amount)}</span>
                      {contribution.period ? <span>Period {contribution.period}</span> : null}
                      {contribution.paidAt ? <span>Paid {contribution.paidAt.slice(0, 10)}</span> : null}
                      <span>{contribution.paymentMethod ?? 'Unpaid'}</span>
                      {contribution.reference ? <span>Ref {contribution.reference}</span> : null}
                    </div>
                    {contribution.reverseReason ? <p className="mt-2 text-sm text-[var(--ds-text-muted)]">Reason: {contribution.reverseReason}</p> : null}
                    {canReverse || canMarkPaid || canSelfPay ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canSelfPay ? <Button disabled={saving} onClick={() => openStkPayment(contribution)} startIcon={<Smartphone className="h-4 w-4" />}>Pay with STK Push</Button> : null}
                        {canMarkPaid ? <Button disabled={saving} onClick={() => void handleMarkPaid(contribution)} startIcon={<CheckCircle2 className="h-4 w-4" />}>Mark member paid</Button> : null}
                        {canReverse ? (
                        <Button variant="outline" disabled={saving} onClick={() => void handleReverse(contribution)} startIcon={<RotateCcw className="h-4 w-4" />}>
                          Reverse
                        </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })
            )}
          </div>
        </Card>

        <Card id="record-contribution" className="p-6">
          <p className="text-sm text-[var(--ds-text-muted)]">New entry</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Record contribution</h2>
          {!canRecord ? <p className="mt-2 text-sm text-amber-700">You can view the ledger, but only finance roles can record or reverse contributions.</p> : null}

          {paymentSettings?.isEnabled ? (
            <div className="mt-4 rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">M-Pesa defaults active</p>
              <p className="mt-1">
                {paymentSettings.mode === 'PAYBILL' ? `PayBill ${paymentSettings.paybillNumber ?? 'not set'}` : `Number ${paymentSettings.mpesaNumber ?? 'not set'}`}
                {paymentSettings.accountReference ? ` - Ref ${paymentSettings.accountReference}` : ''}
              </p>
            </div>
          ) : null}

          {canRecord ? <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <SelectField label="Member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId ?? member.id}>
                  {member.user?.firstName} {member.user?.lastName}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <TextField label="Period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Type" value={contributionType} onChange={(event) => setContributionType(event.target.value)} />
              <SelectField label="Member payment status" value={contributionStatus} onChange={(event) => setContributionStatus(event.target.value as 'PAID' | 'PENDING')}><option value="PAID">Paid</option><option value="PENDING">Not paid / Due</option></SelectField>
              <SelectField label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="CASH">Cash</option>
                <option value="MPESA">M-Pesa</option>
                <option value="BANK">Bank</option>
              </SelectField>
            </div>
            <TextField label="Reference" value={reference} onChange={(event) => setReference(event.target.value)} />
            <Button type="submit" loading={saving} startIcon={!saving ? <Plus className="h-4 w-4" /> : undefined} className="w-full">
              Record contribution
            </Button>
          </form> : null}
        </Card>
      </section>
      </div>}
      <Dialog open={actionMode === 'mark-paid'} title="Confirm member payment" description={actionContribution ? `${actionContribution.member?.firstName ?? 'Member'} · ${formatMoney(actionContribution.amount)}` : undefined} onClose={closeActionDialog}>
        <form className="space-y-4" onSubmit={submitMarkPaid}>
          <SelectField label="Payment method" value={actionPaymentMethod} onChange={(event) => setActionPaymentMethod(event.target.value as 'CASH' | 'MPESA' | 'BANK')}>
            <option value="CASH">Cash</option><option value="MPESA">M-Pesa</option><option value="BANK">Bank transfer</option>
          </SelectField>
          <TextField label={actionPaymentMethod === 'CASH' ? 'Receipt reference (optional)' : 'Transaction reference'} value={actionReference} onChange={(event) => setActionReference(event.target.value)} required={actionPaymentMethod !== 'CASH'} />
          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">This will add the payment to the Chama wallet and permanent transaction ledger.</div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeActionDialog} disabled={saving}>Cancel</Button><Button type="submit" loading={saving} startIcon={!saving ? <CheckCircle2 className="h-4 w-4" /> : undefined}>Confirm payment</Button></div>
        </form>
      </Dialog>
      <Dialog open={actionMode === 'reverse'} title="Reverse contribution" description={actionContribution ? `${actionContribution.member?.firstName ?? 'Member'} · ${formatMoney(actionContribution.amount)}` : undefined} onClose={closeActionDialog}>
        <form className="space-y-4" onSubmit={submitReverse}>
          <TextField label="Reason for reversal" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} required minLength={5} />
          <div className="rounded-[var(--ds-radius-lg)] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">This action will reverse the ledger entry and deduct the amount from the Chama wallet. The audit record will remain visible.</div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeActionDialog} disabled={saving}>Cancel</Button><Button type="submit" loading={saving} disabled={reverseReason.trim().length < 5}>Reverse contribution</Button></div>
        </form>
      </Dialog>
      <Dialog open={Boolean(stkContribution)} title="Pay contribution with M-Pesa" description={stkContribution ? `${stkContribution.period ?? 'Monthly contribution'} · ${formatMoney(Number(stkContribution.amount) + Number(stkContribution.penalties ?? 0))}` : undefined} onClose={() => !saving && setStkContribution(null)}>
        <form className="space-y-4" onSubmit={submitStkPayment}>
          <TextField label="M-Pesa phone number" value={stkPhone} onChange={(event) => setStkPhone(event.target.value)} placeholder="0712345678" required />
          <div className="rounded-[var(--ds-radius-lg)] border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Member payment reference: <strong>{memberPaymentReference}</strong></div>
          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">An STK prompt will appear on this phone. Confirm the amount and enter the M-Pesa PIN. The ledger updates after Safaricom confirms payment.</div>
          {stkMessage ? <div className="rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{stkMessage}</div> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setStkContribution(null)}>Cancel</Button><Button type="submit" loading={saving} disabled={!stkPhone.trim() || Boolean(stkMessage)} startIcon={!saving ? <Smartphone className="h-4 w-4" /> : undefined}>Send STK Push</Button></div>
        </form>
      </Dialog>
    </div>
  );
};
