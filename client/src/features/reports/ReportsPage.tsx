import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { useCompactLayout } from '../../hooks/useCompactLayout';
import { organizationService, type ContributionRecord, type InvestmentAsset, type InvestmentPosition, type InvestmentSummary, type OrganizationAuditLogRecord, type OrganizationMemberRecord, type WelfareClaimRecord } from '../../services/organizationService';
import type { Loan, MeetingRecord, VoteRecord } from '../../types';
import { buildMonthlyStatement } from '../../utils/monthlyStatement';
import { Badge, Button, Card, Chip, EmptyState, MetricCard, SparklineChart, ChartCard, WalletCard } from '../../design-system';

const money = (value: number | string | null | undefined) => `KES ${Number(value ?? 0).toLocaleString()}`;
const dateText = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleDateString('en-KE') : '—';
const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const Reports = () => {
  const compactLayout = useCompactLayout();
  const { currentOrganization } = useOrganizationWorkspace();
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [claims, setClaims] = useState<WelfareClaimRecord[]>([]);
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<OrganizationAuditLogRecord[]>([]);
  const [investmentAssets, setInvestmentAssets] = useState<InvestmentAsset[]>([]);
  const [investmentPositions, setInvestmentPositions] = useState<InvestmentPosition[]>([]);
  const [investmentSummary, setInvestmentSummary] = useState<InvestmentSummary | null>(null);
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');
  const [contributionFilter, setContributionFilter] = useState('ALL');
  const [statementMonth, setStatementMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loanFilter, setLoanFilter] = useState('ALL');
  const [welfareFilter, setWelfareFilter] = useState('ALL');
  const [meetingFilter, setMeetingFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'statement' | null>(null);
  const [exportMessage, setExportMessage] = useState('');
  const canUsePremium = useSubscriptionStore((state) => state.canUse);
  const showUpgrade = useSubscriptionStore((state) => state.showUpgrade);
  const runPremiumExport = (action: () => void) => {
    if (!canUsePremium('ADVANCED_EXPORTS')) {
      showUpgrade('ADVANCED_EXPORTS');
      return;
    }
    if (!currentOrganization) return;
    void organizationService.assertReportExportAccess(currentOrganization.id).then(action).catch(() => setError('Report export access could not be verified.'));
  };

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const [contributionData, loanData, claimData, memberData, meetingData] = await Promise.all([
        organizationService.listContributions(currentOrganization.id),
        organizationService.listLoans(currentOrganization.id),
        organizationService.listWelfareClaims(currentOrganization.id),
        organizationService.listMembers(currentOrganization.id),
        organizationService.listMeetings(currentOrganization.id),
      ]);
      setContributions(contributionData);
      setLoans(loanData);
      setClaims(claimData);
      setMembers(memberData);
      setMeetings(meetingData);
      if (currentOrganization.enabledModules?.investments && canUsePremium('INVESTMENT_AUTOMATION')) {
        const portfolio = await organizationService.listInvestments(currentOrganization.id);
        setInvestmentAssets(portfolio.assets); setInvestmentPositions(portfolio.positions); setInvestmentSummary(portfolio.summary);
      } else { setInvestmentAssets([]); setInvestmentPositions([]); setInvestmentSummary(null); }
      if (canUsePremium('VOTING')) {
        const voteGroups = await Promise.all(meetingData.map((meeting) => organizationService.listVotes(currentOrganization.id, meeting.id)));
        setVotes(voteGroups.flat());
      } else setVotes([]);
      if (canUsePremium('AUDIT_LOGS')) setAuditLogs(await organizationService.listAuditLogs(currentOrganization.id));
      else setAuditLogs([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const summary = useMemo(
    () => ({
      contributions: contributions.filter((item) => item.status === 'PAID').length,
      outstandingLoans: loans.filter((item) => item.status === 'ACTIVE' || item.status === 'APPROVED').length,
      welfareClaims: claims.length,
      pendingClaims: claims.filter((item) => item.status === 'PENDING').length,
    }),
    [claims, contributions, loans],
  );

  const sparkData = useMemo(
    () => [contributions.length, loans.length, claims.length, summary.pendingClaims, summary.contributions, summary.outstandingLoans],
    [claims.length, contributions.length, loans.length, summary.contributions, summary.outstandingLoans, summary.pendingClaims],
  );

  const filteredMembers = useMemo(() => members.filter((member) => {
    if (memberStatusFilter === 'ALL') return true;
    if (memberStatusFilter === 'ACTIVE') return member.status === 'ACTIVE';
    if (memberStatusFilter === 'PENDING') return ['PENDING', 'PENDING_APPROVAL', 'INVITATION_SENT'].includes(member.status);
    return ['SUSPENDED', 'EXITED', 'ARCHIVED'].includes(member.status);
  }), [memberStatusFilter, members]);
  const filteredContributions = useMemo(() => contributions.filter((item) => contributionFilter === 'ALL' || item.status === contributionFilter), [contributionFilter, contributions]);
  const filteredLoans = useMemo(() => loans.filter((item) => loanFilter === 'ALL' || item.status === loanFilter), [loanFilter, loans]);
  const filteredClaims = useMemo(() => claims.filter((item) => welfareFilter === 'ALL' || item.status === welfareFilter), [claims, welfareFilter]);
  const filteredMeetings = useMemo(() => meetings.filter((item) => meetingFilter === 'ALL' || item.status === meetingFilter), [meetingFilter, meetings]);

  const exportSummary = useMemo(() => ({
    paidContributions: filteredContributions.filter((item) => item.status === 'PAID').length,
    outstandingLoans: filteredLoans.filter((item) => item.status === 'ACTIVE' || item.status === 'APPROVED').length,
    welfareClaims: filteredClaims.length,
    pendingClaims: filteredClaims.filter((item) => item.status === 'PENDING').length,
  }), [filteredClaims, filteredContributions, filteredLoans]);

  const financials = useMemo(() => ({
    contributionsTotal: filteredContributions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    paidContributionsTotal: filteredContributions.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    loansRequested: filteredLoans.reduce((sum, item) => sum + Number(item.amountRequested ?? 0), 0),
    loansOutstanding: filteredLoans.reduce((sum, item) => sum + Number(item.balance ?? 0), 0),
    welfareRequested: filteredClaims.reduce((sum, item) => sum + Number(item.amountRequested ?? 0), 0),
    welfareApproved: filteredClaims.reduce((sum, item) => sum + Number(item.amountApproved ?? 0), 0),
  }), [filteredClaims, filteredContributions, filteredLoans]);

  const monthlyStatement = useMemo(() => buildMonthlyStatement(contributions, statementMonth), [contributions, statementMonth]);

  const exportMonthlyStatement = async () => {
    if (!currentOrganization) return;
    setExporting('statement');
    setExportMessage('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text(`${currentOrganization.name} — Monthly Contribution Statement`, 14, 18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`Due month: ${statementMonth}   Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 27);
      doc.text(`Paid: ${monthlyStatement.paid}   Due: ${monthlyStatement.due}   Overdue: ${monthlyStatement.overdue}   Partial: ${monthlyStatement.partial}`, 14, 35);
      doc.text(`Scheduled: ${money(monthlyStatement.scheduledAmount)}   Confirmed paid: ${money(monthlyStatement.paidAmount)}`, 14, 42);
      autoTable(doc, {
        startY: 50,
        head: [['Member', 'Type', 'Due date', 'Scheduled amount', 'Status', 'Paid date', 'Reference']],
        body: monthlyStatement.rows.map(({ contribution, status }) => [
          `${contribution.member?.firstName ?? ''} ${contribution.member?.lastName ?? ''}`.trim() || 'Unknown member',
          contribution.contributionType ?? 'Contribution', dateText(contribution.dueDate), money(contribution.amount),
          status, dateText(contribution.paidAt ?? contribution.paidDate), contribution.reference ?? '—',
        ]),
        headStyles: { fillColor: [9, 111, 81] },
        styles: { fontSize: 9 },
      });
      doc.save(`${safeName(currentOrganization.name)}-statement-${statementMonth}.pdf`);
      setExportMessage('Monthly statement downloaded. Confirm any partial payments and late entries before sharing it.');
    } catch (exportError) {
      setExportMessage(exportError instanceof Error ? `Statement failed: ${exportError.message}` : 'Statement failed. Please try again.');
    } finally { setExporting(null); }
  };

  const reportFileBase = `${safeName(currentOrganization?.name ?? 'chama')}-management-report-${new Date().toISOString().slice(0, 10)}`;

  const exportExcel = async () => {
    if (!currentOrganization) return;
    setExporting('excel');
    setExportMessage('');
    try {
    const XLSX = await import('../../utils/spreadsheetExport');
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `${currentOrganization.name} Management Report`,
      Subject: 'Contributions, loans, and welfare management report',
      Author: 'CHAMAZ360',
      CreatedDate: new Date(),
    };

    const addSheet = (name: string, rows: unknown[][], widths: number[]) => {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = widths.map((wch) => ({ wch }));
      const headerRow = rows.findIndex((row) => row.length === 0) + 2;
      sheet['!freeze'] = { xSplit: 0, ySplit: headerRow };
      if (rows.length >= headerRow) sheet['!autofilter'] = { ref: `A${headerRow}:${XLSX.utils.encode_col(widths.length - 1)}${rows.length}` };
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    };

    addSheet('Summary', [
      ['CHAMAZ360 MANAGEMENT REPORT'],
      ['Chama', currentOrganization.name],
      ['Generated', new Date().toLocaleString('en-KE')],
      ['Purpose', 'Management overview for accountability, financial review, and committee decision-making.'],
      [],
      ['Indicator', 'Value', 'Explanation'],
      ['Contribution records', filteredContributions.length, `Contribution entries matching filter: ${contributionFilter.toLowerCase()}.`],
      ['Exported members', filteredMembers.length, `Member register filtered by: ${memberStatusFilter.toLowerCase()}.`],
      ['Paid contributions', exportSummary.paidContributions, 'Filtered contribution entries confirmed as paid.'],
      ['Total contributions', financials.contributionsTotal, 'Combined value of all contribution records.'],
      ['Paid contribution value', financials.paidContributionsTotal, 'Combined value of contributions confirmed as paid.'],
      ['Active/approved loans', exportSummary.outstandingLoans, 'Filtered loans currently approved or in active repayment.'],
      ['Outstanding loan balance', financials.loansOutstanding, 'Total balance still due across all loans.'],
      ['Welfare claims', exportSummary.welfareClaims, 'Filtered welfare requests included in this report.'],
      ['Pending welfare claims', exportSummary.pendingClaims, 'Filtered claims awaiting review or approval.'],
      ['Investment portfolio value', investmentSummary?.currentValue ?? 0, 'Latest combined valuation of active investment assets.'],
      ['Investment gain / loss', investmentSummary?.gainLoss ?? 0, 'Difference between portfolio purchase cost and current valuation.'],
    ], [30, 24, 70]);

    addSheet('Members', [
      ['MEMBER REGISTER'],
      ['Chama', currentOrganization.name],
      ['Explanation', `Member contact, role, account status, joining date, and reliability score. Filter: ${memberStatusFilter === 'ALL' ? 'all statuses' : memberStatusFilter.toLowerCase()}.`],
      [],
      ['Member name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Reliability score'],
      ...filteredMembers.map((member) => [
        `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() || 'Unknown member',
        member.user?.email ?? '—', member.user?.phone ?? '—', member.roleLabel ?? member.role,
        member.status, dateText(member.joinedAt), Number(member.reliabilityScore ?? 0),
      ]),
    ], [28, 32, 18, 22, 20, 18, 20]);

    addSheet('Contributions', [
      ['CONTRIBUTION LEDGER'],
      ['Chama', currentOrganization.name],
      ['Explanation', `Member contribution records matching status filter: ${contributionFilter.toLowerCase()}.`],
      [],
      ['Member', 'Amount (KES)', 'Status', 'Period', 'Months covered', 'Coverage end', 'Penalty (KES)', 'Paid date'],
      ...filteredContributions.map((item) => [
        `${item.member?.firstName ?? ''} ${item.member?.lastName ?? ''}`.trim() || 'Unknown member',
        Number(item.amount ?? 0), item.status, item.period ?? '—', item.allocations?.length ?? 0,
        item.allocations?.at(-1)?.period ?? '—', Number(item.penalties ?? 0), dateText(item.paidAt),
      ]),
    ], [28, 18, 16, 18, 18, 18, 18, 18]);

    if (investmentSummary) {
      addSheet('Investments', [
        ['INVESTMENT PORTFOLIO'], ['Chama', currentOrganization.name], ['Explanation', 'Asset purchase cost, current valuation, and portfolio performance.'], [],
        ['Asset', 'Category', 'Purchase date', 'Purchase cost (KES)', 'Current value (KES)', 'Gain / loss (KES)', 'Units', 'Status'],
        ...investmentAssets.map((asset) => [asset.name, asset.category.replaceAll('_', ' '), asset.purchaseDate, Number(asset.purchaseCost), Number(asset.currentValue), Number(asset.currentValue) - Number(asset.purchaseCost), asset.units, asset.status]),
      ], [34, 22, 18, 22, 22, 20, 14, 16]);
      addSheet('Member Positions', [
        ['MEMBER INVESTMENT POSITIONS'], ['Chama', currentOrganization.name], ['Explanation', 'Estimated ownership and portfolio allocation based on confirmed contribution share.'], [],
        ['Member', 'Confirmed contributions (KES)', 'Ownership %', 'Estimated portfolio value (KES)', 'Allocated gain / loss (KES)'],
        ...investmentPositions.map((position) => [`${position.member.firstName} ${position.member.lastName}`, position.contributed, position.ownershipPercent, position.estimatedValue, position.estimatedGain]),
      ], [30, 28, 18, 30, 28]);
    }

    addSheet('Loans', [
      ['LOAN PORTFOLIO'],
      ['Chama', currentOrganization.name],
      ['Explanation', `Borrower requests and balances matching status filter: ${loanFilter.toLowerCase()}.`],
      [],
      ['Borrower', 'Requested (KES)', 'Approved (KES)', 'Balance (KES)', 'Status'],
      ...filteredLoans.map((item) => [
        `${item.borrower?.firstName ?? ''} ${item.borrower?.lastName ?? ''}`.trim() || 'Unknown borrower',
        Number(item.amountRequested ?? 0), Number(item.amountApproved ?? 0), Number(item.balance ?? 0), item.status,
      ]),
    ], [28, 20, 20, 20, 18]);

    addSheet('Welfare', [
      ['WELFARE CLAIMS'],
      ['Chama', currentOrganization.name],
      ['Explanation', `Welfare requests matching status filter: ${welfareFilter.toLowerCase()}.`],
      [],
      ['Requester', 'Claim type', 'Requested (KES)', 'Approved (KES)', 'Status'],
      ...filteredClaims.map((item) => [
        `${item.requestedBy?.firstName ?? ''} ${item.requestedBy?.lastName ?? ''}`.trim() || 'Unknown requester',
        item.claimType ?? item.type, Number(item.amountRequested ?? 0), Number(item.amountApproved ?? 0), item.status,
      ]),
    ], [28, 24, 20, 20, 18]);

    addSheet('Meetings', [
      ['MEETING REGISTER'], ['Chama', currentOrganization.name], ['Explanation', `Meetings matching status filter: ${meetingFilter.toLowerCase()}.`], [],
      ['Meeting', 'Date', 'Venue', 'Status', 'Agenda items', 'Attendance', 'Resolutions'],
      ...filteredMeetings.map((item) => [item.title, dateText(item.dateTime), item.venue ?? '—', item.status, item.agenda?.length ?? 0, item.attendance?.length ?? 0, item.minutes?.resolutions?.join('; ') || '—']),
    ], [30, 20, 24, 16, 16, 16, 55]);

    if (canUsePremium('VOTING')) addSheet('Voting', [
      ['DIGITAL VOTING REGISTER'], ['Chama', currentOrganization.name], ['Explanation', 'Governance votes, participation, quorum requirements, and closing status.'], [],
      ['Vote', 'Status', 'Options', 'Responses', 'Quorum required', 'Anonymous', 'Closes'],
      ...votes.map((item) => [item.title, item.status, item.options?.map((option) => option.text).join('; ') || '—', item.responses?.length ?? 0, item.quorumRequired ?? 0, item.isAnonymous ? 'Yes' : 'No', dateText(item.closesAt)]),
    ], [32, 16, 55, 16, 18, 14, 20]);

    if (canUsePremium('AUDIT_LOGS')) addSheet('Audit Trail', [
      ['AUDIT TRAIL'], ['Chama', currentOrganization.name], ['Explanation', 'Accountable record of user and system actions.'], [],
      ['Date', 'Action', 'Entity', 'Entity ID', 'Actor', 'Actor email'],
      ...auditLogs.map((item) => [dateText(item.createdAt), item.action, item.entityType, item.entityId, item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System', item.user?.email ?? '—']),
    ], [20, 20, 24, 30, 28, 34]);

    XLSX.writeFile(workbook, `${reportFileBase}.csv`);
    setExportMessage('CSV management report downloaded successfully.');
    } catch (exportError) {
      setExportMessage(exportError instanceof Error ? `CSV export failed: ${exportError.message}` : 'CSV export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!currentOrganization) return;
    setExporting('pdf');
    setExportMessage('');
    try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const addHeader = (title: string, subtitle: string) => {
      doc.setFillColor(6, 83, 63);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(title, 14, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(subtitle, 14, 20);
      doc.setTextColor(26, 40, 54);
    };
    const addFooter = () => {
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 120);
        doc.text(`CHAMAZ360 • ${currentOrganization.name} • Generated ${new Date().toLocaleDateString('en-KE')}`, 14, 202);
        doc.text(`Page ${page} of ${pages}`, pageWidth - 14, 202, { align: 'right' });
      }
    };
    const tableTheme = {
      headStyles: { fillColor: [9, 111, 81] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [241, 248, 245] as [number, number, number] },
      styles: { fontSize: 8, cellPadding: 2.4, overflow: 'linebreak' as const },
      margin: { left: 14, right: 14 },
    };

    addHeader(`${currentOrganization.name} — Management Report`, 'Executive overview of contributions, loans, and welfare activity');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Executive summary', 14, 39);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('This report supports financial accountability, committee review, and member communication. Amounts are shown in Kenyan shillings.', 14, 46);
    autoTable(doc, {
      ...tableTheme,
      startY: 53,
      head: [['Indicator', 'Result', 'Management interpretation']],
      body: [
        ['Paid contributions', `${exportSummary.paidContributions} records • ${money(financials.paidContributionsTotal)}`, 'Filtered member contributions confirmed as received.'],
        ['Loan portfolio', `${exportSummary.outstandingLoans} active • ${money(financials.loansOutstanding)} outstanding`, 'Filtered approved or active loans requiring repayment monitoring.'],
        ['Welfare activity', `${exportSummary.welfareClaims} claims • ${exportSummary.pendingClaims} pending`, 'Filtered member support requests and claims awaiting review.'],
        ['Member register', `${filteredMembers.length} members (${memberStatusFilter.toLowerCase()} filter)`, 'Member names, contacts, roles, status, and joining details included.'],
        ...(investmentSummary ? [['Investment portfolio', `${investmentAssets.length} assets • ${money(investmentSummary.currentValue)} value`, `${money(investmentSummary.gainLoss)} gain/loss at ${investmentSummary.returnPercent.toFixed(2)}% return.`]] : []),
        ['Report coverage', `${filteredMembers.length + filteredContributions.length + filteredLoans.length + filteredClaims.length + filteredMeetings.length} total records`, 'Combined filtered records included in the detailed schedules below.'],
      ],
    });

    doc.addPage(); addHeader('Member Register', `Member roster • Filter applied: ${memberStatusFilter === 'ALL' ? 'All statuses' : memberStatusFilter}`);
    autoTable(doc, { ...tableTheme, startY: 35, head: [['Member', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Score']], body: filteredMembers.map((member) => [
      `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() || 'Unknown member', member.user?.email ?? '—', member.user?.phone ?? '—',
      member.roleLabel ?? member.role, member.status, dateText(member.joinedAt), String(member.reliabilityScore ?? 0),
    ]) });

    doc.addPage(); addHeader('Contribution Ledger', `Detailed member contributions • Filter: ${contributionFilter}`);
    autoTable(doc, { ...tableTheme, startY: 35, head: [['Member', 'Amount', 'Status', 'Period', 'Months', 'Coverage end', 'Penalty', 'Paid date']], body: filteredContributions.map((item) => [
      `${item.member?.firstName ?? ''} ${item.member?.lastName ?? ''}`.trim() || 'Unknown member', money(item.amount), item.status, item.period ?? '—',
      item.allocations?.length ?? 0, item.allocations?.at(-1)?.period ?? '—', money(item.penalties), dateText(item.paidAt),
    ]) });

    if (investmentSummary) {
      doc.addPage(); addHeader('Investment Portfolio', `${investmentAssets.length} assets • Current value ${money(investmentSummary.currentValue)} • Return ${investmentSummary.returnPercent.toFixed(2)}%`);
      autoTable(doc, { ...tableTheme, startY: 35, head: [['Asset', 'Category', 'Purchased', 'Cost', 'Current value', 'Gain / loss', 'Units', 'Status']], body: investmentAssets.map((asset) => [asset.name, asset.category.replaceAll('_', ' '), dateText(asset.purchaseDate), money(asset.purchaseCost), money(asset.currentValue), money(Number(asset.currentValue) - Number(asset.purchaseCost)), String(asset.units), asset.status]) });
      doc.addPage(); addHeader('Member Investment Positions', 'Estimated ownership based on confirmed contribution share');
      autoTable(doc, { ...tableTheme, startY: 35, head: [['Member', 'Contributions', 'Ownership', 'Estimated value', 'Allocated gain / loss']], body: investmentPositions.map((position) => [`${position.member.firstName} ${position.member.lastName}`, money(position.contributed), `${position.ownershipPercent.toFixed(2)}%`, money(position.estimatedValue), money(position.estimatedGain)]) });
    }

    doc.addPage(); addHeader('Loan Portfolio', `Requested, approved, and outstanding loan amounts • Filter: ${loanFilter}`);
    autoTable(doc, { ...tableTheme, startY: 35, head: [['Borrower', 'Requested', 'Approved', 'Balance', 'Status']], body: filteredLoans.map((item) => [
      `${item.borrower?.firstName ?? ''} ${item.borrower?.lastName ?? ''}`.trim() || 'Unknown borrower', money(item.amountRequested), money(item.amountApproved), money(item.balance), item.status,
    ]) });

    doc.addPage(); addHeader('Welfare Claims', `Member welfare requests and approval status • Filter: ${welfareFilter}`);
    autoTable(doc, { ...tableTheme, startY: 35, head: [['Requester', 'Claim type', 'Requested', 'Approved', 'Status']], body: filteredClaims.map((item) => [
      `${item.requestedBy?.firstName ?? ''} ${item.requestedBy?.lastName ?? ''}`.trim() || 'Unknown requester', item.claimType ?? item.type, money(item.amountRequested), money(item.amountApproved), item.status,
    ]) });

    doc.addPage(); addHeader('Meeting Register', `Meeting schedule, attendance, and resolutions • Filter: ${meetingFilter}`);
    autoTable(doc, { ...tableTheme, startY: 35, head: [['Meeting', 'Date', 'Venue', 'Status', 'Agenda', 'Attendance', 'Resolutions']], body: filteredMeetings.map((item) => [item.title, dateText(item.dateTime), item.venue ?? '—', item.status, String(item.agenda?.length ?? 0), String(item.attendance?.length ?? 0), item.minutes?.resolutions?.join('; ') || '—']) });

    if (canUsePremium('VOTING')) {
      doc.addPage(); addHeader('Digital Voting Register', 'Governance votes, options, participation, and status');
      autoTable(doc, { ...tableTheme, startY: 35, head: [['Vote', 'Status', 'Options', 'Responses', 'Quorum', 'Anonymous', 'Closes']], body: votes.map((item) => [item.title, item.status, item.options?.map((option) => option.text).join('; ') || '—', String(item.responses?.length ?? 0), String(item.quorumRequired ?? 0), item.isAnonymous ? 'Yes' : 'No', dateText(item.closesAt)]) });
    }
    if (canUsePremium('AUDIT_LOGS')) {
      doc.addPage(); addHeader('Audit Trail', 'Accountable user and system activity');
      autoTable(doc, { ...tableTheme, startY: 35, head: [['Date', 'Action', 'Entity', 'Entity ID', 'Actor', 'Email']], body: auditLogs.map((item) => [dateText(item.createdAt), item.action, item.entityType, item.entityId, item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System', item.user?.email ?? '—']) });
    }
    addFooter();
    doc.save(`${reportFileBase}.pdf`);
    setExportMessage('PDF report downloaded successfully.');
    } catch (exportError) {
      setExportMessage(exportError instanceof Error ? `PDF export failed: ${exportError.message}` : 'PDF export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to view reports." />;
  }

  const mobileLayout = (
    <div className="space-y-4 md:hidden">
      <section className="hero-card mobile-finance-card overflow-hidden p-0">
        <div className="mobile-primary-strip p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Reports</p>
          <h1 className="mt-2 text-2xl font-black">Portfolio summary</h1>
          <p className="mt-1 text-sm text-white/82">{currentOrganization.name}</p>
        </div>
        <div className="p-4">
          <WalletCard
            name="Report snapshot"
            balance={money(contributions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0))}
            detail={`${loans.length} loans | ${claims.length} claims`}
            status="Exports ready"
          />
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard title="Paid" value={loading ? '...' : summary.contributions.toString()} caption="Contributions" tone="success" icon={<Badge tone="success">Paid</Badge>} className="p-4" />
        <MetricCard title="Loans" value={loading ? '...' : summary.outstandingLoans.toString()} caption="Active" tone="navy" icon={<Badge tone="info">Loan</Badge>} className="p-4" />
        <MetricCard title="Claims" value={loading ? '...' : summary.welfareClaims.toString()} caption="Total" tone="gold" icon={<Badge tone="accent">Claims</Badge>} className="p-4" />
        <MetricCard title="Pending" value={loading ? '...' : summary.pendingClaims.toString()} caption="Review" tone="warning" icon={<Badge tone="warning">Open</Badge>} className="p-4" />
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Charts</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Portfolio snapshot</h2>
        </div>
        <div className="section-body">
          <ChartCard title="Activity mix" subtitle="Relative volumes">
            <SparklineChart data={sparkData} />
          </ChartCard>
        </div>
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Exports</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Download reports</h2>
        </div>
        <div className="section-body flex flex-wrap gap-2">
          <p className="w-full text-sm font-semibold text-[var(--ds-secondary)]">Member list filter</p>
          {(['ALL', 'ACTIVE', 'PENDING', 'INACTIVE'] as const).map((status) => (
            <Chip key={status} active={memberStatusFilter === status} onClick={() => setMemberStatusFilter(status)}>
              {status === 'ALL' ? `All members (${members.length})` : `${status.charAt(0)}${status.slice(1).toLowerCase()} (${members.filter((member) => status === 'ACTIVE' ? member.status === 'ACTIVE' : status === 'PENDING' ? ['PENDING', 'PENDING_APPROVAL', 'INVITATION_SENT'].includes(member.status) : ['SUSPENDED', 'EXITED', 'ARCHIVED'].includes(member.status)).length})`}
            </Chip>
          ))}
          <div className="grid w-full grid-cols-2 gap-2">
            {[
              ['Contributions', contributionFilter, setContributionFilter, contributions],
              ['Loans', loanFilter, setLoanFilter, loans],
              ['Welfare', welfareFilter, setWelfareFilter, claims],
              ['Meetings', meetingFilter, setMeetingFilter, meetings],
            ].map(([label, value, setter, records]) => (
              <label key={label as string} className="text-xs font-bold text-[var(--ds-secondary)]">{label as string}
                <select className="input mt-1 w-full" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)}>
                  <option value="ALL">All</option>
                  {[...new Set((records as Array<{ status: string }>).map((item) => item.status))].sort().map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="w-full border-t border-[var(--ds-border)]" />
          <Chip active onClick={() => runPremiumExport(exportPdf)}>
            {exporting === 'pdf' ? 'Preparing PDF…' : 'Complete PDF'}
          </Chip>
          <Chip active onClick={() => runPremiumExport(exportExcel)}>
            {exporting === 'excel' ? 'Preparing CSV…' : 'Complete CSV'}
          </Chip>
          <Chip active onClick={() => void loadData()}>
            Refresh
          </Chip>
          {exportMessage ? <p className="w-full text-sm font-semibold text-[var(--ds-secondary)]" role="status">{exportMessage}</p> : null}
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Monthly meeting paperwork · Starter</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Contribution statement</h2>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">Review contributions due in a month, then download a shareable PDF for your meeting.</p>
        </div>
        <div className="section-body space-y-4">
          <label className="block max-w-xs text-sm font-semibold text-[var(--ds-secondary)]">Due month
            <input className="input mt-2 w-full" type="month" value={statementMonth} onChange={(event) => setStatementMonth(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Paid', monthlyStatement.paid], ['Due', monthlyStatement.due], ['Overdue', monthlyStatement.overdue], ['Partial', monthlyStatement.partial]] as const).map(([label, value]) =>
              <div key={label} className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-3"><p className="text-xs text-[var(--ds-text-muted)]">{label}</p><strong className="text-xl text-[var(--ds-secondary)]">{loading ? '…' : value}</strong></div>)}
          </div>
          <p className="text-sm text-[var(--ds-text-muted)]">{monthlyStatement.rows.length} scheduled records · {money(monthlyStatement.paidAmount)} confirmed paid of {money(monthlyStatement.scheduledAmount)} scheduled. Partial amounts need review in the contribution ledger.</p>
          <Button disabled={loading || exporting !== null || !statementMonth} onClick={() => runPremiumExport(() => void exportMonthlyStatement())} startIcon={<FileDown className="h-4 w-4" />}>
            {exporting === 'statement' ? 'Preparing statement…' : 'Download monthly statement PDF'}
          </Button>
          {exportMessage ? <p className="text-sm" role="status">{exportMessage}</p> : null}
        </div>
      </section>
      {compactLayout ? mobileLayout : <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-reports">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Reports</span>
            <strong>Exports ready</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Exports and summaries</h1>
            <small>Generate working summaries and download contribution, loan, and welfare ledgers for review.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#report-exports">
              <Download className="h-4 w-4" />
              Exports
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><FileDown className="h-5 w-5" /></span>
            <p>Paid</p>
            <strong>{loading ? '...' : summary.contributions.toString()}</strong>
            <small>Contributions</small>
          </article>
          <article>
            <span className="blue"><FileDown className="h-5 w-5" /></span>
            <p>Loans</p>
            <strong>{loading ? '...' : summary.outstandingLoans.toString()}</strong>
            <small>Active</small>
          </article>
          <article>
            <span className="gold"><FileDown className="h-5 w-5" /></span>
            <p>Claims</p>
            <strong>{loading ? '...' : summary.welfareClaims.toString()}</strong>
            <small>Total welfare</small>
          </article>
          <article>
            <span className="pink"><FileDown className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{loading ? '...' : summary.pendingClaims.toString()}</strong>
            <small>Need review</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Paid contributions" value={loading ? '...' : summary.contributions.toString()} caption="Completed entries" tone="emerald" icon={<Badge tone="success">Paid</Badge>} />
        <MetricCard title="Loans active" value={loading ? '...' : summary.outstandingLoans.toString()} caption="In circulation" tone="navy" icon={<Badge tone="info">Loan</Badge>} />
        <MetricCard title="Welfare claims" value={loading ? '...' : summary.welfareClaims.toString()} caption="Total claims" tone="gold" icon={<Badge tone="accent">Claims</Badge>} />
        <MetricCard title="Pending claims" value={loading ? '...' : summary.pendingClaims.toString()} caption="Need review" tone="warning" icon={<Badge tone="warning">Open</Badge>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <ChartCard title="Portfolio snapshot" subtitle="Relative volumes">
          <SparklineChart data={sparkData} />
        </ChartCard>

        <Card id="report-exports" className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Exports</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Download reports</h2>
            </div>
            <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Member register filter</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['ALL', 'ACTIVE', 'PENDING', 'INACTIVE'] as const).map((status) => (
                <Chip key={status} active={memberStatusFilter === status} onClick={() => setMemberStatusFilter(status)}>
                  {status === 'ALL' ? `All (${members.length})` : status.charAt(0) + status.slice(1).toLowerCase()}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--ds-text-muted)]">
              The selected filter exports {filteredMembers.length} of {members.length} members in both PDF and CSV.
            </p>
            <div className="mt-4 grid gap-3 border-t border-[var(--ds-border)] pt-4 sm:grid-cols-2">
              {[
                ['Contributions', contributionFilter, setContributionFilter, contributions],
                ['Loans', loanFilter, setLoanFilter, loans],
                ['Welfare', welfareFilter, setWelfareFilter, claims],
                ['Meetings', meetingFilter, setMeetingFilter, meetings],
              ].map(([label, value, setter, records]) => (
                <label key={label as string} className="text-xs font-bold text-[var(--ds-secondary)]">{label as string} status
                  <select className="input mt-1 w-full" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)}>
                    <option value="ALL">All statuses</option>
                    {[...new Set((records as Array<{ status: string }>).map((item) => item.status))].sort().map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--ds-text-muted)]">Exporting {filteredContributions.length} contributions, {filteredLoans.length} loans, {filteredClaims.length} welfare claims, and {filteredMeetings.length} meetings.</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ds-text-muted)]">
            Both formats include an executive summary plus filtered member, contribution, loan, welfare, meeting, voting, and audit schedules permitted by your plan. Generate the report after refreshing to include the latest records.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => runPremiumExport(exportPdf)} disabled={loading || exporting !== null} className="dashboard-tile p-5 text-left disabled:opacity-50">
              <FileText className="h-6 w-6 text-rose-600" />
              <p className="mt-3 font-semibold text-[var(--ds-secondary)]">Professional PDF report</p>
              <p className="mt-1 text-sm leading-6 text-[var(--ds-text-muted)]">
                Branded, print-ready management report with explanations, totals, page numbers, and detailed tables.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ds-secondary-strong)]">
                <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </span>
            </button>
            <button type="button" onClick={() => runPremiumExport(exportExcel)} disabled={loading || exporting !== null} className="dashboard-tile p-5 text-left disabled:opacity-50">
              <FileSpreadsheet className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 font-semibold text-[var(--ds-secondary)]">CSV analysis report</p>
              <p className="mt-1 text-sm leading-6 text-[var(--ds-text-muted)]">
                Spreadsheet-compatible sections with an executive summary, member register, financial ledgers, and governance records.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ds-secondary-strong)]">
                <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Preparing CSV…' : 'Download CSV'}
              </span>
            </button>
          </div>
          <div className="mt-4 rounded-[var(--ds-radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-black text-emerald-900">Chama Vault</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">Download an authoritative archive of members, contributions, loans, welfare, meetings, votes, transactions, and audit logs so records survive Treasurer changes.</p>
            <Button className="mt-3" onClick={() => currentOrganization && void organizationService.downloadVault(currentOrganization.id)} startIcon={<Download className="h-4 w-4" />}>Download Chama Vault</Button>
          </div>
          {exportMessage ? <p className="mt-4 text-sm font-semibold text-[var(--ds-secondary)]" role="status">{exportMessage}</p> : null}
        </Card>
      </section>
      </div>}
    </div>
  );
};
