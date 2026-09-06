import api from '../config/api';

export type MpesaInitiatePayload = {
  contributionId: string;
  phoneNumber: string;
  accountReference?: string;
  transactionDesc?: string;
};

export type MpesaStatusResponse = {
  checkoutRequestId: string;
  status?: string;
  resultCode?: number;
  resultDescription?: string;
  mpesaReceiptNumber?: string;
};

export type MpesaHistoryRecord = {
  id: string;
  reference?: string;
  amount: number;
  status: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  contributionId?: string;
  accountReference?: string;
  reconciliationRequired?: boolean;
  reconciliationReason?: string;
  createdAt?: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  chama?: {
    id: string;
    name: string;
    currency?: string;
  } | null;
};

export const mpesaService = {
  initiate: async (payload: MpesaInitiatePayload) => {
    const response = await api.post('/mpesa/initiate', payload);
    return response.data as {
      message: string;
      data: {
        merchantRequestId: string;
        checkoutRequestId: string;
        responseCode: string;
        responseDescription: string;
        customerMessage?: string;
      };
    };
  },

  queryStatus: async (checkoutRequestId: string) => {
    const response = await api.get(`/mpesa/status/${checkoutRequestId}`);
    return response.data as MpesaStatusResponse;
  },

  manualReconcile: async (payload: {
    contributionId: string;
    mpesaReceiptNumber: string;
    amount: number;
    phoneNumber?: string;
    transactionDate: string;
  }) => {
    const response = await api.post('/mpesa/reconcile/manual', payload);
    return response.data as {
      message: string;
      transaction: {
        id: string;
        reference?: string;
        amount: number;
        status: string;
      };
    };
  },

  bulkReconcile: async (
    payments: Array<{
      contributionId: string;
      mpesaReceiptNumber: string;
      amount: number;
      phoneNumber?: string;
      transactionDate: string;
    }>
  ) => {
    const response = await api.post('/mpesa/reconcile/bulk', { payments });
    return response.data as {
      message: string;
      successful: string[];
      failed: Array<{ mpesaReceiptNumber: string; error: string }>;
      summary: {
        total: number;
        successful: number;
        failed: number;
      };
    };
  },

  retryPayment: async (contributionId: string, phoneNumber?: string) => {
    const response = await api.post(`/mpesa/retry/${contributionId}`, phoneNumber ? { phoneNumber } : {});
    return response.data as {
      message: string;
      data: {
        merchantRequestId: string;
        checkoutRequestId: string;
        responseCode: string;
        responseDescription: string;
        customerMessage?: string;
      };
    };
  },

  history: async (params?: { chamaId?: string; memberId?: string; status?: string; fromDate?: string; toDate?: string; page?: number; limit?: number }) => {
    const response = await api.get('/mpesa/history', { params });
    return response.data as {
      payments: MpesaHistoryRecord[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  },
};
