import api from '../config/api';

export const loanService = {
  getLoans: async (chamaId?: string) => {
    const response = await api.get('/loan', { params: chamaId ? { chamaId } : undefined });
    return response.data.loans || response.data;
  },

  applyForLoan: async (data: {
    chamaId: string;
    amount: number;
    durationMonths?: number;
    interestRate?: number;
    purpose?: string;
  }) => {
    const response = await api.post('/loan/apply', data);
    return response.data.loan || response.data;
  },
};
