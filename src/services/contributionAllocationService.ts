import { ContributionStatus, Prisma } from '@prisma/client';
import { toDecimal } from '../utils/decimal';

const periodPattern = /^\d{4}-\d{2}$/;
const addMonths = (period: string, offset: number) => { const [year = 1970, month = 1] = period.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1 + offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; };
const currentPeriod = () => { const now = new Date(); return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`; };

type ContributionAllocationInput = {
  id: string;
  organizationId: string | null;
  status: ContributionStatus;
  amount: number | string | Prisma.Decimal;
  memberId: string;
  period?: string | null;
};

export async function allocatePaidContribution(tx: Prisma.TransactionClient, contribution: ContributionAllocationInput) {
  if (!contribution.organizationId || contribution.status !== ContributionStatus.PAID) return;
  const organization = await tx.organization.findUnique({ where: { id: contribution.organizationId }, include: { settings: true } });
  const rules = (organization?.settings?.contributionRules ?? {}) as Record<string, unknown>;
  const monthlyAmount = toDecimal((rules.amount ?? 0) as string | number | Prisma.Decimal);
  if (!rules?.allowAdvancePayments || monthlyAmount.lte(0)) return;
  await tx.contributionAllocation.deleteMany({ where: { sourceContributionId: contribution.id } });
  const amount = toDecimal(contribution.amount);
  const fullMonths = amount.div(monthlyAmount).floor();
  const startPeriod = periodPattern.test(contribution.period ?? '') ? contribution.period ?? currentPeriod() : currentPeriod();
  for (let index = 0; index < Number(fullMonths); index += 1) {
    await tx.contributionAllocation.create({
      data: {
        organizationId: contribution.organizationId,
        sourceContributionId: contribution.id,
        memberId: contribution.memberId,
        period: addMonths(startPeriod, index),
        amount: monthlyAmount,
        monthlyAmount,
      },
    });
  }
  const remainder = amount.minus(monthlyAmount.mul(fullMonths));
  await tx.contributionCredit.upsert({
    where: { organizationId_memberId: { organizationId: contribution.organizationId, memberId: contribution.memberId } },
    create: { organizationId: contribution.organizationId, memberId: contribution.memberId, balance: remainder },
    update: { balance: remainder },
  });
}

export async function removeContributionAllocation(tx: Prisma.TransactionClient, contribution: Pick<ContributionAllocationInput, 'organizationId' | 'memberId' | 'id'>) {
  if (!contribution.organizationId) return;
  await tx.contributionAllocation.deleteMany({ where: { sourceContributionId: contribution.id } });
  await tx.contributionCredit.upsert({ where: { organizationId_memberId: { organizationId: contribution.organizationId, memberId: contribution.memberId } }, create: { organizationId: contribution.organizationId, memberId: contribution.memberId, balance: 0 }, update: { balance: 0 } });
}
