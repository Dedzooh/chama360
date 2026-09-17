// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { allocatePaidContribution } from '../services/contributionAllocationService';
import { IdentityProtectionService } from '../services/identityProtectionService';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'investment.demo@chama360.co.ke';
const DEMO_PASSWORD = 'Chama360Demo!2026';
const DEMO_SLUG = 'umoja-vision-investment-demo';
const DEMO_SHORT_CODE = 'UVI360';

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const monthDate = (offset: number, day = 10) => {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, day, 9, 0, 0));
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const people = [
    { email: DEMO_EMAIL, phone: '+254711900001', nationalId: 'DEMO900001', firstName: 'Amina', lastName: 'Mwangi' },
    { email: 'grace.demo@chama360.co.ke', phone: '+254711900002', nationalId: 'DEMO900002', firstName: 'Grace', lastName: 'Wanjiku' },
    { email: 'david.demo@chama360.co.ke', phone: '+254711900003', nationalId: 'DEMO900003', firstName: 'David', lastName: 'Otieno' },
    { email: 'faith.demo@chama360.co.ke', phone: '+254711900004', nationalId: 'DEMO900004', firstName: 'Faith', lastName: 'Njeri' },
    { email: 'peter.demo@chama360.co.ke', phone: '+254711900005', nationalId: 'DEMO900005', firstName: 'Peter', lastName: 'Mutua' },
    { email: 'chair.demo@chama360.co.ke', phone: '+254711900006', nationalId: 'DEMO900006', firstName: 'Joseph', lastName: 'Kamau' },
    { email: 'auditor.demo@chama360.co.ke', phone: '+254711900007', nationalId: 'DEMO900007', firstName: 'Lucy', lastName: 'Achieng' },
  ];

  const users = [];
  for (const person of people) {
    const { nationalId, ...profile } = person;
    const protectedIdentity = IdentityProtectionService.protect(nationalId);
    users.push(await prisma.user.upsert({
      where: { email: person.email },
      update: { ...profile, ...protectedIdentity, passwordHash, emailVerifiedAt: new Date(), isActive: true, kycStatus: 'VERIFIED' },
      create: { ...profile, ...protectedIdentity, passwordHash, emailVerifiedAt: new Date(), isActive: true, kycStatus: 'VERIFIED' },
    }));
  }
  const [owner, treasurer, secretary, memberOne, memberTwo, chair, auditor] = users;

  const enabledModules = {
    savings: true,
    contributions: true,
    loans: false,
    welfare: false,
    investments: true,
    meetings: true,
    voting: true,
    fines: true,
    reports: true,
    documents: true,
    mpesa: true,
  };
  const contributionRules = {
    amount: 1500,
    frequency: 'monthly',
    deadlineDay: 10,
    dueDate: monthDate(0).toISOString().slice(0, 10),
    gracePeriodDays: 0,
    allowPartialPayments: true,
    allocateOldestOutstandingFirst: true,
    allowAdvancePayments: true,
    penaltyRules: { lateContributionPenalty: 200, penaltyType: 'FIXED', gracePeriodDays: 0, compoundPenalties: false },
  };

  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_SLUG },
    update: {
      name: 'Umoja Vision Investment Chama',
      organizationType: 'CHAMA',
      chamaType: 'INVESTMENT',
      enabledModules,
      description: 'A presentation-ready investment group demonstrating contributions, governance, reports, and M-Pesa workflows.',
      status: 'ACTIVE',
      metadata: {
        shortCode: DEMO_SHORT_CODE,
        presentationDemo: true,
        investmentPortfolio: [
          { id: 'demo-treasury-bond', name: 'Kenya Treasury Bond 2029', category: 'TREASURY_BOND', purchaseDate: '2026-02-15', purchaseCost: 100000, currentValue: 106500, units: 1, status: 'ACTIVE', notes: 'Approved by member vote; semi-annual coupon income.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
          { id: 'demo-money-market', name: 'Umoja Money Market Fund', category: 'MONEY_MARKET', purchaseDate: '2026-04-01', purchaseCost: 75000, currentValue: 78400, units: 75000, status: 'ACTIVE', notes: 'Liquidity reserve earning market returns.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
          { id: 'demo-shares', name: 'NSE Dividend Shares Basket', category: 'SHARES', purchaseDate: '2026-05-20', purchaseCost: 50000, currentValue: 53600, units: 1200, status: 'ACTIVE', notes: 'Diversified listed equities portfolio.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
        ],
        paymentSettings: { mode: 'PAYBILL', paybillNumber: '999999', accountNumber: 'UVI-MEMBER', accountReference: 'UVI360', transactionDesc: 'Monthly investment contribution', isEnabled: true },
      },
    },
    create: {
      name: 'Umoja Vision Investment Chama',
      organizationType: 'CHAMA',
      chamaType: 'INVESTMENT',
      enabledModules,
      slug: DEMO_SLUG,
      description: 'A presentation-ready investment group demonstrating contributions, governance, reports, and M-Pesa workflows.',
      status: 'ACTIVE',
      createdById: owner.id,
      metadata: {
        shortCode: DEMO_SHORT_CODE,
        presentationDemo: true,
        investmentPortfolio: [
          { id: 'demo-treasury-bond', name: 'Kenya Treasury Bond 2029', category: 'TREASURY_BOND', purchaseDate: '2026-02-15', purchaseCost: 100000, currentValue: 106500, units: 1, status: 'ACTIVE', notes: 'Approved by member vote; semi-annual coupon income.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
          { id: 'demo-money-market', name: 'Umoja Money Market Fund', category: 'MONEY_MARKET', purchaseDate: '2026-04-01', purchaseCost: 75000, currentValue: 78400, units: 75000, status: 'ACTIVE', notes: 'Liquidity reserve earning market returns.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
          { id: 'demo-shares', name: 'NSE Dividend Shares Basket', category: 'SHARES', purchaseDate: '2026-05-20', purchaseCost: 50000, currentValue: 53600, units: 1200, status: 'ACTIVE', notes: 'Diversified listed equities portfolio.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: owner.id },
        ],
        paymentSettings: { mode: 'PAYBILL', paybillNumber: '999999', accountNumber: 'UVI-MEMBER', accountReference: 'UVI360', transactionDesc: 'Monthly investment contribution', isEnabled: true },
      },
    },
  });

  const roleDefinitions = [
    { name: 'FOUNDER', label: 'Owner / Founder', permissions: ['*'] },
    { name: 'CHAIR', label: 'Chairperson', permissions: ['MANAGE_VOTING', 'APPROVE_WELFARE'] },
    { name: 'SECRETARY', label: 'Secretary', permissions: ['CREATE_MEETINGS', 'MANAGE_ATTENDANCE', 'RECORD_MINUTES', 'VIEW_MEMBER_CONTACTS'] },
    { name: 'TREASURER', label: 'Treasurer', permissions: ['VIEW_FINANCIALS', 'VIEW_MEMBER_CONTACTS', 'VIEW_AUDIT_LOGS'] },
    { name: 'AUDITOR', label: 'Auditor', permissions: ['VIEW_FINANCIALS', 'VIEW_AUDIT_LOGS'] },
    { name: 'MEMBER', label: 'Member', permissions: [] },
  ];
  const roles = {};
  for (const role of roleDefinitions) {
    roles[role.name] = await prisma.organizationRole.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: role.name } },
      update: { label: role.label, permissions: role.permissions, isSystemDefault: true },
      create: { organizationId: organization.id, name: role.name, label: role.label, permissions: role.permissions, isSystemDefault: true },
    });
  }

  const memberRoles = ['FOUNDER', 'TREASURER', 'SECRETARY', 'MEMBER', 'MEMBER', 'CHAIR', 'AUDITOR'];
  for (let index = 0; index < users.length; index += 1) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: users[index].id } },
      update: { roleId: roles[memberRoles[index]].id, status: 'ACTIVE' },
      create: { organizationId: organization.id, userId: users[index].id, roleId: roles[memberRoles[index]].id, status: 'ACTIVE' },
    });
  }

  await prisma.organizationSettings.upsert({
    where: { organizationId: organization.id },
    update: { contributionRules, notificationRules: { inApp: true, email: true, sms: true, reminderDaysBefore: [7, 3, 1], overdueReminderFrequencyDays: 3 } },
    create: { organizationId: organization.id, contributionRules, welfareRules: {}, loanRules: {}, notificationRules: { inApp: true, email: true, sms: true, reminderDaysBefore: [7, 3, 1], overdueReminderFrequencyDays: 3 }, securityRules: {} },
  });

  const chama = await prisma.chama.upsert({
    where: { shortCode: DEMO_SHORT_CODE },
    update: { name: organization.name, description: organization.description, type: 'INVESTMENT', status: 'ACTIVE', organizationId: organization.id, modules: enabledModules, settings: { contributionRules }, activatedAt: new Date() },
    create: { name: organization.name, shortCode: DEMO_SHORT_CODE, description: organization.description, type: 'INVESTMENT', status: 'ACTIVE', visibility: 'INVITE_ONLY', createdById: owner.id, organizationId: organization.id, modules: enabledModules, settings: { contributionRules }, activatedAt: new Date() },
  });

  for (let index = 0; index < users.length; index += 1) {
    const legacyRole = memberRoles[index] === 'SECRETARY' ? 'SECRETARY' : memberRoles[index];
    await prisma.chamaMembership.upsert({
      where: { chamaId_userId: { chamaId: chama.id, userId: users[index].id } },
      update: { role: legacyRole, status: 'ACTIVE', reliabilityScore: index === 4 ? 0.78 : 0.95 },
      create: { chamaId: chama.id, userId: users[index].id, role: legacyRole, status: 'ACTIVE', reliabilityScore: index === 4 ? 0.78 : 0.95 },
    });
  }

  await prisma.organizationSubscription.upsert({
    where: { organizationId: organization.id },
    update: { plan: 'INVESTMENT_AUTOMATION', status: 'ACTIVE', billingCycle: 'ANNUAL', currentPeriodStart: new Date(), currentPeriodEnd: monthDate(12), gracePeriodEnd: null, cancelAtPeriodEnd: false, provider: 'PRESENTATION_DEMO', providerReference: `DEMO-${organization.id}` },
    create: { organizationId: organization.id, plan: 'INVESTMENT_AUTOMATION', status: 'ACTIVE', billingCycle: 'ANNUAL', currentPeriodStart: new Date(), currentPeriodEnd: monthDate(12), provider: 'PRESENTATION_DEMO', providerReference: `DEMO-${organization.id}` },
  });

  const samples = [
    { user: owner, offset: -2, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-001' },
    { user: owner, offset: -1, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-002' },
    { user: memberOne, offset: 0, amount: 15000, status: 'PAID', penalties: 0, ref: 'UVI-ADVANCE-10M' },
    { user: treasurer, offset: -2, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-003' },
    { user: treasurer, offset: -1, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-004' },
    { user: treasurer, offset: 0, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-005' },
    { user: secretary, offset: -1, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-006' },
    { user: secretary, offset: 0, amount: 750, status: 'PARTIAL', penalties: 0, ref: 'UVI-DEMO-007' },
    { user: memberOne, offset: -1, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-008' },
    { user: memberOne, offset: 0, amount: 1500, status: 'PENDING', penalties: 0, ref: 'UVI-DEMO-009' },
    { user: memberTwo, offset: -1, amount: 1500, status: 'OVERDUE', penalties: 200, ref: 'UVI-DEMO-010' },
    { user: memberTwo, offset: 0, amount: 1500, status: 'PENDING', penalties: 0, ref: 'UVI-DEMO-011' },
    { user: chair, offset: 0, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-012' },
    { user: auditor, offset: 0, amount: 1500, status: 'PAID', penalties: 0, ref: 'UVI-DEMO-013' },
  ];

  for (const sample of samples) {
    const existing = await prisma.contribution.findFirst({ where: { organizationId: organization.id, reference: sample.ref } });
    const dueDate = monthDate(sample.offset);
    const paid = sample.status === 'PAID';
    const data = {
      chamaId: chama.id,
      organizationId: organization.id,
      memberId: sample.user.id,
      amount: sample.amount,
      contributionType: sample.ref.includes('ADVANCE') ? 'ADVANCE_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      period: monthKey(dueDate),
      dueDate,
      paidDate: paid ? new Date(dueDate.getTime() - 2 * 86400000) : null,
      paidAt: paid ? new Date(dueDate.getTime() - 2 * 86400000) : null,
      status: sample.status,
      paymentMethod: paid ? 'MPESA' : null,
      reference: sample.ref,
      transactionRef: paid ? sample.ref : null,
      recordedById: owner.id,
      penalties: sample.penalties,
    };
    if (existing) await prisma.contribution.update({ where: { id: existing.id }, data });
    else await prisma.contribution.create({ data });
  }
  const advanceContribution = await prisma.contribution.findFirst({ where: { organizationId: organization.id, reference: 'UVI-ADVANCE-10M' } });
  if (advanceContribution) await prisma.$transaction((tx) => allocatePaidContribution(tx, advanceContribution));
  const persistedAllocations = advanceContribution ? await prisma.contributionAllocation.findMany({ where: { sourceContributionId: advanceContribution.id }, orderBy: { period: 'asc' } }) : [];

  for (const demoUser of [secretary, memberOne, memberTwo]) {
    await prisma.notificationPreferences.upsert({
      where: { userId: demoUser.id },
      update: { inAppEnabled: true, emailEnabled: true, smsEnabled: true },
      create: { userId: demoUser.id, inAppEnabled: true, emailEnabled: true, smsEnabled: true, pushEnabled: true },
    });
  }

  const demoNotifications = [
    {
      key: 'demo-reminder-david-partial',
      user: secretary,
      type: 'CONTRIBUTION_DUE',
      priority: 'IMPORTANT',
      title: 'Monthly contribution is partially paid',
      message: `You have paid KES 750 of KES 1,500 for ${monthKey(monthDate(0))}. Pay the KES 750 balance by day 10 to avoid the KES 200 late penalty.`,
    },
    {
      key: 'demo-reminder-faith-advance',
      user: memberOne,
      type: 'GENERAL_UPDATE',
      priority: 'INFO',
      title: 'Advance contribution allocated',
      message: `Your KES 15,000 payment covers ${persistedAllocations.length || 10} monthly contributions${persistedAllocations.length ? ` through ${persistedAllocations[persistedAllocations.length - 1].period}` : ''}. No payment is due for the covered months.`,
    },
    {
      key: 'demo-reminder-peter-overdue',
      user: memberTwo,
      type: 'CONTRIBUTION_DUE',
      priority: 'CRITICAL',
      title: 'Contribution overdue and penalty applied',
      message: `Your ${monthKey(monthDate(-1))} contribution is overdue. KES 1,500 plus the KES 200 late penalty is outstanding.`,
    },
  ];

  for (const item of demoNotifications) {
    await prisma.notification.upsert({
      where: { dedupeKey: item.key },
      update: { recipientId: item.user.id, organizationId: organization.id, chamaId: chama.id, type: item.type, priority: item.priority, title: item.title, message: item.message, status: 'DELIVERED', sentAt: new Date(), acknowledgedAt: null },
      create: {
        dedupeKey: item.key,
        recipientId: item.user.id,
        organizationId: organization.id,
        chamaId: chama.id,
        type: item.type,
        priority: item.priority,
        title: item.title,
        message: item.message,
        status: 'DELIVERED',
        sentAt: new Date(),
        channels: { create: [{ type: 'IN_APP', address: item.user.id, status: 'DELIVERED', deliveredAt: new Date() }] },
      },
    });
  }

  await prisma.transaction.upsert({
    where: { idempotencyKey: 'C2B:QVI7DEMO99' },
    update: {
      chamaId: chama.id,
      organizationId: organization.id,
      fromMemberId: null,
      amount: 1500,
      status: 'PENDING',
      metadata: { paymentMethod: 'MPESA', mpesaReceiptNumber: 'QVI7DEMO99', billRefNumber: 'UVI-WRONGREF', phoneNumber: '254711999999', transactionDate: new Date().toISOString(), source: 'C2B_PAYBILL', reconciliationRequired: true, reason: 'MEMBER_REFERENCE_NOT_MATCHED', presentationDemo: true },
    },
    create: {
      chamaId: chama.id,
      organizationId: organization.id,
      type: 'CONTRIBUTION',
      amount: 1500,
      reference: 'MPESA-C2B-QVI7DEMO99',
      idempotencyKey: 'C2B:QVI7DEMO99',
      status: 'PENDING',
      metadata: { paymentMethod: 'MPESA', mpesaReceiptNumber: 'QVI7DEMO99', billRefNumber: 'UVI-WRONGREF', phoneNumber: '254711999999', transactionDate: new Date().toISOString(), source: 'C2B_PAYBILL', reconciliationRequired: true, reason: 'MEMBER_REFERENCE_NOT_MATCHED', presentationDemo: true },
    },
  });

  const paidTotal = samples.filter((sample) => sample.status === 'PAID').reduce((total, sample) => total + sample.amount, 0);
  await prisma.organizationWallet.upsert({
    where: { organizationId: organization.id },
    update: { balance: paidTotal, currency: 'KES' },
    create: { organizationId: organization.id, balance: paidTotal, currency: 'KES' },
  });

  const meetingDate = monthDate(1, 6);
  const meeting = await prisma.meeting.findFirst({ where: { organizationId: organization.id, title: 'Quarterly Investment Review' } })
    ?? await prisma.meeting.create({
      data: {
        organizationId: organization.id,
        createdById: owner.id,
        title: 'Quarterly Investment Review',
        dateTime: meetingDate,
        scheduledFor: meetingDate,
        venue: 'Umoja Community Hall',
        location: 'Umoja Community Hall, Nairobi',
        agenda: ['Review contribution performance', 'Approve the next investment opportunity', 'Member questions'],
        status: 'SCHEDULED',
      },
    });

  let vote = await prisma.vote.findFirst({ where: { organizationId: organization.id, meetingId: meeting.id, title: 'Approve Treasury Bond Investment' } });
  if (!vote) {
    vote = await prisma.vote.create({
      data: {
        chamaId: chama.id,
        organizationId: organization.id,
        meetingId: meeting.id,
        createdById: owner.id,
        title: 'Approve Treasury Bond Investment',
        description: 'Members are voting on allocating KES 100,000 from available funds to a Treasury bond investment.',
        type: 'SIMPLE_MAJORITY',
        quorumRequired: 3,
        startDate: new Date(),
        endDate: monthDate(1, 5),
        closesAt: monthDate(1, 5),
        status: 'ACTIVE',
        options: { create: [{ text: 'Approve' }, { text: 'Reject' }, { text: 'Request more information' }] },
      },
    });
  }

  console.log(JSON.stringify({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    organization: organization.name,
    plan: 'Investment Automation',
    members: users.length,
    walletBalance: paidTotal,
    meeting: meeting.title,
    vote: vote.title,
    advanceCoverage: { months: persistedAllocations.length, first: persistedAllocations[0]?.period, last: persistedAllocations[persistedAllocations.length - 1]?.period },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
