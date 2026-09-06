import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { organizationService, type OrganizationDetail, type OrganizationSummary } from '../services/organizationService';

interface OrganizationWorkspaceContextValue {
  organizations: OrganizationSummary[];
  currentOrganization: OrganizationDetail | OrganizationSummary | null;
  activeOrganizationId: string | null;
  loading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationWorkspaceContext = createContext<OrganizationWorkspaceContextValue | null>(null);

interface OrganizationWorkspaceProviderProps {
  children: ReactNode;
  selectedOrganizationId?: string | null;
}

export const OrganizationWorkspaceProvider = ({ children, selectedOrganizationId }: OrganizationWorkspaceProviderProps) => {
  const { isAuthenticated } = useAuthStore();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationDetail | OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const myOrganizations = await organizationService.listMyOrganizations();
      setOrganizations(myOrganizations);

      if (selectedOrganizationId) {
        const selected = await organizationService.getOrganization(selectedOrganizationId);
        setCurrentOrganization(selected);
      } else {
        setCurrentOrganization(null);
      }
    } catch (fetchError) {
      console.error('Failed to load organizations', fetchError);
      const status = (fetchError as any)?.response?.status;
      if (status === 403) {
        setError('Access denied to this Chama workspace');
      } else if (status === 404) {
        setError('Chama not found');
      } else {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organizations');
      }
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedOrganizationId]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const value = useMemo<OrganizationWorkspaceContextValue>(
    () => ({
      organizations,
      currentOrganization,
      activeOrganizationId: currentOrganization?.id ?? selectedOrganizationId ?? null,
      loading,
      error,
      refreshOrganizations,
    }),
    [currentOrganization, error, loading, organizations, refreshOrganizations, selectedOrganizationId]
  );

  return <OrganizationWorkspaceContext.Provider value={value}>{children}</OrganizationWorkspaceContext.Provider>;
};

export const useOrganizationWorkspace = () => {
  const context = useContext(OrganizationWorkspaceContext);
  if (!context) {
    throw new Error('useOrganizationWorkspace must be used within OrganizationWorkspaceProvider');
  }
  return context;
};
