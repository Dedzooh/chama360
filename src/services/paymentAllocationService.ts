import { ContributionStatus, PaymentAllocationKind, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';

// Payment → Allocation → Obligation architecture.
//
// A ContributionPayment records ONE real-world money movement. The payer
// (who physically sent the money) is stored separately from the beneficiary
// (whose Chama obligation is being settled) via ContributionPaymentAllocation
// rows. One payment can settle many members and many periods; anything left
// over is explicitly allocated as CREDIT or left UNALLOCATED for the
// Treasurer — it is never silently assigned.

const EPS = 0.001;

export type PaymentAllocationInput = {
  memberId: string;
  amount: number;
  contributionId?: string;
  period?: string;
  contributionType?: string;
};

export type RecordPaymentInput = {
  organizationId: string;
  chamaId?: string | null;
  payerUserId: string;
  amount: number;
  paymentMethod?: 'MPESA' | 'BANK' | 'CASH';
  paymentMethodId?: string | null;
  transactionReference?: string | null;
  paidAt?: Date;
  recordedById?: string | null;
  allocations: PaymentAllocationInput[];
  status?: 'COMPLETED' | 'PENDING';
  note?: string;
};

export type RecordPaymentResult = {
  payment: { id: string; amount: number; allocatedAmount: number; remaining: number; status: string };
  allocations: Array<{ id: string; memberId: string; amount: number; contributionId?: string | null; kind: string }>;
  unallocated: number;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Validate allocations against actual outstanding obligations. Never guesses:
 * if an allocation exceeds what the member still owes for that contribution,
 * the request is rejected so the Treasurer can decide what the extra means.
 */
async function validateAllocations(
  tx: Prisma.TransactionClient,
  input: RecordPaymentInput,
): Promise<void> {
  if (!input.allocations.length) return;
  const allocationTotal = sum(input.allocations.map((allocation) => allocation.amount));
  if (allocationTotal > Number(input.amount) + EPS) {
    throw new BadRequestError(`Allocations total ${allocationTotal.toFixed(2)} KES but the payment is only ${Number(input.amount).toFixed(2)} KES.`);
  }
  const contributionIds = input.allocations.map((allocation) => allocation.contributionId).filter((id): id is string => Boolean(id));
  if (contributionIds.length) {
    const contributions = await tx.contribution.findMany({
      where: { id: { in: contributionIds }, organizationId: input.organizationId },
      include: { paymentAllocations: true },
    });
    const byId = new Map(contributions.map((contribution) => [contribution.id, contribution]));
    for (const allocation of input.allocations) {
      if (!allocation.contributionId) continue;
      const contribution = byId.get(allocation.contributionId);
      if (!contribution) throw new NotFoundError(`Contribution ${allocation.contributionId} was not found in this Chama.`);
      if (contribution.memberId !== allocation.memberId) {
        throw new BadRequestError('Each allocation must target the member who owns the contribution being settled.');
      }
      if (['PAID', 'REVERSED'].includes(contribution.status)) {
        throw new BadRequestError(`That contribution for ${allocation.memberId} is already ${contribution.status === 'PAID' ? 'fully paid' : 'reversed'}.`);
      }
      const alreadyAllocated = sum(contribution.paymentAllocations.filter((existing) => existing.kind === PaymentAllocationKind.CONTRIBUTION).map((existing) => Number(existing.amount)));
      const stillDue = Number(contribution.amount) + Number(contribution.penalties ?? 0) - alreadyAllocated;
      if (Number(allocation.amount) > stillDue + EPS) {
        throw new BadRequestError(`Allocating ${Number(allocation.amount).toFixed(2)} KES exceeds the ${stillDue.toFixed(2)} KES still due on that contribution. Split the payment or let the Treasurer allocate the remainder.`);
      }
    }
  }
}

/**
 * Record a payment with explicit allocations. Everything not allocated to a
 * contribution becomes an explicit CREDIT allocation (contribution credit) —
 * the caller decides via `autoCredit` whether leftovers should become credit
 * or stay UNALLOCATED for Treasurer review. Defaults to UNALLOCATED because
 * the system must never silently assume what extra money means.
 */
export async function recordPaymentWithAllocations(
  tx: Prisma.TransactionClient,
  input: RecordPaymentInput,
  options: { autoCredit?: boolean } = {},
): Promise<RecordPaymentResult> {
  if (!(Number(input.amount) > 0)) throw new BadRequestError('Payment amount must be greater than zero.');
  await validateAllocations(tx, input);

  const autoCredit = options.autoCredit ?? false;
  const paidAt = input.paidAt ?? new Date();
  const allocationTotal = sum(input.allocations.map((allocation) => allocation.amount));
  const remaining = Math.max(0, Number(input.amount) - allocationTotal);
  const status = input.status ?? 'COMPLETED';

  const payment = await tx.contributionPayment.create({
    data: {
      organizationId: input.organizationId,
      chamaId: input.chamaId ?? null,
      payerUserId: input.payerUserId,
      amount: input.amount,
      allocatedAmount: allocationTotal,
      paymentMethod: input.paymentMethod,
      paymentMethodId: input.paymentMethodId ?? null,
      transactionReference: input.transactionReference ?? null,
      status,
      paidAt,
      recordedById: input.recordedById ?? null,
      confirmation: input.note ? { note: input.note } : undefined,
    },
  });

  const createdAllocations: RecordPaymentResult['allocations'] = [];
  for (const allocation of input.allocations) {
    const created = await tx.contributionPaymentAllocation.create({
      data: {
        paymentId: payment.id,
        memberId: allocation.memberId,
        contributionId: allocation.contributionId ?? null,
        kind: PaymentAllocationKind.CONTRIBUTION,
        period: allocation.period ?? null,
        contributionType: allocation.contributionType ?? null,
        amount: allocation.amount,
        confirmedById: input.recordedById ?? null,
      },
    });
    createdAllocations.push({ id: created.id, memberId: allocation.memberId, amount: Number(allocation.amount), contributionId: allocation.contributionId ?? null, kind: 'CONTRIBUTION' });

    // Update the underlying obligation if the payment settles a concrete one.
    if (allocation.contributionId && status === 'COMPLETED') {
      const rawContribution: any = await tx.contribution.findUnique({ where: { id: allocation.contributionId }, include: { paymentAllocations: true } });
      if (rawContribution) {
        const settled = sum((rawContribution.paymentAllocations as Array<{ kind: string; amount: unknown }>).filter((existing) => existing.kind === 'CONTRIBUTION').map((existing) => Number(existing.amount)));
        const required = Number(rawContribution.amount) + Number(rawContribution.penalties ?? 0);
        const fullyPaid = settled + EPS >= required;
        const partial = settled > EPS;
        await tx.contribution.update({
          where: { id: rawContribution.id },
          data: {
            status: fullyPaid ? ContributionStatus.PAID : partial ? ContributionStatus.PARTIAL : rawContribution.status,
            paidAt: fullyPaid ? paidAt : rawContribution.paidAt,
            paidDate: fullyPaid ? paidAt : rawContribution.paidDate,
          },
        });
      }
    }
  }

  // Leftover money becomes an explicit allocation row — never a silent guess.
  if (remaining > EPS && status === 'COMPLETED') {
    const kind = autoCredit ? PaymentAllocationKind.CREDIT : PaymentAllocationKind.UNALLOCATED;
    await tx.contributionPaymentAllocation.create({
      data: {
        paymentId: payment.id,
        memberId: input.allocations[0]?.memberId ?? input.payerUserId,
        kind,
        amount: remaining,
        confirmedById: input.recordedById ?? null,
      },
    });
    if (autoCredit && input.allocations[0]?.memberId) {
      await tx.contributionCredit.upsert({
        where: { organizationId_memberId: { organizationId: input.organizationId, memberId: input.allocations[0].memberId } },
        create: { organizationId: input.organizationId, memberId: input.allocations[0].memberId, balance: remaining },
        update: { balance: { increment: remaining } },
      });
    }
    createdAllocations.push({ id: 'leftover', memberId: input.allocations[0]?.memberId ?? input.payerUserId, amount: remaining, kind, contributionId: null });
  }

  return {
    payment: { id: payment.id, amount: Number(input.amount), allocatedAmount: allocationTotal, remaining, status },
    allocations: createdAllocations,
    unallocated: autoCredit ? 0 : remaining,
  };
}

/** Reverse a payment: allocations cascade, obligations reopen, wallet debited. */
export async function reversePayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
  organizationId: string,
  userId: string,
  reason: string,
) {
  const payment = await tx.contributionPayment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
  if (!payment || payment.organizationId !== organizationId) throw new NotFoundError('Payment not found');
  if (payment.status === 'REVERSED') throw new BadRequestError('This payment has already been reversed');

  const claimed = await tx.contributionPayment.updateMany({
    where: { id: paymentId, status: { not: 'REVERSED' } },
    data: { status: 'REVERSED', reversedById: userId, reverseReason: reason, reversedAt: new Date() },
  });
  if (claimed.count !== 1) throw new BadRequestError('The payment was already reversed by another request.');

  for (const allocation of payment.allocations) {
    if (allocation.kind === PaymentAllocationKind.CREDIT) {
      await tx.contributionCredit.upsert({
        where: { organizationId_memberId: { organizationId, memberId: allocation.memberId } },
        create: { organizationId, memberId: allocation.memberId, balance: 0 },
        update: { balance: { decrement: Number(allocation.amount) } },
      });
    }
    if (allocation.kind !== PaymentAllocationKind.CONTRIBUTION || !allocation.contributionId) continue;
    const contribution: any = await tx.contribution.findUnique({ where: { id: allocation.contributionId } });
    if (!contribution) continue;
    const stillSettled = await tx.contributionPaymentAllocation.aggregate({
      where: { contributionId: allocation.contributionId, kind: PaymentAllocationKind.CONTRIBUTION, payment: { status: 'COMPLETED' } },
      _sum: { amount: true },
    });
    const settled = Number(stillSettled._sum.amount ?? 0);
    const required = Number(contribution.amount) + Number(contribution.penalties ?? 0);
    if (settled < EPS) {
      await tx.contribution.update({ where: { id: contribution.id }, data: { status: ContributionStatus.PENDING, paidAt: null, paidDate: null } });
    } else {
      await tx.contribution.update({ where: { id: contribution.id }, data: { status: settled + EPS >= required ? ContributionStatus.PAID : ContributionStatus.PARTIAL, paidAt: settled + EPS >= required ? contribution.paidAt : null } });
    }
  }

  await tx.organizationWallet.updateMany({
    where: { organizationId, balance: { gte: payment.amount } },
    data: { balance: { decrement: payment.amount } },
  });

  await tx.organizationAuditLog.create({
    data: {
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'ContributionPayment',
      entityId: paymentId,
      oldValues: payment as any,
      metadata: { operation: 'PAYMENT_REVERSED', reason },
    },
  });
  return payment;
}
