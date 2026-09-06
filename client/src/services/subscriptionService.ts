import api from '../config/api';
import type { BillingCycle, SubscriptionPlan } from '../config/subscriptions';

export interface SubscriptionRecord {
  plan: SubscriptionPlan;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  currentPeriodStart: string;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UpgradeRequest {
  id: string;
  requestedPlan: SubscriptionPlan;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  failureReason?: string | null;
  receiptNumber?: string | null;
}

export interface BillingOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string | null;
  roleLabel: string | null;
  subscription: { plan: SubscriptionPlan; status: string; currentPeriodEnd: string | null };
}

export const subscriptionService = {
  getBillingOrganizations: async () => {
    const response = await api.get('/subscriptions/billing-organizations');
    return response.data as { organizations: BillingOrganization[] };
  },
  getCurrent: async (organizationId?: string | null) => {
    const response = await api.get('/subscriptions/me', { params: { organizationId: organizationId || undefined } });
    return response.data as { subscription: SubscriptionRecord; features: string[]; requests: UpgradeRequest[]; renewal: { daysRemaining: number | null; renewable: boolean; inGracePeriod: boolean } };
  },
  checkout: async (requestId: string, phone: string) => {
    const response = await api.post('/subscriptions/checkout', { requestId, phone });
    return response.data as { request: UpgradeRequest; customerMessage: string };
  },
  getRequest: async (requestId: string) => {
    const response = await api.get(`/subscriptions/requests/${requestId}`);
    return response.data as { request: UpgradeRequest };
  },
  requestUpgrade: async (plan: Exclude<SubscriptionPlan, 'FREE'>, organizationId: string, billingCycle: BillingCycle, phone?: string) => {
    const response = await api.post('/subscriptions/request-upgrade', { plan, organizationId, billingCycle, phone });
    return response.data;
  },
  cancel: async (organizationId: string) => {
    const response = await api.post('/subscriptions/cancel', { organizationId });
    return response.data;
  },
  resume: async (organizationId: string) => {
    const response = await api.post('/subscriptions/resume', { organizationId });
    return response.data;
  },
};
