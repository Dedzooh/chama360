import api from '../config/api';

export const userService = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },

  getDocuments: async () => {
    const response = await api.get('/user/documents');
    return response.data;
  },

  getNotifications: async (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) => {
    const response = await api.get('/user/notifications', { params });
    return response.data as {
      notifications: Array<{
        id: string;
        recipientId: string;
        chamaId?: string | null;
        organizationId?: string | null;
        type: string;
        priority: string;
        title: string;
        message: string;
        status: string;
        scheduledFor?: string | null;
        sentAt?: string | null;
        acknowledgedAt?: string | null;
        createdAt: string;
        channels?: Array<{ id: string; type: string; status: string }>;
      }>;
      total: number;
    };
  },

  getNotificationPreferences: async () => {
    const response = await api.get('/user/notification-preferences');
    return response.data as {
      preferences: {
        smsEnabled: boolean;
        emailEnabled: boolean;
        pushEnabled: boolean;
        inAppEnabled: boolean;
        quietHoursStart?: string | null;
        quietHoursEnd?: string | null;
        priorityOverride: boolean;
      };
    };
  },

  updateNotificationPreferences: async (data: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    inAppEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    priorityOverride?: boolean;
  }) => {
    const response = await api.put('/user/notification-preferences', data);
    return response.data;
  },

  acknowledgeNotification: async (notificationId: string) => {
    const response = await api.patch(`/user/notifications/${notificationId}/acknowledge`);
    return response.data;
  },

  uploadDocument: async (data: {
    type: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'UTILITY_BILL' | 'BANK_STATEMENT';
    frontImage: string;
    backImage?: string;
    documentNumber: string;
    issueDate?: string;
    expiryDate?: string;
    issuingAuthority?: string;
  }) => {
    const response = await api.post('/user/upload-document', data);
    return response.data;
  },

  updateProfile: async (data: { firstName: string; lastName: string; phone: string }) => {
    const response = await api.put('/user/profile', {
      profile: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });
    return response.data;
  },

  requestAccountDeletion: async (currentPassword: string, reason?: string) => {
    const response = await api.delete('/user/account', {
      data: { confirmation: 'DELETE', currentPassword, reason: reason?.trim() || undefined },
    });
    return response.data as {
      message: string;
      retainedDataNotice: string;
    };
  },
};
