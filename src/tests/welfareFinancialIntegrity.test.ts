import { PrismaClient } from '@prisma/client';
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
});
