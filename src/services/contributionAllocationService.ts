const periodPattern = /^\d{4}-\d{2}$/;
const addMonths = (period: string, offset: number) => { const [year = 1970, month = 1] = period.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1 + offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; };
const currentPeriod = () => { const now = new Date(); return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`; };

export async function allocatePaidContribution(tx: any, contribution: any) {
  if (!contribution.organizationId || contribution.status !== 'PAID') return;
  const organization = await tx.organization.findUnique({ where: { id: contribution.organizationId }, include: { settings: true } });
  const rules = organization?.settings?.contributionRules as any;
  const monthlyAmount = Number(rules?.amount ?? 0);
  if (!rules?.allowAdvancePayments || monthlyAmount <= 0) return;
  await tx.contributionAllocation.deleteMany({ where: { sourceContributionId: contribution.id } });
  const amount = Number(contribution.amount);
  const fullMonths = Math.floor(amount / monthlyAmount);
  const startPeriod = periodPattern.test(contribution.period ?? '') ? contribution.period : currentPeriod();
  for (let index = 0; index < fullMonths; index += 1) await tx.contributionAllocation.create({ data: { organizationId: contribution.organizationId, sourceContributionId: contribution.id, memberId: contribution.memberId, period: addMonths(startPeriod, index), amount: monthlyAmount, monthlyAmount } });
  const remainder = Math.round((amount - fullMonths * monthlyAmount) * 100) / 100;
  await tx.contributionCredit.upsert({ where: { organizationId_memberId: { organizationId: contribution.organizationId, memberId: contribution.memberId } }, create: { organizationId: contribution.organizationId, memberId: contribution.memberId, balance: remainder }, update: { balance: remainder } });
}

export async function removeContributionAllocation(tx: any, contribution: any) {
  if (!contribution.organizationId) return;
  await tx.contributionAllocation.deleteMany({ where: { sourceContributionId: contribution.id } });
  await tx.contributionCredit.upsert({ where: { organizationId_memberId: { organizationId: contribution.organizationId, memberId: contribution.memberId } }, create: { organizationId: contribution.organizationId, memberId: contribution.memberId, balance: 0 }, update: { balance: 0 } });
}
