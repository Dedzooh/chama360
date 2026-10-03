import { LedgerService } from '../services/ledgerService';

describe('LedgerService', () => {
  it('writes a contribution entry with a stable idempotency key', async () => {
    const tx = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'ledger-1',
          reference: 'CONTRIB-LEDGER-123',
          idempotencyKey: 'org:org-1:contribution:pay-1',
          status: 'COMPLETED',
          amount: 2500,
        }),
      },
    };

    const result = await LedgerService.recordContributionPayment(tx as any, {
      organizationId: 'org-1',
      chamaId: 'chama-1',
      fromMemberId: 'member-1',
      amount: 2500,
      reference: 'CONTRIB-LEDGER-123',
      idempotencyKey: 'org:org-1:contribution:pay-1',
      metadata: {
        contributionId: 'contrib-1',
        paymentMethod: 'MPESA',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      id: 'ledger-1',
      reference: 'CONTRIB-LEDGER-123',
      idempotencyKey: 'org:org-1:contribution:pay-1',
      status: 'COMPLETED',
    }));
    expect(tx.transaction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: 'org:org-1:contribution:pay-1' },
      create: expect.objectContaining({
        type: 'CONTRIBUTION',
        amount: 2500,
        status: 'COMPLETED',
      }),
    }));
  });

  it('builds a receipt payload from a ledger transaction', () => {
    const receipt = LedgerService.buildReceiptFromLedger({
      reference: 'MPESA-ABC-123',
      amount: 5000,
      status: 'COMPLETED',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      metadata: {
        paymentMethod: 'MPESA',
        mpesaReceiptNumber: 'ABC-123',
        contributionId: 'contrib-9',
      },
    });

    expect(receipt).toMatchObject({
      receiptNumber: 'ABC-123',
      paymentMethod: 'MPESA',
      amount: 5000,
      status: 'COMPLETED',
      reference: 'MPESA-ABC-123',
    });
  });
});
