import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, RefreshCw, ShieldCheck, Vote } from 'lucide-react';
import { useOrganizationWorkspace } from '../context/OrganizationWorkspaceContext';
import { organizationService } from '../services/organizationService';
import type { MeetingRecord, VoteRecord, VoteResults } from '../types';

const roleUpper = (value?: string) => (value ?? '').toUpperCase();

export const Voting = () => {
  const { voteId } = useParams<{ voteId?: string }>();
  const { currentOrganization } = useOrganizationWorkspace();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [selectedVote, setSelectedVote] = useState<VoteRecord | null>(null);
  const [results, setResults] = useState<VoteResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState('');

  const canManageVotes = useMemo(() => ['OWNER', 'FOUNDER', 'CHAIR', 'ADMIN'].includes(roleUpper(currentOrganization?.myRole)), [currentOrganization?.myRole]);

  const loadVotes = useCallback(async (meetingId: string, preferredVoteId?: string) => {
    if (!currentOrganization?.id) return;
    const votesData = await organizationService.listVotes(currentOrganization.id, meetingId);
    setVotes(votesData);
    const vote = preferredVoteId ? votesData.find((item) => item.id === preferredVoteId) ?? votesData[0] ?? null : votesData[0] ?? null;
    setSelectedVote(vote);
    setResults(vote ? await organizationService.getVoteResults(currentOrganization.id, vote.id) : null);
  }, [currentOrganization?.id]);

  const loadData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const meetingsData = await organizationService.listMeetings(currentOrganization.id);
      setMeetings(meetingsData);
      const meeting = meetingsData.find((item) => item.id === selectedMeetingId) ?? meetingsData[0] ?? null;
      if (meeting) {
        setSelectedMeetingId(meeting.id);
        await loadVotes(meeting.id, voteId);
      } else {
        setVotes([]); setSelectedVote(null); setResults(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load voting data');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, loadVotes, selectedMeetingId, voteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const castVote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentOrganization?.id || !selectedVote) return;
    setSaving(true); setError(null);
    try {
      await organizationService.submitVote(currentOrganization.id, selectedVote.id, { selectedOption });
      setSelectedOption('');
      await loadVotes(selectedMeetingId, selectedVote.id);
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Failed to submit vote');
    } finally { setSaving(false); }
  };

  const closeVote = async () => {
    if (!currentOrganization?.id || !selectedVote) return;
    setSaving(true); setError(null);
    try {
      await organizationService.closeVote(currentOrganization.id, selectedVote.id);
      await loadVotes(selectedMeetingId, selectedVote.id);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Failed to close vote');
    } finally { setSaving(false); }
  };

  if (!currentOrganization) {
    return <div className="section-shell p-6">Open a Chama from My Chamas to manage voting.</div>;
  }

  const activeVotes = votes.filter((item) => item.status === 'ACTIVE').length;
  const closedVotes = votes.filter((item) => item.status === 'CLOSED' || item.status === 'COMPLETED').length;
  const totalResponses = results?.totalResponses ?? 0;

  return (
    <div className="space-y-6 chama360-workspace-page">
      <section className="chama360-module-hero chama360-module-hero-voting">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Governance workflow</span>
            <strong>{currentOrganization.name}</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <h1>Voting</h1>
            <p>Cast ballots, close motions, and review transparent decision results.</p>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#voting-meetings">
              <CalendarDays className="h-4 w-4" />
              Meetings
            </a>
            <a href="#voting-polls">
              <Vote className="h-4 w-4" />
              Polls
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><CalendarDays className="h-5 w-5" /></span>
            <p>Meetings</p>
            <strong>{loading ? '...' : meetings.length}</strong>
            <small>Sources with motions</small>
          </article>
          <article>
            <span className="blue"><ShieldCheck className="h-5 w-5" /></span>
            <p>Active polls</p>
            <strong>{loading ? '...' : activeVotes}</strong>
            <small>{closedVotes} closed or completed</small>
          </article>
          <article>
            <span className="gold"><CheckCircle2 className="h-5 w-5" /></span>
            <p>Responses</p>
            <strong>{loading ? '...' : totalResponses}</strong>
            <small>For selected vote</small>
          </article>
        </div>
      </section>

      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section id="voting-meetings" className="section-shell overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Meetings</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Vote source meeting</h2>
            </div>
            <button type="button" onClick={() => void loadData()} className="btn btn-outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {meetings.length === 0 ? (
              <div className="empty-state p-6 text-center text-(--muted)">No meetings available.</div>
            ) : (
              meetings.map((meeting) => {
                const active = selectedMeetingId === meeting.id;
                return (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={async () => {
                      setSelectedMeetingId(meeting.id);
                      setLoading(true);
                      try {
                        await loadVotes(meeting.id, voteId);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to load votes');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className={`w-full rounded-[1.15rem] border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 ${active ? 'border-emerald-300 bg-emerald-50' : 'border-[var(--ds-border)] bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[var(--ds-secondary)]">{meeting.title}</p>
                        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{new Date(meeting.dateTime).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold text-[var(--ds-text-muted)]">{meeting.status}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section id="voting-polls" className="section-shell overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--ds-text-muted)]">Votes</p>
                <h2 className="text-xl font-black text-[var(--ds-secondary)]">Active polls</h2>
              </div>
              {selectedVote && canManageVotes && selectedVote.status === 'ACTIVE' ? (
                <button type="button" onClick={() => void closeVote()} className="btn btn-outline">
                  <ShieldCheck className="h-4 w-4" />
                  Close vote
                </button>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              {votes.length === 0 ? (
                <p className="text-sm text-[var(--ds-text-muted)]">No votes for this meeting.</p>
              ) : (
                votes.map((voteItem) => {
                  const active = selectedVote?.id === voteItem.id;
                  return (
                    <button
                      key={voteItem.id}
                      type="button"
                      onClick={async () => {
                        setSelectedVote(voteItem);
                        setResults(await organizationService.getVoteResults(currentOrganization.id, voteItem.id));
                      }}
                      className={`w-full rounded-[1.15rem] border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 ${active ? 'border-emerald-300 bg-emerald-50' : 'border-[var(--ds-border)] bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-[var(--ds-secondary)]">{voteItem.title}</p>
                        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1 text-xs font-bold uppercase text-[var(--ds-text-muted)]">{voteItem.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{voteItem.description}</p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {selectedVote ? (
            <>
              <form onSubmit={castVote} className="section-shell space-y-4 overflow-hidden p-6">
                <div>
                  <p className="text-sm text-[var(--ds-text-muted)]">Vote screen</p>
                  <h2 className="text-xl font-black text-[var(--ds-secondary)]">{selectedVote.title}</h2>
                  <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{selectedVote.description}</p>
                </div>
                <label className="block">
                  <span className="text-sm font-bold text-[var(--ds-secondary)]">Option</span>
                  <select value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)} className="input mt-2 w-full">
                    <option value="">Choose option</option>
                    {selectedVote.options?.map((option) => (
                      <option key={option.id} value={option.text}>
                        {option.text}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={saving || !selectedOption} className="btn btn-primary w-full justify-center px-4 py-3 disabled:opacity-60 sm:w-auto">
                  <Vote className="h-4 w-4" />
                  Submit vote
                </button>
              </form>

              <section id="voting-results" className="section-shell overflow-hidden p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--ds-text-muted)]">Results screen</p>
                    <h2 className="text-xl font-black text-[var(--ds-secondary)]">Current results</h2>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedVote) setResults(await organizationService.getVoteResults(currentOrganization.id, selectedVote.id));
                    }}
                    className="btn btn-outline"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
                <div className="mt-5 space-y-3">
                  {(results?.results ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--ds-text-muted)]">No votes recorded yet.</p>
                  ) : (
                    results?.results.map((row) => {
                      const percentage = results.totalResponses > 0 ? Math.round((row.votes / results.totalResponses) * 100) : 0;
                      return (
                        <div key={row.option} className="dashboard-tile p-4 text-sm text-[var(--ds-text-muted)]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold text-[var(--ds-secondary)]">{row.option}</span>
                            <span>{row.votes} votes</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-[var(--ds-surface-2)]">
                            <div className="h-2 rounded-full bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-accent))]" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {results ? <p className="mt-4 text-sm text-[var(--ds-text-muted)]">Total responses: {results.totalResponses}</p> : null}
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
};

