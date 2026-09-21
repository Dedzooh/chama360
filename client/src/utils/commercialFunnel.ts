import api from '../config/api';

const visitorKey = 'chama360-funnel-visitor';

const createVisitorUuid = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

export const getVisitorId = () => {
  const existing = window.localStorage.getItem(visitorKey);
  if (existing) return existing;
  const next = `visitor_${createVisitorUuid()}`;
  window.localStorage.setItem(visitorKey, next);
  return next;
};

export const trackCommercialEvent = (eventType: string, context?: { organizationId?: string; plan?: string; billingCycle?: string }) => {
  void api.post('/subscriptions/funnel-events', { eventType, visitorId: getVisitorId(), ...context }).catch(() => undefined);
};
