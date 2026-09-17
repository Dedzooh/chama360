import api from '../config/api';
import { ChamaStatus, ChamaType, ChamaVisibility } from '../types';
import { isReadonlyChama } from '../utils/chamaLifecycle';

export interface CreateChamaData {
  name: string;
  type: ChamaType;
  description: string;
  maxMembers: number;
  contributionAmount: number;
  contributionFrequency: 'WEEKLY' | 'MONTHLY';
  currency: string;
  visibility: ChamaVisibility;
  settings: any;
}

export interface UpdateChamaData {
  name?: string;
  description?: string;
  maxMembers?: number;
  contributionAmount?: number;
  contributionFrequency?: 'WEEKLY' | 'MONTHLY';
  visibility?: ChamaVisibility;
  settings?: any;
  status?: ChamaStatus;
}

const normalizeTypeForApi = (type: ChamaType) => (type === 'MERRY_GO_ROUND' ? 'ROSCA' : type);

const normalizeChama = (chama: any) => {
  if (!chama) return chama;
  return {
    ...chama,
    currentMembers: chama._count?.memberships ?? chama.currentMembers ?? 0,
  };
};

const normalizeChamaList = (items: any) => (Array.isArray(items) ? items.map(normalizeChama) : items);

export const chamaService = {
  getMyChamas: async () => {
    const response = await api.get('/membership/list');
    const memberships = response.data.memberships || [];
    return memberships.map((membership: any) => ({
      ...membership,
      chama: normalizeChama(membership.chama),
    }));
  },

  getChamaById: async (id: string) => {
    const response = await api.get(`/chama/${id}`);
    return normalizeChama(response.data.chama);
  },

  getChamaByInviteLink: async (shareableLink: string) => {
    const response = await api.get(`/chama/invite/${shareableLink}`);
    return normalizeChama(response.data.chama);
  },

  createChama: async (data: CreateChamaData) => {
    const response = await api.post('/chama/create', { ...data, type: normalizeTypeForApi(data.type) });
    return normalizeChama(response.data.chama);
  },

  updateChama: async (chamaId: string, data: UpdateChamaData) => {
    const response = await api.put(`/chama/${chamaId}`, data);
    return normalizeChama(response.data.chama || response.data);
  },

  activateChama: async (chamaId: string) => {
    const response = await api.post(`/chama/${chamaId}/activate`);
    return normalizeChama(response.data.chama || response.data);
  },

  suspendChama: async (chamaId: string) => {
    const response = await api.post(`/chama/${chamaId}/suspend`);
    return normalizeChama(response.data.chama || response.data);
  },

  closeChama: async (chamaId: string) => {
    const response = await api.post(`/chama/${chamaId}/close`);
    return normalizeChama(response.data.chama || response.data);
  },

  archiveChama: async (chamaId: string) => {
    const response = await api.post(`/chama/${chamaId}/archive`);
    return normalizeChama(response.data.chama || response.data);
  },

  canEditChama: (status?: ChamaStatus | null) => !isReadonlyChama(status),

  discoverChamas: async (filters?: {
    type?: ChamaType;
    location?: string;
    minContribution?: number;
    maxContribution?: number;
  }) => {
    const response = await api.get('/chama/public', { params: filters });
    const chamas = response.data.chamas || response.data;
    return normalizeChamaList(chamas);
  },

  joinChama: async (chamaId: string, shareableLink?: string) => {
    const response = await api.post('/chama/join', {
      chamaId,
      shareableLink,
      termsAgreed: true,
    });
    return response.data.membership || response.data;
  },

  getMembers: async (chamaId: string) => {
    const response = await api.get(`/chama/${chamaId}/members`);
    const members = response.data.members || response.data;
    return Array.isArray(members)
      ? members.map((member: any) => ({
          id: member.userId || member.user?.id,
          firstName: member.user?.firstName || member.firstName,
          lastName: member.user?.lastName || member.lastName,
          role: member.role,
          status: member.status,
        }))
      : members;
  },

  getPendingApplications: async (chamaId: string) => {
    const response = await api.get(`/chama/${chamaId}/applications`);
    return response.data.applications || [];
  },

  approveMember: async (chamaId: string, memberId: string) => {
    const response = await api.post(`/chama/${chamaId}/applications/${memberId}/approve`);
    return response.data.membership || response.data;
  },

  rejectMember: async (chamaId: string, memberId: string, reason: string) => {
    const response = await api.post(`/chama/${chamaId}/applications/${memberId}/reject`, { rejectionReason: reason });
    return response.data;
  },

  inviteMembers: async (chamaId: string, emails: string[], message?: string) => {
    const response = await api.post(`/chama/${chamaId}/invite`, {
      emails,
      message,
    });
    return response.data;
  },
};
