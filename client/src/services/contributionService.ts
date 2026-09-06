import api from '../config/api';

export const contributionService = {
  getContributions: async (chamaId: string) => {
    const response = await api.get(`/contribution`, { params: { chamaId } });
    return response.data.contributions || response.data;
  },

  makeContribution: async (
    chamaId: string,
    amount: number,
    paymentMethod: string,
    options?: {
      phoneNumber?: string;
      mpesaOption?: 'STK_PUSH' | 'PAYBILL' | 'TILL';
      paybillNumber?: string;
      accountNumber?: string;
      tillNumber?: string;
      transactionRef?: string;
      accountReference?: string;
      transactionDesc?: string;
    }
  ) => {
    const response = await api.post(`/contribution/chama/${chamaId}/payment`, {
      amount,
      paymentMethod,
      mpesaOption: options?.mpesaOption,
      phoneNumber: options?.phoneNumber,
      paybillNumber: options?.paybillNumber,
      accountNumber: options?.accountNumber,
      tillNumber: options?.tillNumber,
      transactionRef: options?.transactionRef,
      accountReference: options?.accountReference,
      transactionDesc: options?.transactionDesc,
    });
    return response.data;
  },

  getPendingPaymentRequests: async (chamaId: string) => {
    const response = await api.get(`/contribution/chama/${chamaId}/payment-requests`);
    return response.data.requests || [];
  },

  approvePaymentRequest: async (paymentRequestId: string) => {
    const response = await api.post(`/contribution/payment-requests/${paymentRequestId}/approve`);
    return response.data.contribution || response.data;
  },

  createContributionCycle: async (chamaId: string, dueDate: string, amount?: number) => {
    const response = await api.post('/contribution/cycle', {
      chamaId,
      dueDate,
      amount,
    });
    return response.data;
  },

  getContributionSummary: async (chamaId: string) => {
    const response = await api.get('/contribution/summary', { params: { chamaId } });
    return response.data.summary || response.data;
  },

  getContributionHistory: async (chamaId: string) => {
    const response = await api.get(`/contribution`, { params: { chamaId } });
    return response.data.contributions || response.data;
  },

  initiateMpesaPayment: async (chamaId: string, amount: number, phone: string) => {
    const response = await api.post(`/mpesa/initiate`, {
      amount,
      phone,
      chamaId,
    });
    return response.data;
  },
};
