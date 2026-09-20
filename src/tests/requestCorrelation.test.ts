import { requestContext, currentRequestId } from '../middleware/requestContext';
import { redactAuditValue } from '../utils/auditRedaction';

describe('request correlation and audit redaction', () => {
  it('creates req_ correlation IDs and returns the same ID in the response header', (done) => {
    const headers = new Map<string, string>();
    const req = { get: () => undefined } as any;
    const res = { setHeader: (key: string, value: string) => headers.set(key, value) } as any;

    requestContext(req, res, () => {
      const requestId = currentRequestId();
      expect(requestId).toMatch(/^req_[0-9a-f-]{36}$/);
      expect(headers.get('X-Request-Id')).toBe(requestId);
      done();
    });
  });

  it('preserves a valid inbound req_ correlation ID', (done) => {
    const inbound = 'req_external-payment-123';
    const headers = new Map<string, string>();
    const req = { get: (name: string) => name === 'X-Request-Id' ? inbound : undefined } as any;
    const res = { setHeader: (key: string, value: string) => headers.set(key, value) } as any;

    requestContext(req, res, () => {
      expect(currentRequestId()).toBe(inbound);
      expect(headers.get('X-Request-Id')).toBe(inbound);
      done();
    });
  });

  it('redacts credentials and identity values without mutating the source', () => {
    const source = { passwordHash: 'hash', mfaSecret: 'secret', nationalId: '12345678', metadata: { token: 'jwt' }, amount: 5000 };
    const result = redactAuditValue(source) as Record<string, unknown>;

    expect(result).toEqual({ passwordHash: '[REDACTED]', mfaSecret: '[REDACTED]', nationalId: '[REDACTED]', metadata: { token: '[REDACTED]' }, amount: 5000 });
    expect(source.passwordHash).toBe('hash');
    expect(source.metadata.token).toBe('jwt');
  });
});
