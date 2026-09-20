import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { toDecimal } from '../utils/decimal';

export type LedgerRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type LedgerPrismaTx = Prisma.TransactionClient;

export type LedgerRecord = {
  id?: string;
  chamaId: string;
  organizationId?: string | null;
  type: TransactionType;
  amount: number | string | Prisma.Decimal;
  fromMemberId?: string | null;
  toMemberId?: string | null;
  reference: string;
  idempotencyKey: string;
  status?: LedgerRecordStatus | TransactionStatus;
  metadata?: Record<string, any> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export class LedgerService {
  static async recordContributionPayment(
    tx: LedgerPrismaTx,
    data: {
      organizationId?: string | null;
      chamaId: string;
      fromMemberId?: string | null;
      amount: number | string;
      reference: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown> | null;
      status?: LedgerRecordStatus | TransactionStatus;
    }
  ) {
    const normalizedStatus = data.status ?? TransactionStatus.COMPLETED;
    return tx.transaction.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {
        chamaId: data.chamaId,
        organizationId: data.organizationId ?? null,
        type: TransactionType.CONTRIBUTION,
        amount: toDecimal(data.amount),
        fromMemberId: data.fromMemberId ?? null,
        reference: data.reference,
        status: normalizedStatus,
        metadata: {
          ...(data.metadata ?? {}),
          ledgerKind: 'CONTRIBUTION_PAYMENT',
        },
        updatedAt: new Date(),
      },
      create: {
        chamaId: data.chamaId,
        organizationId: data.organizationId ?? null,
        type: TransactionType.CONTRIBUTION,
        amount: toDecimal(data.amount),
        fromMemberId: data.fromMemberId ?? null,
        reference: data.reference,
        idempotencyKey: data.idempotencyKey,
        status: normalizedStatus,
        metadata: {
          ...(data.metadata ?? {}),
          ledgerKind: 'CONTRIBUTION_PAYMENT',
        },
      },
    });
  }

  static async recordWelfarePayout(
    tx: LedgerPrismaTx,
    data: {
      organizationId?: string | null;
      chamaId: string;
      fromMemberId?: string | null;
      toMemberId?: string | null;
      amount: number | string;
      reference: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown> | null;
      status?: LedgerRecordStatus | TransactionStatus;
    }
  ) {
    const normalizedStatus = data.status ?? TransactionStatus.COMPLETED;
    return tx.transaction.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {
        chamaId: data.chamaId,
        organizationId: data.organizationId ?? null,
        type: TransactionType.PAYOUT,
        amount: toDecimal(data.amount),
        fromMemberId: data.fromMemberId ?? null,
        toMemberId: data.toMemberId ?? null,
        reference: data.reference,
        status: normalizedStatus,
        metadata: {
          ...(data.metadata ?? {}),
          ledgerKind: 'WELFARE_PAYOUT',
        },
        updatedAt: new Date(),
      },
      create: {
        chamaId: data.chamaId,
        organizationId: data.organizationId ?? null,
        type: TransactionType.PAYOUT,
        amount: toDecimal(data.amount),
        fromMemberId: data.fromMemberId ?? null,
        toMemberId: data.toMemberId ?? null,
        reference: data.reference,
        idempotencyKey: data.idempotencyKey,
        status: normalizedStatus,
        metadata: {
          ...(data.metadata ?? {}),
          ledgerKind: 'WELFARE_PAYOUT',
        },
      },
    });
  }

  static buildReceiptFromLedger(ledger: {
    reference?: string | null;
    amount?: number | string | Prisma.Decimal | null;
    status?: string | null;
    createdAt?: Date | string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const metadata = (ledger.metadata ?? {}) as Record<string, unknown>;
    const receiptNumber = metadata.mpesaReceiptNumber ?? metadata.receiptNumber ?? metadata.transactionRef ?? metadata.reference ?? null;
    const paymentMethod = metadata.paymentMethod ?? metadata.source ?? 'MANUAL';

    return {
      receiptNumber,
      paymentMethod,
      amount: Number(ledger.amount ?? 0),
      status: ledger.status ?? 'COMPLETED',
      reference: ledger.reference ?? metadata.reference ?? receiptNumber ?? 'LEDGER-ENTRY',
      createdAt: ledger.createdAt ?? new Date(),
      metadata,
    };
  }
}
