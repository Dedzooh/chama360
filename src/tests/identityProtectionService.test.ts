import { IdentityProtectionService } from '../services/identityProtectionService';

describe('IdentityProtectionService', () => {
  it('normalizes identifiers before producing a deterministic keyed fingerprint', () => {
    const first = IdentityProtectionService.protect(' ab 1234 ');
    const second = IdentityProtectionService.protect('AB1234');

    expect(first.nationalIdHash).toBe(second.nationalIdHash);
    expect(first.nationalIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.nationalIdLast4).toBe('1234');
    expect(first.nationalId).toBeNull();
    expect(JSON.stringify(first)).not.toContain('AB1234');
  });

  it('returns only a masked display value', () => {
    expect(IdentityProtectionService.mask('1234')).toBe('••••1234');
    expect(IdentityProtectionService.mask(null)).toBeUndefined();
  });
});
