import api from '../config/api';

const visitorKey = 'chama360-funnel-visitor';

export const getVisitorId = () => {
  const existing = window.localStorage.getItem(visitorKey);
  if (existing) return existing;
  const next = `visitor_${crypto.randomUUID()}`;
  window.localStorage.setItem(visitorKey, next);
  return next;
};

export const trackCommercialEvent = (eventType: string, context?: { organizationId?: string; plan?: string; billingCycle?: string }) => {
  void api.post('/subscriptions/funnel-events', { eventType, visitorId: getVisitorId(), ...context }).catch(() => undefined);
};
