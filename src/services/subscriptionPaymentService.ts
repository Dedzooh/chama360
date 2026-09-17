import axios from 'axios';
import { config } from '../config/environment';

interface StkResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface SubscriptionCallback {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: string | number }> };
    };
  };
}

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  throw new Error('Enter a valid Kenyan mobile number, for example 0712 345 678.');
};

class SubscriptionPaymentService {
  private token?: { value: string; expiresAt: number };

  isConfigured() {
    return Boolean(config.mpesa.consumerKey && config.mpesa.consumerSecret && config.mpesa.shortcode && config.mpesa.passkey && config.mpesa.subscriptionCallbackUrl);
  }

  normalizePhone(value: string) {
    return normalizePhone(value);
  }

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const base = config.mpesa.environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const auth = Buffer.from(`${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`).toString('base64');
    const response = await axios.get<{ access_token: string; expires_in: string }>(`${base}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, timeout: 30000 });
    this.token = { value: response.data.access_token, expiresAt: Date.now() + Math.max(60, Number(response.data.expires_in) - 300) * 1000 };
    return this.token.value;
  }

  async initiate(input: { phone: string; amount: number; reference: string }) {
    if (!this.isConfigured()) throw new Error('M-Pesa subscription checkout is not configured yet.');
    const phone = normalizePhone(input.phone);
    const timestamp = new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
    const password = Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${timestamp}`).toString('base64');
    const base = config.mpesa.environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const response = await axios.post<StkResponse>(`${base}/mpesa/stkpush/v1/processrequest`, {
      BusinessShortCode: config.mpesa.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(input.amount),
      PartyA: phone,
      PartyB: config.mpesa.shortcode,
      PhoneNumber: phone,
      CallBackURL: config.mpesa.subscriptionCallbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: 'CHAMA360 subscription',
    }, { headers: { Authorization: `Bearer ${await this.accessToken()}` }, timeout: 30000 });
    return response.data;
  }
}

export const subscriptionPaymentService = new SubscriptionPaymentService();
