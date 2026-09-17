import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckSquare, Megaphone, RefreshCw, Save } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { ROUTES } from '../config/routes';
import { organizationService } from '../services/organizationService';
import type { MeetingAttendanceRecord, MeetingRecord, VoteRecord } from '../types';
import { Badge, Button, Card, EmptyState, MetricCard, SelectField, TextField, Timeline } from '../design-system';

const roleUpper = (value?: string) => (value ?? '').toUpperCase();
const readableDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '');

export const Meetings = () => {
  const { meetingId } = useParams<{ meetingId?: string }>();
  const { currentOrganization } = useOrganizationWorkspace();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Monthly Meeting');
  const [dateTime, setDateTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [venue, setVenue] = useState('Main hall');
  const [agendaText, setAgendaText] = useState('Opening\nContributions\nLoans\nWelfare');
  const [attendanceMemberId, setAttendanceMemberId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState('PRESENT');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [resolutionsText, setResolutionsText] = useState('');
  const [actionItemsText, setActionItemsText] = useState('');
  const [voteTitle, setVoteTitle] = useState('');
  const [voteDescription, setVoteDescription] = useState('');
  const [voteOptions, setVoteOptions] = useState('Approve\nReject');
  const [voteClosesAt, setVoteClosesAt] = useState('');

  const members = currentOrganization?.members ?? [];
  const canManageMeetings = useMemo(() => ['OWNER', 'FOUNDER', 'SECRETARY', 'ADMIN'].includes(roleUpper(currentOrganization?.myRole)), [currentOrganization?.myRole]);
  const isReadOnly = ['CLOSED', 'ARCHIVED'].includes(roleUpper(currentOrganization?.status));

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const meetingsData = await organizationService.listMeetings(currentOrganization.id);
      setMeetings(meetingsData);
      const active = meetingId ? meetingsData.find((item) => item.id === meetingId) ?? null : meetingsData[0] ?? null;
      if (active) {
        const detail = await organizationService.getMeeting(currentOrganization.id, active.id);
        setSelectedMeeting(detail);
        setEditTitle(detail.title);
        setEditDateTime(detail.dateTime.slice(0, 16));
        setEditVenue(detail.venue ?? '');
      } else {
        setSelectedMeeting(null);
        setEditTitle('');
        setEditDateTime('');
        setEditVenue('');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, meetingId]);

  const submitMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.createMeeting(currentOrganization.id, {
        title,
        dateTime,
        venue: venue || undefined,
        agenda: agendaText.split('\n').map((v) => v.trim()).filter(Boolean),
      });
      setTitle('Monthly Meeting');
      setDateTime(new Date().toISOString().slice(0, 16));
      setVenue('Main hall');
      setAgendaText('Opening\nContributions\nLoans\nWelfare');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  };

  const updateMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedMeeting) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.updateMeeting(currentOrganization.id, selectedMeeting.id, {
        title: editTitle,
        dateTime: editDateTime,
        venue: editVenue || undefined,
      });
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const recordAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedMeeting) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.recordMeetingAttendance(currentOrganization.id, selectedMeeting.id, {
        memberId: attendanceMemberId,
        status: attendanceStatus as any,
        notes: attendanceNotes || undefined,
      });
      setAttendanceMemberId('');
      setAttendanceStatus('PRESENT');
      setAttendanceNotes('');
      await loadData();
    } catch (attendanceError) {
      setError(attendanceError instanceof Error ? attendanceError.message : 'Failed to record attendance');
    } finally {
      setSaving(false);
    }
  };

  const saveMinutes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedMeeting) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.addMeetingMinutes(currentOrganization.id, selectedMeeting.id, {
        minutes: minutesText.split('\n').map((v) => v.trim()).filter(Boolean),
        resolutions: resolutionsText.split('\n').map((v) => v.trim()).filter(Boolean),
        actionItems: actionItemsText.split('\n').map((v) => v.trim()).filter(Boolean),
      });
      setMinutesText('');
      setResolutionsText('');
      setActionItemsText('');
      await loadData();
    } catch (minutesError) {
      setError(minutesError instanceof Error ? minutesError.message : 'Failed to save minutes');
    } finally {
      setSaving(false);
    }
  };

  const createVote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedMeeting) return;
    setSaving(true);
    setError(null);
    try {
      await organizationService.createVote(currentOrganization.id, selectedMeeting.id, {
        title: voteTitle,
        description: voteDescription,
        options: voteOptions.split('\n').map((v) => v.trim()).filter(Boolean),
        closesAt: voteClosesAt || undefined,
      });
      setVoteTitle('');
      setVoteDescription('');
      setVoteOptions('Approve\nReject');
      setVoteClosesAt('');
      await loadData();
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Failed to create vote');
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrganization) {
    return <EmptyState title="No chama selected" description="Open a Chama from My Chamas to manage meetings." />;
  }

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-meetings">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Meeting workflow</span>
            <strong>{isReadOnly ? 'Read only' : 'Governance'}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>{currentOrganization.name}</p>
            <h1>Meetings</h1>
            <small>Schedule sessions, capture attendance and minutes, and create motions for approval.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#meeting-create">
              <CalendarPlus className="h-4 w-4" />
              Schedule
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><CalendarPlus className="h-5 w-5" /></span>
            <p>Meetings</p>
            <strong>{loading ? '...' : meetings.length.toString()}</strong>
            <small>Recorded sessions</small>
          </article>
          <article>
            <span className="blue"><CheckSquare className="h-5 w-5" /></span>
            <p>Attendance</p>
            <strong>{loading ? '...' : String(selectedMeeting?.attendance?.length ?? 0)}</strong>
            <small>Current meeting</small>
          </article>
          <article>
            <span className="gold"><Megaphone className="h-5 w-5" /></span>
            <p>Votes</p>
            <strong>{loading ? '...' : String(selectedMeeting?.votes?.length ?? 0)}</strong>
            <small>Current meeting</small>
          </article>
        </div>
      </section>

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Meetings" value={loading ? '...' : meetings.length.toString()} caption="Recorded sessions" tone="emerald" icon={<CalendarPlus className="h-5 w-5" />} />
        <MetricCard title="Attendance" value={loading ? '...' : String(selectedMeeting?.attendance?.length ?? 0)} caption="Current meeting" tone="navy" icon={<Badge tone="info">Live</Badge>} />
        <MetricCard title="Votes" value={loading ? '...' : String(selectedMeeting?.votes?.length ?? 0)} caption="Current meeting" tone="gold" icon={<Badge tone="accent">Motion</Badge>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Meeting list</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Recorded meetings</h2>
            </div>
            <Button variant="outline" onClick={() => void loadData()} startIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--ds-surface-2)]" />
            ) : meetings.length === 0 ? (
              <EmptyState title="No meetings yet." description="Create your first meeting to track attendance, minutes, and votes." />
            ) : (
              meetings.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => {
                    setSelectedMeeting(meeting);
                    setEditTitle(meeting.title);
                    setEditDateTime(meeting.dateTime.slice(0, 16));
                    setEditVenue(meeting.venue ?? '');
                  }}
                  className={`w-full rounded-[var(--ds-radius-lg)] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-soft)] ${
                    selectedMeeting?.id === meeting.id
                      ? 'border-[rgba(15,132,95,0.26)] bg-[rgba(15,132,95,0.08)]'
                      : 'border-[var(--ds-border)] bg-[var(--ds-surface-3)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--ds-secondary)]">{meeting.title}</p>
                      <p className="text-sm text-[var(--ds-text-muted)]">
                        {readableDate(meeting.dateTime)}
                        {meeting.venue ? ` | ${meeting.venue}` : ''}
                      </p>
                    </div>
                    <Badge tone="neutral">{meeting.status}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card id="meeting-create" className="p-6">
            <p className="text-sm text-[var(--ds-text-muted)]">New meeting</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Create meeting</h2>
            {isReadOnly ? <p className="mt-2 text-sm text-amber-700">This Chama is read-only. Meeting creation is disabled.</p> : null}
            <form onSubmit={submitMeeting} className="mt-5 space-y-4">
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Date and time" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
                <TextField label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Agenda</span>
                <textarea value={agendaText} onChange={(e) => setAgendaText(e.target.value)} rows={4} className="input min-h-28 w-full" />
              </label>
              <Button type="submit" loading={saving} disabled={!canManageMeetings} className="w-full" startIcon={!saving ? <CalendarPlus className="h-4 w-4" /> : undefined}>
                Create meeting
              </Button>
            </form>
          </Card>

          {selectedMeeting ? (
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--ds-text-muted)]">Meeting details</p>
                  <h2 className="text-xl font-black text-[var(--ds-secondary)]">{selectedMeeting.title}</h2>
                </div>
                <Link to={ROUTES.chama.voting(currentOrganization.id)}>
                  <Button variant="outline">Open voting</Button>
                </Link>
              </div>

              <form onSubmit={updateMeeting}>
              <Card className="p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <TextField label="Date and time" type="datetime-local" value={editDateTime} onChange={(e) => setEditDateTime(e.target.value)} />
                </div>
                <TextField label="Venue" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} className="mt-4" />
                <div className="mt-4">
                  <Button type="submit" variant="outline" loading={saving} disabled={!canManageMeetings} className="w-full" startIcon={<Save className="h-4 w-4" />}>
                    Save changes
                  </Button>
                </div>
              </Card>
              </form>

              <Card className="p-4">
                <h3 className="font-semibold text-[var(--ds-secondary)]">Attendance</h3>
                <div className="mt-3 space-y-2">
                  {(selectedMeeting.attendance ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--ds-text-muted)]">No attendance recorded yet.</p>
                  ) : (
                    selectedMeeting.attendance?.map((attendance: MeetingAttendanceRecord) => (
                      <div key={attendance.id} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            {attendance.member?.firstName ?? 'Member'} {attendance.member?.lastName ?? ''}
                          </span>
                          <Badge tone="neutral">{attendance.status}</Badge>
                        </div>
                        {attendance.notes ? <p className="mt-1">{attendance.notes}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-[var(--ds-secondary)]">Record attendance</h3>
                <form onSubmit={recordAttendance} className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label="Member" value={attendanceMemberId} onChange={(e) => setAttendanceMemberId(e.target.value)}>
                      <option value="">Select member</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.userId ?? member.id}>
                          {member.user?.firstName} {member.user?.lastName}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField label="Status" value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value)}>
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="APOLOGY">Apology</option>
                    </SelectField>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Notes</span>
                    <textarea value={attendanceNotes} onChange={(e) => setAttendanceNotes(e.target.value)} rows={3} className="input min-h-24 w-full" />
                  </label>
                  <Button type="submit" loading={saving} disabled={!canManageMeetings} className="w-full" startIcon={!saving ? <CheckSquare className="h-4 w-4" /> : undefined}>
                    Record attendance
                  </Button>
                </form>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-[var(--ds-secondary)]">Minutes</h3>
                <form onSubmit={saveMinutes} className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Minutes</span>
                    <textarea value={minutesText} onChange={(e) => setMinutesText(e.target.value)} rows={3} className="input min-h-24 w-full" placeholder="One note per line" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Resolutions</span>
                    <textarea value={resolutionsText} onChange={(e) => setResolutionsText(e.target.value)} rows={3} className="input min-h-24 w-full" placeholder="One resolution per line" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Action items</span>
                    <textarea value={actionItemsText} onChange={(e) => setActionItemsText(e.target.value)} rows={3} className="input min-h-24 w-full" placeholder="One action item per line" />
                  </label>
                  <Button type="submit" loading={saving} disabled={!canManageMeetings} className="w-full" startIcon={!saving ? <Save className="h-4 w-4" /> : undefined}>
                    Save minutes
                  </Button>
                </form>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">Voting</h3>
                  <Link to={ROUTES.chama.voting(currentOrganization.id)} className="text-sm font-medium text-[var(--ds-text-muted)]">
                    Open voting screen
                  </Link>
                </div>
                <div className="mt-3 space-y-3">
                  {(selectedMeeting.votes ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--ds-text-muted)]">No votes created for this meeting.</p>
                  ) : (
                    selectedMeeting.votes?.map((vote: VoteRecord) => (
                      <div key={vote.id} className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-3 text-sm text-[var(--ds-text-muted)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[var(--ds-secondary)]">{vote.title}</span>
                          <Badge tone="neutral">{vote.status}</Badge>
                        </div>
                        <p className="mt-1">{vote.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold text-[var(--ds-secondary)]">Create vote</h3>
                <form onSubmit={createVote} className="mt-4 space-y-4">
                  <TextField label="Title" value={voteTitle} onChange={(e) => setVoteTitle(e.target.value)} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Description</span>
                    <textarea value={voteDescription} onChange={(e) => setVoteDescription(e.target.value)} rows={3} className="input min-h-24 w-full" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">Options</span>
                    <textarea value={voteOptions} onChange={(e) => setVoteOptions(e.target.value)} rows={3} className="input min-h-24 w-full" placeholder="One option per line" />
                  </label>
                  <TextField label="Closes at" type="datetime-local" value={voteClosesAt} onChange={(e) => setVoteClosesAt(e.target.value)} />
                  <Button type="submit" loading={saving} disabled={!canManageMeetings} className="w-full" startIcon={!saving ? <Megaphone className="h-4 w-4" /> : undefined}>
                    Create vote
                  </Button>
                </form>
              </Card>

              <Card className="p-4">
                <Timeline
                  items={[
                    { title: 'Schedule meeting', description: 'Set the date and agenda before the session' },
                    { title: 'Attendance', description: 'Track who attended and who sent apologies' },
                    { title: 'Minutes and votes', description: 'Record decisions and open motions for approval' },
                  ]}
                />
              </Card>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
};
