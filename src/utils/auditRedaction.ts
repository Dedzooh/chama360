const sensitiveKey = /(authorization|cookie|password|passkey|secret|token|apiKey|verificationCode|mfa|nationalId|credential)/i;

export const redactAuditValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value as object)) return '[CIRCULAR]';
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item, seen));

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    sensitiveKey.test(key) ? '[REDACTED]' : redactAuditValue(child, seen),
  ]));
};