import { createHash, createHmac } from 'crypto';
import { config } from '../config/environment';
import { ServiceUnavailableError } from '../middleware/errorHandler';

export class IdentityProtectionService {
  static normalize(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  static fingerprint(value: string): string {
    const secret = config.security.identityHashSecret || (!config.server.isProduction
      ? createHash('sha256').update(`development-identity:${config.security.sessionSecret}`).digest('hex')
      : undefined);
    if (!secret) throw new ServiceUnavailableError('Identity protection is not configured');
    return createHmac('sha256', secret).update(this.normalize(value)).digest('hex');
  }

  static protect(value: string): { nationalIdHash: string; nationalIdLast4: string; nationalId: null } {
    const normalized = this.normalize(value);
    return {
      nationalIdHash: this.fingerprint(normalized),
      nationalIdLast4: normalized.slice(-4),
      nationalId: null,
    };
  }

  static mask(last4?: string | null): string | undefined {
    return last4 ? `••••${last4}` : undefined;
  }
}
