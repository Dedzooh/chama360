import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Mail, RefreshCw, Search, Shield, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useOrganizationWorkspace } from '../../context/OrganizationWorkspaceContext';
import { organizationService, type OrganizationMemberRecord, type OrganizationRoleRecord } from '../../services/organizationService';
import { useCompactLayout } from '../../hooks/useCompactLayout';
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, MemberCard, SearchBar, StatCard, TextField } from '../../design-system';
import { OrganizationInviteLink } from '../../components/OrganizationInviteLink';

const roleOptionsFallback: OrganizationRoleRecord[] = [];
const statusLabel = (status: string) => ({ INVITATION_SENT: 'Invited', PENDING_APPROVAL: 'Pending approval', PENDING: 'Pending', ACTIVE: 'Active', SUSPENDED: 'Suspended', EXITED: 'Exited', ARCHIVED: 'Archived' }[status] ?? status);

export const Members = () => {
  const compactLayout = useCompactLayout();
  const location = useLocation();
  const creationResult = location.state as { createdOrganizationId?: string } | null;
  const { currentOrganization, refreshOrganizations } = useOrganizationWorkspace();
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [roles, setRoles] = useState<OrganizationRoleRecord[]>(roleOptionsFallback);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const canManageMembers = ['OWNER', 'FOUNDER', 'ADMIN'].includes((currentOrganization?.myRole ?? '').toUpperCase());

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [memberData, roleData] = await Promise.all([organizationService.listMembers(currentOrganization.id), organizationService.listRoles(currentOrganization.id)]);
      setMembers(memberData);
      setRoles(roleData);
      setInviteRoleId((currentRole) => currentRole || roleData.find((role) => role.name === 'MEMBER')?.id || roleData[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      if (!term) return true;
      const name = `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.toLowerCase();
      const email = (member.user?.email ?? '').toLowerCase();
      const roleLabel = ((member as any).roleLabel ?? (member as any).role?.label ?? member.role ?? '').toString().toLowerCase();
      return name.includes(term) || email.includes(term) || roleLabel.includes(term);
    });
  }, [members, searchTerm]);

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !inviteEmail.trim()) return;

    setSaving(true);
    setError(null);
    setFeedback('');
    try {
      const selectedRole = roles.find((role) => role.id === inviteRoleId);
      await organizationService.addMember(currentOrganization.id, {
        email: inviteEmail.trim().toLowerCase(),
        role: selectedRole?.name ?? 'MEMBER',
        status: 'PENDING_APPROVAL',
      });
      setInviteEmail('');
      await loadData();
      setFeedback('Member added.');
      await refreshOrganizations();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (member: OrganizationMemberRecord, nextRoleId: string, nextStatus: OrganizationMemberRecord['status']) => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    setFeedback('');
    try {
      await organizationService.updateMember(currentOrganization.id, member.id, {
        roleId: nextRoleId || undefined,
        status: nextStatus as any,
      });
      await loadData();
      await refreshOrganizations();
      setFeedback(nextStatus === 'ACTIVE' ? 'Member approved and active.' : 'Member updated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: OrganizationMemberRecord) => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.removeMember(currentOrganization.id, member.id);
      await loadData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove member');
    } finally {
      setSaving(false);
      setMemberToRemove(null);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage members." />;
  }

  const activeCount = members.filter((member) => member.status === 'ACTIVE').length;
  const pendingCount = members.filter((member) => member.status === 'PENDING' || member.status === 'PENDING_APPROVAL' || member.status === 'INVITATION_SENT').length;
  const approvalRequests = members.filter((member) => member.status === 'PENDING_APPROVAL');
  const suspendedCount = members.filter((member) => member.status === 'SUSPENDED').length;
  const activeFounderCount = members.filter((member) => ['OWNER', 'FOUNDER'].includes(String(member.role).toUpperCase()) && member.status === 'ACTIVE').length;

  const mobileLayout = (
    <div className="space-y-4 md:hidden">
      <section className="chama360-module-hero chama360-module-hero-members">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Member management</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Members</h1>
            <p>Invite members, update roles, and keep access visible for every committee action.</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#members-roster-mobile">
              <Search className="h-4 w-4" />
              Roster
            </a>
            {canManageMembers ? <a href="#member-invite-mobile">
              <UserPlus className="h-4 w-4" />
              Invite
            </a> : null}
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Users className="h-5 w-5" /></span>
            <p>Total roster</p>
            <strong>{loading ? '...' : members.length}</strong>
            <small>Members in this chama</small>
          </article>
          <article>
            <span className="blue"><UserCheck className="h-5 w-5" /></span>
            <p>Active</p>
            <strong>{loading ? '...' : activeCount}</strong>
            <small>Operational accounts</small>
          </article>
          <article>
            <span className="gold"><Mail className="h-5 w-5" /></span>
            <p>Pending</p>
            <strong>{loading ? '...' : pendingCount}</strong>
            <small>Invites and approvals</small>
          </article>
        </div>
      </section>

      <section id="members-roster-mobile" className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Roster</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Search and manage</h2>
        </div>
        <div className="section-body space-y-3">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search by name, email, or role" />
          <div className="flex flex-wrap gap-2">
            <Chip active={false} onClick={() => void loadData()}>
              Refresh
            </Chip>
            <Chip active={searchTerm.length > 0} onClick={() => setSearchTerm('')}>
              Clear
            </Chip>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <>
            <div className="h-24 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
            <div className="h-24 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
            <div className="h-24 animate-pulse rounded-[18px] bg-[var(--ds-surface-2)]" />
          </>
        ) : filteredMembers.length === 0 ? (
          <EmptyState title="No members match your search." description="Clear the search or invite a new member to expand the roster." />
        ) : (
          filteredMembers.map((member) => {
            const role = (member as any).role as { id?: string; label?: string; name?: string } | string | undefined;
            const currentRoleId = typeof role === 'object' ? role?.id ?? '' : '';
            const currentRoleLabel = member.roleLabel ?? (typeof role === 'object' ? role?.label ?? role?.name : member.role);
            const canSuspend = member.status === 'ACTIVE';
            const canRestore = member.status === 'SUSPENDED' || member.status === 'EXITED' || member.status === 'ARCHIVED';
            const isOnlyFounder = ['OWNER', 'FOUNDER'].includes(String(member.role).toUpperCase()) && activeFounderCount <= 1;

            return (
              <Card key={member.id} className="mobile-finance-card overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
                <div className="p-4">
                  <MemberCard
                    name={`${member.user?.firstName ?? 'Member'} ${member.user?.lastName ?? ''}`.trim()}
                    role={String(currentRoleLabel ?? member.role)}
                    email={member.user?.email ?? 'No email'}
                    status={statusLabel(String(member.status))}
                  />

                  {canManageMembers ? <div className="mt-4 grid gap-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Role</span>
                      <select
                        value={currentRoleId}
                        onChange={(event) => void updateMember(member, event.target.value, member.status)}
                        disabled={saving || roles.length === 0}
                        className="input w-full"
                      >
                        {roles.map((roleItem) => (
                          <option key={roleItem.id} value={roleItem.id}>
                            {roleItem.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Status</span>
                      <select
                        value={member.status}
                        onChange={(event) => void updateMember(member, currentRoleId, event.target.value as OrganizationMemberRecord['status'])}
                        disabled={saving}
                        className="input w-full"
                      >
                        <option value={member.status}>{statusLabel(String(member.status))}</option>
                      </select>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" disabled={saving || isOnlyFounder} onClick={() => setMemberToRemove(member)} startIcon={<Trash2 className="h-4 w-4" />}>
                        Remove
                      </Button>
                      {canSuspend ? (
                        <Button variant="outline" disabled={saving || isOnlyFounder} onClick={() => void updateMember(member, currentRoleId, 'SUSPENDED')} startIcon={<Archive className="h-4 w-4" />}>
                          Suspend
                        </Button>
                      ) : canRestore ? (
                        <Button disabled={saving} onClick={() => void updateMember(member, currentRoleId, 'ACTIVE')} startIcon={<Shield className="h-4 w-4" />}>
                          Activate
                        </Button>
                      ) : (
                        <div />
                      )}
                    </div>
                  </div> : null}
                </div>
              </Card>
            );
          })
        )}
      </section>

      {canManageMembers ? <section id="member-invite-mobile" className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Invite</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">Add member</h2>
        </div>
        <div className="section-body">
          <form onSubmit={inviteMember} className="space-y-4">
            <TextField label="Email" placeholder="member@example.com" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Role</span>
              <select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)} className="input w-full">
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-xl bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">New members are automatically marked <strong>Pending approval</strong>. Approve them from the join requests list.</p>
            <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <UserPlus className="h-4 w-4" /> : undefined}>
              Add member
            </Button>
          </form>
          <p className="mt-3 text-sm text-[var(--ds-text-muted)]">Adding by email uses the current organization roles already defined on the backend.</p>
        </div>
      </section> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {canManageMembers && (creationResult?.createdOrganizationId === currentOrganization.id || activeCount <= 1) ? <section className="section-shell overflow-hidden" aria-labelledby="getting-started-title">
        <div className="section-header"><p className="text-sm text-[var(--ds-text-muted)]">Getting started</p><h2 id="getting-started-title" className="text-xl font-black text-[var(--ds-secondary)]">Your chama is ready. Here are the next steps.</h2></div>
        <div className="section-body grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl bg-[var(--ds-surface-2)] p-4 text-sm"><strong className="block text-[var(--ds-secondary)]">1. Share your free link</strong>Members can review the group and request to join.</p>
          <p className="rounded-xl bg-[var(--ds-surface-2)] p-4 text-sm"><strong className="block text-[var(--ds-secondary)]">2. Approve requests</strong>Check each person before giving access.</p>
          <div className="rounded-xl bg-[var(--ds-surface-2)] p-4 text-sm"><strong className="block text-[var(--ds-secondary)]">3. Record a contribution</strong><Link className="mt-2 inline-flex font-semibold text-[var(--ds-primary)] underline" to={ROUTES.chama.contributions(currentOrganization.id)}>Open contributions</Link></div>
        </div>
      </section> : null}
      {canManageMembers ? <OrganizationInviteLink organizationId={currentOrganization.id} organizationName={currentOrganization.name} /> : null}
      {canManageMembers ? <section className="section-shell overflow-hidden" aria-labelledby="join-requests-title">
        <div className="section-header flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--ds-text-muted)]">Member access</p><h2 id="join-requests-title" className="text-xl font-black text-[var(--ds-secondary)]">Join requests ({approvalRequests.length})</h2></div><Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button></div>
        <div className="section-body space-y-3">
          {loading ? <p className="text-sm text-[var(--ds-text-muted)]">Checking for requests…</p> : approvalRequests.length ? approvalRequests.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ds-border)] p-4"><div><strong className="text-[var(--ds-secondary)]">{`${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim() || member.user?.email || 'New member'}</strong><p className="text-sm text-[var(--ds-text-muted)]">{member.user?.email ?? 'Requested to join'}</p></div><Button disabled={saving} onClick={() => void updateMember(member, '', 'ACTIVE')} startIcon={<UserCheck className="h-4 w-4" />}>Approve</Button></div>) : <p className="text-sm text-[var(--ds-text-muted)]">No requests yet. Share the link above, then return here to approve members.</p>}
          {feedback ? <p role="status" className="text-sm text-emerald-700">{feedback}</p> : null}
          {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </section> : null}
      {compactLayout ? mobileLayout : <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-members">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Member management</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Members</h1>
            <p>Invite members, change roles, suspend access, and keep the roster current.</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#members-roster">
              <Search className="h-4 w-4" />
              Roster
            </a>
            {canManageMembers ? <a href="#member-invite">
              <UserPlus className="h-4 w-4" />
              Invite
            </a> : null}
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><Users className="h-5 w-5" /></span>
            <p>Total roster</p>
            <strong>{loading ? '...' : members.length}</strong>
            <small>Members in this chama</small>
          </article>
          <article>
            <span className="blue"><UserCheck className="h-5 w-5" /></span>
            <p>Active</p>
            <strong>{loading ? '...' : activeCount}</strong>
            <small>{pendingCount} pending approval</small>
          </article>
          <article>
            <span className="gold"><Archive className="h-5 w-5" /></span>
            <p>Suspended</p>
            <strong>{loading ? '...' : suspendedCount}</strong>
            <small>Paused access</small>
          </article>
        </div>
      </section>
      
      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Members" value={loading ? '...' : members.length.toString()} trend="Total roster" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active" value={loading ? '...' : activeCount.toString()} trend={`${pendingCount} pending`} icon={<Badge tone="success">Live</Badge>} />
        <StatCard label="Suspended" value={loading ? '...' : suspendedCount.toString()} trend="Access paused" icon={<Archive className="h-5 w-5" />} />
      </section>

      <section id="members-roster" className="section-shell overflow-hidden">
        <div className="section-body space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Roster</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Current members</h2>
            </div>
            <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search by name, email, or role" />
        </div>

        <div className="section-body space-y-4 pt-0">
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState title="No members match your search." description="Clear the search or add a new member to start building the roster." />
          ) : (
            filteredMembers.map((member) => {
              const role = (member as any).role as { id?: string; label?: string; name?: string } | string | undefined;
              const currentRoleId = typeof role === 'object' ? role?.id ?? '' : '';
              const currentRoleLabel = member.roleLabel ?? (typeof role === 'object' ? role?.label ?? role?.name : member.role);
              const canSuspend = member.status === 'ACTIVE';
              const canRestore = member.status === 'SUSPENDED' || member.status === 'EXITED' || member.status === 'ARCHIVED';
              const isOnlyFounder = ['OWNER', 'FOUNDER'].includes(String(member.role).toUpperCase()) && activeFounderCount <= 1;

              return (
                <Card key={member.id} className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <MemberCard
                      name={`${member.user?.firstName ?? 'Member'} ${member.user?.lastName ?? ''}`.trim()}
                      role={String(currentRoleLabel ?? member.role)}
                      email={member.user?.email ?? 'No email'}
                      status={String(member.status)}
                    />

                    {canManageMembers ? <div className="grid gap-3 md:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Role</span>
                        <select
                          value={currentRoleId}
                          onChange={(event) => void updateMember(member, event.target.value, member.status)}
                          disabled={saving || roles.length === 0}
                          className="mt-1 w-full input"
                        >
                          {roles.map((roleItem) => (
                            <option key={roleItem.id} value={roleItem.id}>
                              {roleItem.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-muted)]">Status</span>
                        <select
                          value={member.status}
                          onChange={(event) => void updateMember(member, currentRoleId, event.target.value as OrganizationMemberRecord['status'])}
                          disabled={saving}
                          className="mt-1 w-full input"
                        >
                          <option value={member.status}>{statusLabel(String(member.status))}</option>
                        </select>
                      </label>

                      <div className="flex items-end gap-2">
                        <Button variant="outline" disabled={saving || isOnlyFounder} onClick={() => setMemberToRemove(member)} startIcon={<Trash2 className="h-4 w-4" />}>
                          Remove
                        </Button>
                        {canSuspend ? (
                          <Button variant="outline" disabled={saving || isOnlyFounder} onClick={() => void updateMember(member, currentRoleId, 'SUSPENDED')} startIcon={<Archive className="h-4 w-4" />}>
                            Suspend
                          </Button>
                        ) : null}
                        {canRestore ? (
                          <Button disabled={saving} onClick={() => void updateMember(member, currentRoleId, 'ACTIVE')} startIcon={<Shield className="h-4 w-4" />}>
                            Activate
                          </Button>
                        ) : null}
                      </div>
                    </div> : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {canManageMembers ? <section id="member-invite" className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-[var(--ds-text-muted)]">Invite</p>
          <h2 className="mt-1 text-xl font-black text-[var(--ds-secondary)]">Add member</h2>
        </div>
        <div className="section-body">
          <form onSubmit={inviteMember} className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
            <TextField label="Email" placeholder="member@example.com" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Role</span>
              <select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)} className="input w-full">
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-xl bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)] md:col-span-2">New members are automatically marked <strong>Pending approval</strong>. Approve them from the join requests list.</p>
            <div className="flex items-end">
              <Button type="submit" loading={saving} className="w-full" startIcon={!saving ? <UserPlus className="h-4 w-4" /> : undefined}>
                Add member
              </Button>
            </div>
          </form>
          <p className="mt-3 text-sm text-[var(--ds-text-muted)]">For the fastest onboarding, share the invitation link above. Email adds are for existing CHAMA360 accounts and start as Pending approval.</p>
        </div>
      </section> : null}
      </div>}
      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remove member?"
        description={`${memberToRemove?.user?.firstName ?? 'This member'} will lose access to this chama. Existing financial and audit records remain intact.`}
        confirmLabel="Remove member"
        destructive
        busy={saving}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => { if (memberToRemove) void removeMember(memberToRemove); }}
      />
    </div>
  );
};
