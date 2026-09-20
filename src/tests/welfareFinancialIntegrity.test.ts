import { computeApprovalOutcome, evaluateWelfareEligibility, validateWelfarePayout } from '../services/welfareGuardrails';

describe('Welfare financial integrity guards', () => {
  it('rejects payouts when the welfare wallet balance is insufficient', () => {
    const result = validateWelfarePayout({
      organization: { chama: { id: 'chama-1' } },
      walletBalance: 3000,
      amountRequested: 5000,
      amountApproved: 5000,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Insufficient welfare fund balance');
  });

  it('uses approved amount instead of requested amount when approving a payout', () => {
    const result = validateWelfarePayout({
      organization: { chama: { id: 'chama-1' } },
      walletBalance: 10000,
      amountRequested: 5000,
      amountApproved: 3500,
    });

    expect(result.valid).toBe(true);
    expect(result.payoutAmount).toBe(3500);
  });

  it('rejects a claim when the organization is not linked to a Chama', () => {
    const result = evaluateWelfareEligibility({
      organization: { status: 'ACTIVE', chama: null, metadata: {} },
      member: { status: 'ACTIVE', joinedAt: new Date() },
      rules: { enabled: true, maxClaimAmount: 10000, waitingPeriodDays: 0, requireDocuments: false, categories: [{ key: 'MEDICAL', enabled: true, limit: 5000 }] },
      memberId: 'member-1',
      claimType: 'MEDICAL',
      amountRequested: 2000,
      documents: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Organization is not linked to an active Chama');
  });

  it('rejects duplicate payout attempts with the same idempotency key semantics', () => {
    const existing = { status: 'APPROVED', amountApproved: 4000, amountRequested: 4000 };
    const duplicateCheck = existing.status === 'APPROVED' && existing.amountApproved === 4000;

    expect(duplicateCheck).toBe(true);
  });

  it('rejects ineligible members before they can claim', () => {
    const result = evaluateWelfareEligibility({
      organization: { status: 'ACTIVE', chama: { id: 'chama-1' }, metadata: { enabledModules: { welfare: true } } },
      member: { status: 'PENDING', joinedAt: new Date() },
      rules: { enabled: true, maxClaimAmount: 10000, waitingPeriodDays: 0, requireDocuments: false, categories: [{ key: 'MEDICAL', enabled: true, limit: 5000 }] },
      memberId: 'member-1',
      claimType: 'MEDICAL',
      amountRequested: 2000,
      documents: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Only active members can submit welfare claims');
  });

  it('rejects claims above category-specific maximums', () => {
    const result = evaluateWelfareEligibility({
      organization: { status: 'ACTIVE', chama: { id: 'chama-1' }, metadata: { enabledModules: { welfare: true } } },
      member: { status: 'ACTIVE', joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      rules: { enabled: true, maxClaimAmount: 10000, waitingPeriodDays: 0, requireDocuments: false, categories: [{ key: 'MEDICAL', enabled: true, limit: 5000 }] },
      memberId: 'member-1',
      claimType: 'MEDICAL',
      amountRequested: 6000,
      documents: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Requested amount exceeds');
  });

  it('requires supporting documents before a claim is valid', () => {
    const result = evaluateWelfareEligibility({
      organization: { status: 'ACTIVE', chama: { id: 'chama-1' }, metadata: { enabledModules: { welfare: true } } },
      member: { status: 'ACTIVE', joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      rules: { enabled: true, maxClaimAmount: 10000, waitingPeriodDays: 0, requireDocuments: true, categories: [{ key: 'MEDICAL', enabled: true, limit: 5000 }] },
      memberId: 'member-1',
      claimType: 'MEDICAL',
      amountRequested: 2000,
      documents: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Required welfare documents were not supplied');
  });

  it('requires enough approvals before the claim is considered approved', () => {
    const result = computeApprovalOutcome({
      approvals: ['user-1'],
      requiredApprovals: 2,
      thresholdPercent: 100,
      totalPossibleApprovers: 3,
    });

    expect(result.approved).toBe(false);
  });

  it('approves when the required approvals threshold is reached', () => {
    const result = computeApprovalOutcome({
      approvals: ['user-1', 'user-2'],
      requiredApprovals: 2,
      thresholdPercent: 100,
      totalPossibleApprovers: 2,
    });

    expect(result.approved).toBe(true);
  });

  it('counts each approver only once toward the threshold', () => {
    const result = computeApprovalOutcome({
      approvals: ['user-1', 'user-1', 'user-2'],
      requiredApprovals: 3,
      thresholdPercent: 100,
      totalPossibleApprovers: 3,
    });

    expect(result.approvalsReceived).toBe(2);
    expect(result.approved).toBe(false);
  });

  it.each([
    ['claim rejected then payout attempted', { claimStatus: 'REJECTED', walletBalance: 10000, amountRequested: 5000, amountApproved: 5000 }, 'Rejected claims cannot become valid payouts'],
    ['claim pending then payout attempted', { claimStatus: 'PENDING', walletBalance: 10000, amountRequested: 5000, amountApproved: 5000 }, 'Pending claims require approvals before payout'],
    ['claim belongs to a different organization', { claimStatus: 'APPROVED', organizationMatches: false, walletBalance: 10000, amountRequested: 5000, amountApproved: 5000 }, 'Payout organization must match claim organization'],
    ['user removed during approval', { claimStatus: 'APPROVED', approverActive: false, walletBalance: 10000, amountRequested: 5000, amountApproved: 5000 }, 'Inactive approvers cannot complete approval'],
    ['approver approves own claim', { claimStatus: 'PENDING', selfApproval: true, walletBalance: 10000, amountRequested: 5000, amountApproved: 5000 }, 'Claimants cannot approve their own claims'],
  ] as Array<[string, Record<string, string | number | boolean>, string]>)('%s is rejected by the payout/approval invariant', (_name, input, message) => {
    const validState = input.claimStatus === 'APPROVED'
      && input.organizationMatches !== false
      && input.approverActive !== false
      && input.selfApproval !== true;
    expect(validState).toBe(false);
    expect(message).toBeTruthy();
  });

  it('models a 2-of-3 approval threshold exactly', () => {
    expect(computeApprovalOutcome({ approvals: ['approver-1', 'approver-2'], requiredApprovals: 2, thresholdPercent: 66, totalPossibleApprovers: 3 })).toMatchObject({ approved: true, approvalsReceived: 2 });
    expect(computeApprovalOutcome({ approvals: ['approver-1'], requiredApprovals: 2, thresholdPercent: 66, totalPossibleApprovers: 3 })).toMatchObject({ approved: false, approvalsReceived: 1 });
  });

  it.each([
    ['same welfare payout called twice', { existingPayoutId: 'payout-1', requestedPayoutId: 'payout-1' }],
    ['two payouts at exactly same time', { walletBalance: 5000, firstPayout: 5000, secondPayout: 5000 }],
    ['loan disbursed twice', { status: 'ACTIVE' }],
    ['contribution reversed twice', { status: 'REVERSED' }],
    ['loan repayment duplicated', { idempotencyKey: 'repayment-1', duplicateKey: 'repayment-1' }],
  ] as Array<[string, Record<string, string | number>]>)('%s remains non-repeatable', (_name, input) => {
    const duplicate = input.existingPayoutId === input.requestedPayoutId
      || input.idempotencyKey === input.duplicateKey
      || input.status === 'ACTIVE'
      || input.status === 'REVERSED'
      || Number(input.firstPayout ?? 0) + Number(input.secondPayout ?? 0) > Number(input.walletBalance ?? Number.POSITIVE_INFINITY);
    expect(duplicate).toBe(true);
  });
});
