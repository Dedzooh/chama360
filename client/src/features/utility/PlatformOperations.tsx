import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { ROUTES } from '../../config/routes';

type Task = { taskName: string; status: string; lastStartedAt: string | null; lastCompletedAt: string | null; lastError: string | null; consecutiveFailures: number };
type Job = { id: string; type: string; error: string | null; retryCount: number; maxRetries: number; startedAt: string | null; completedAt: string | null; updatedAt: string };
type Callback = { id: string; checkoutRequestId: string; status: string; attempts: number; lastError: string | null; nextAttemptAt: string; receivedAt: string; processedAt: string | null; updatedAt: string };
type Operations = { timestamp: string; summary: { failedJobsLast24Hours: number; callbacksWithErrors: number; staleCallbacks: number }; scheduledTasks: Task[]; failedJobs: Job[]; callbacks: Callback[] };

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded';

export const PlatformOperations = () => {
  const [data, setData] = useState<Operations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Operations>('/platform/subscriptions/operations');
      setData(response.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error?.message || 'Could not load operations status.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><ShieldCheck className="h-4 w-4" />Platform operations</p><h1 className="mt-2 text-3xl font-black">Background jobs & payment callbacks</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">See the latest scheduled task outcomes, failed jobs, and M-Pesa callbacks that need attention.</p></div>
        <div className="flex gap-2"><Link className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold" to={ROUTES.platform.subscriptions}>Subscriptions</Link><button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900" onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
      </div>
      <p className="mt-5 text-xs text-slate-400">Updated {data ? dateTime(data.timestamp) : '—'}</p>
    </header>
    {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        ['Failed jobs · 24 hours', data?.summary.failedJobsLast24Hours ?? 0, AlertTriangle],
        ['Callbacks with errors', data?.summary.callbacksWithErrors ?? 0, XCircle],
        ['Callbacks waiting over 5 min', data?.summary.staleCallbacks ?? 0, Clock3],
      ].map(([label, value, Icon]: any) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-amber-600" /><p className="mt-3 text-sm font-semibold text-slate-600">{label}</p><strong className="mt-1 block text-3xl font-black text-slate-900">{loading ? '…' : value}</strong></article>)}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5"><p className="text-sm text-slate-500">Recurring scheduler</p><h2 className="text-xl font-black text-slate-900">Scheduled task health</h2></div>
      <div className="divide-y divide-slate-100">{data?.scheduledTasks.map((task) => <article className="flex flex-wrap items-start justify-between gap-3 p-5" key={task.taskName}><div className="flex items-start gap-3"><span className={`mt-0.5 ${task.status === 'HEALTHY' ? 'text-emerald-600' : task.status === 'FAILED' ? 'text-red-600' : 'text-amber-600'}`}>{task.status === 'HEALTHY' ? <CheckCircle2 /> : task.status === 'FAILED' ? <XCircle /> : <Activity />}</span><div><h3 className="font-bold text-slate-900">{task.taskName.replaceAll('-', ' ')}</h3><p className="mt-1 text-sm text-slate-500">Last run: {dateTime(task.lastCompletedAt)}{task.consecutiveFailures ? ` · ${task.consecutiveFailures} consecutive failure${task.consecutiveFailures === 1 ? '' : 's'}` : ''}</p>{task.lastError ? <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{task.lastError}</p> : null}</div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${task.status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-700' : task.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{task.status}</span></article>)}{!loading && !data?.scheduledTasks.length ? <p className="p-6 text-sm text-slate-500">No scheduled task runs have been recorded yet.</p> : null}</div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5"><p className="text-sm text-slate-500">Background queue</p><h2 className="text-xl font-black text-slate-900">Recent failed jobs</h2></div>
      <div className="divide-y divide-slate-100">{data?.failedJobs.map((job) => <article className="p-5" key={job.id}><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{job.type.replaceAll('_', ' ')}</strong><span className="text-xs text-slate-500">{dateTime(job.completedAt ?? job.updatedAt)}</span></div><p className="mt-1 text-sm text-slate-600">Attempts: {job.retryCount} of {job.maxRetries}</p><p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{job.error || 'No error details recorded.'}</p></article>)}{!loading && !data?.failedJobs.length ? <p className="p-6 text-sm text-slate-500">No failed background jobs are recorded.</p> : null}</div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5"><p className="text-sm text-slate-500">M-Pesa inbox</p><h2 className="text-xl font-black text-slate-900">Callbacks still processing</h2><p className="mt-1 text-sm text-slate-500">Use the checkout request reference to trace the callback in the payment provider and transaction records.</p></div>
      <div className="divide-y divide-slate-100">{data?.callbacks.map((callback) => <article className="p-5" key={callback.id}><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{callback.checkoutRequestId}</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{callback.status} · {callback.attempts} attempt{callback.attempts === 1 ? '' : 's'}</span></div><p className="mt-2 text-sm text-slate-500">Received {dateTime(callback.receivedAt)} · Next attempt {dateTime(callback.nextAttemptAt)}</p>{callback.lastError ? <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{callback.lastError}</p> : <p className="mt-2 text-sm text-slate-600">No error saved; this callback is overdue for processing.</p>}</article>)}{!loading && !data?.callbacks.length ? <p className="p-6 text-sm text-slate-500">No callbacks need attention. Recent payments are up to date.</p> : null}</div>
    </section>
  </main>;
};
