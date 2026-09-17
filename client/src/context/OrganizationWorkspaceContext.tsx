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
  setActiveOrganizationId: (organizationId: string) => void;
}

const OrganizationWorkspaceContext = createContext<OrganizationWorkspaceContextValue | null>(null);

interface OrganizationWorkspaceProviderProps {
  children: ReactNode;
  selectedOrganizationId?: string | null;
}

const ACTIVE_ORGANIZATION_KEY = 'chama360:active-organization-id';

export const OrganizationWorkspaceProvider = ({ children, selectedOrganizationId }: OrganizationWorkspaceProviderProps) => {
  const { isAuthenticated } = useAuthStore();
  const [storedOrganizationId, setStoredOrganizationId] = useState<string | null>(() => selectedOrganizationId ?? localStorage.getItem(ACTIVE_ORGANIZATION_KEY));
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationDetail | OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeSelection = selectedOrganizationId ?? storedOrganizationId;
  const setActiveOrganizationId = useCallback((organizationId: string) => {
    setStoredOrganizationId(organizationId);
    localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
  }, []);

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

      const preferred = activeSelection ? myOrganizations.find((organization) => organization.id === activeSelection) : undefined;
      const fallback = preferred ?? myOrganizations[0];
      if (fallback) {
        setActiveOrganizationId(fallback.id);
        const selected = await organizationService.getOrganization(fallback.id);
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
  }, [activeSelection, isAuthenticated, setActiveOrganizationId]);

  useEffect(() => {
    if (selectedOrganizationId) setActiveOrganizationId(selectedOrganizationId);
  }, [selectedOrganizationId, setActiveOrganizationId]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const value = useMemo<OrganizationWorkspaceContextValue>(
    () => ({
      organizations,
      currentOrganization,
      activeOrganizationId: currentOrganization?.id ?? activeSelection ?? null,
      loading,
      error,
      refreshOrganizations,
      setActiveOrganizationId,
    }),
    [activeSelection, currentOrganization, error, loading, organizations, refreshOrganizations, setActiveOrganizationId]
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
