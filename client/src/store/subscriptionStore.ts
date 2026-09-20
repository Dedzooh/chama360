import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BillingCycle, PremiumFeature, SubscriptionPlan } from '../config/subscriptions';
import { FEATURE_PLAN, PLAN_RANK } from '../config/subscriptions';
import { subscriptionService } from '../services/subscriptionService';

interface SubscriptionState {
  plan: SubscriptionPlan;
  organizationId: string | null;
  billingCycle: BillingCycle;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  promptFeature: PremiumFeature | null;
  pendingPlan: SubscriptionPlan | null;
  pendingRequestId: string | null;
  pendingAmount: number | null;
  paymentStatus: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  inGracePeriod: boolean;
  loading: boolean;
  message: string;
  canUse: (feature: PremiumFeature) => boolean;
  showUpgrade: (feature: PremiumFeature) => void;
  closeUpgrade: () => void;
  refresh: () => Promise<void>;
  setOrganization: (organizationId: string | null) => Promise<void>;
  setBillingCycle: (cycle: BillingCycle) => void;
  requestPlan: (plan: SubscriptionPlan) => Promise<void>;
  checkout: (phone: string) => Promise<void>;
  checkPayment: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(persist((set, get) => ({
  plan: 'FREE',
  organizationId: null,
  billingCycle: 'MONTHLY',
  status: 'ACTIVE',
  promptFeature: null,
  pendingPlan: null,
  pendingRequestId: null,
  pendingAmount: null,
  paymentStatus: null,
  currentPeriodEnd: null,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  daysRemaining: null,
  inGracePeriod: false,
  loading: false,
  message: '',
  canUse: (feature) => ['ACTIVE', 'PAST_DUE'].includes(get().status) && PLAN_RANK[get().plan] >= PLAN_RANK[FEATURE_PLAN[feature]],
  showUpgrade: (feature) => set({ promptFeature: feature }),
  closeUpgrade: () => set({ promptFeature: null }),
  setBillingCycle: (billingCycle) => set({ billingCycle }),
  setOrganization: async (organizationId) => {
    if (get().organizationId === organizationId) return;
    set({ organizationId, pendingPlan: null, pendingRequestId: null, pendingAmount: null, paymentStatus: null });
    await get().refresh();
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const data = await subscriptionService.getCurrent(get().organizationId);
      const latestPending = data.requests.find((request) => ['PENDING', 'PROCESSING'].includes(request.status));
      set({ plan: data.subscription.plan, status: data.subscription.status === 'EXPIRED' ? 'CANCELLED' : data.subscription.status, currentPeriodEnd: data.subscription.currentPeriodEnd ?? null, trialEndsAt: data.subscription.trialEndsAt ?? null, cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd, daysRemaining: data.renewal.daysRemaining, inGracePeriod: data.renewal.inGracePeriod, pendingPlan: latestPending?.requestedPlan ?? null, pendingRequestId: latestPending?.id ?? null, pendingAmount: latestPending ? Number(latestPending.amount) : null, paymentStatus: latestPending?.status ?? null, message: '' });
    } catch {
      set({ message: 'Unable to refresh subscription status.' });
    } finally {
      set({ loading: false });
    }
  },
  requestPlan: async (plan) => {
    if (plan === 'FREE') return;
    set({ loading: true, message: '' });
    try {
      const organizationId = get().organizationId;
      if (!organizationId) throw new Error('Select a chama before choosing a plan.');
      const data = await subscriptionService.requestUpgrade(plan, organizationId, get().billingCycle);
      set({ pendingPlan: plan, pendingRequestId: data.request.id, pendingAmount: Number(data.request.amount), paymentStatus: data.request.status, promptFeature: null, message: data.message });
    } catch (error: any) {
      set({ message: error?.response?.data?.error?.message || 'Unable to create the upgrade request. Please try again.' });
    } finally {
      set({ loading: false });
    }
  },
  checkout: async (phone) => {
    const requestId = get().pendingRequestId;
    if (!requestId) return;
    set({ loading: true, message: '' });
    try {
      const data = await subscriptionService.checkout(requestId, phone);
      set({ paymentStatus: data.request.status, message: data.customerMessage });
    } catch (error: any) {
      set({ message: error?.response?.data?.error?.message || 'Unable to start M-Pesa checkout. Please try again.' });
    } finally { set({ loading: false }); }
  },
  checkPayment: async () => {
    const requestId = get().pendingRequestId;
    if (!requestId) return;
    try {
      const { request } = await subscriptionService.getRequest(requestId);
      if (request.status === 'COMPLETED') {
        await get().refresh();
        set({ pendingPlan: null, pendingRequestId: null, pendingAmount: null, paymentStatus: 'COMPLETED', message: `Payment confirmed. Your ${request.requestedPlan} plan is now active.` });
      } else if (request.status === 'FAILED') {
        set({ paymentStatus: 'FAILED', message: request.failureReason || 'The M-Pesa payment was not completed.' });
      } else set({ paymentStatus: request.status });
    } catch { /* Keep the current state and poll again. */ }
  },
  cancelSubscription: async () => {
    set({ loading: true, message: '' });
    try {
      const organizationId = get().organizationId;
      if (!organizationId) throw new Error('Select a chama before managing its subscription.');
      const data = await subscriptionService.cancel(organizationId);
      set({ cancelAtPeriodEnd: true, message: data.message });
    } catch (error: any) { set({ message: error?.response?.data?.error?.message || 'Unable to schedule cancellation.' }); }
    finally { set({ loading: false }); }
  },
  resumeSubscription: async () => {
    set({ loading: true, message: '' });
    try {
      const organizationId = get().organizationId;
      if (!organizationId) throw new Error('Select a chama before managing its subscription.');
      const data = await subscriptionService.resume(organizationId);
      set({ cancelAtPeriodEnd: false, message: data.message });
    } catch (error: any) { set({ message: error?.response?.data?.error?.message || 'Unable to resume the subscription.' }); }
    finally { set({ loading: false }); }
  },
}), {
  name: 'chama360-subscription',
  partialize: (state) => ({ plan: state.plan, status: state.status, organizationId: state.organizationId, billingCycle: state.billingCycle, pendingPlan: state.pendingPlan, pendingRequestId: state.pendingRequestId, paymentStatus: state.paymentStatus, currentPeriodEnd: state.currentPeriodEnd, trialEndsAt: state.trialEndsAt, cancelAtPeriodEnd: state.cancelAtPeriodEnd, daysRemaining: state.daysRemaining, inGracePeriod: state.inGracePeriod }),
}));
