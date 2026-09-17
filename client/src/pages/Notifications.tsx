import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, Mail, MessageSquare, RefreshCw, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { userService } from '../services/userService';

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  acknowledgedAt?: string | null;
  organizationId?: string | null;
};

type NotificationPreferences = {
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  priorityOverride: boolean;
};

const defaultPreferences: NotificationPreferences = {
  smsEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  priorityOverride: false,
};

export const Notifications = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [notificationResponse, preferenceResponse] = await Promise.all([
        userService.getNotifications({ limit: 50 }),
        userService.getNotificationPreferences(),
      ]);

      setNotifications(notificationResponse.notifications ?? []);
      setPreferences({
        smsEnabled: preferenceResponse.preferences.smsEnabled,
        emailEnabled: preferenceResponse.preferences.emailEnabled,
        pushEnabled: preferenceResponse.preferences.pushEnabled,
        inAppEnabled: preferenceResponse.preferences.inAppEnabled,
        quietHoursStart: preferenceResponse.preferences.quietHoursStart ?? '22:00',
        quietHoursEnd: preferenceResponse.preferences.quietHoursEnd ?? '06:00',
        priorityOverride: preferenceResponse.preferences.priorityOverride,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.acknowledgedAt).length, [notifications]);
  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((notification) => !notification.acknowledgedAt) : notifications),
    [filter, notifications]
  );

  const savePreferences = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await userService.updateNotificationPreferences({
        ...preferences,
        quietHoursStart: preferences.quietHoursStart ?? undefined,
        quietHoursEnd: preferences.quietHoursEnd ?? undefined,
      });
      setMessage('Notification preferences saved.');
      window.setTimeout(() => setMessage(''), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async (notificationId: string) => {
    try {
      await userService.acknowledgeNotification(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, acknowledgedAt: new Date().toISOString() } : notification
        )
      );
      window.dispatchEvent(new Event('chama360:notifications-changed'));
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : 'Failed to acknowledge notification');
    }
  };

  const notificationAction = (notification: NotificationRecord) => {
    if (!notification.organizationId) return null;
    if (notification.type === 'CONTRIBUTION_DUE' || /contribution|advance payment/i.test(`${notification.title} ${notification.message}`)) {
      return { label: 'Open contribution', to: ROUTES.chama.contributions(notification.organizationId) };
    }
    if (notification.type === 'MEETING_REMINDER') return { label: 'Open meetings', to: ROUTES.chama.meetings(notification.organizationId) };
    if (notification.type === 'VOTE_STARTED') return { label: 'Open voting', to: ROUTES.chama.voting(notification.organizationId) };
    return { label: 'Open Chama', to: ROUTES.chama.dashboard(notification.organizationId) };
  };

  return (
    <div className="space-y-6">
      <section className="chama360-module-hero chama360-module-hero-notifications">
        <div className="chama360-module-hero-main">
          <div className="chama360-module-hero-topline">
            <span>Notifications</span>
            <strong>{unreadCount} unread</strong>
          </div>
          <div className="chama360-module-hero-copy">
            <p>Inbox</p>
            <h1>Inbox and delivery settings</h1>
            <small>Review account alerts and control how future messages are delivered.</small>
          </div>
          <div className="chama360-module-hero-actions">
            <a href="#notification-preferences">
              <Save className="h-4 w-4" />
              Preferences
            </a>
            <button type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
        <div className="chama360-module-hero-stats">
          <article>
            <span className="green"><BellRing className="h-5 w-5" /></span>
            <p>In-app</p>
            <strong>{unreadCount}</strong>
            <small>Unread alerts</small>
          </article>
          <article>
            <span className="blue"><Mail className="h-5 w-5" /></span>
            <p>Email</p>
            <strong>{preferences.emailEnabled ? 'On' : 'Off'}</strong>
            <small>Delivery channel</small>
          </article>
          <article>
            <span className="gold"><MessageSquare className="h-5 w-5" /></span>
            <p>SMS</p>
            <strong>{preferences.smsEnabled ? 'On' : 'Off'}</strong>
            <small>Urgent updates</small>
          </article>
        </div>
      </section>

      {message ? <div className="success-banner px-4 py-3 text-sm">{message}</div> : null}
      {error ? <div className="error-banner px-4 py-3 text-sm">{error}</div> : null}

      <section id="notification-preferences" className="section-shell overflow-hidden">
        <div className="section-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">Inbox</p>
            <h2 className="text-xl font-semibold">Notification history</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilter('all')} className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}>All</button>
            <button type="button" onClick={() => setFilter('unread')} className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-outline'}`}>Unread</button>
            <button type="button" onClick={() => void loadData()} className="btn btn-outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
        <div className="section-body space-y-3">
          {loading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="empty-state p-8 text-center text-(--muted)">No notifications to show.</div>
          ) : (
            visibleNotifications.map((notification) => {
              const action = notificationAction(notification);
              return <div key={notification.id} className="dashboard-tile p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-(--secondary)">{notification.title}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{notification.type}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{notification.priority}</span>
                    </div>
                    <p className="mt-2 text-sm text-(--muted)">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {action ? <Link to={action.to} className="btn btn-primary">{action.label}<ArrowRight className="h-4 w-4" /></Link> : null}
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${notification.acknowledgedAt ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {notification.acknowledgedAt ? 'Acknowledged' : 'Unread'}
                    </span>
                    {!notification.acknowledgedAt ? (
                      <button type="button" onClick={() => void acknowledge(notification.id)} className="btn btn-outline">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            })
          )}
        </div>
      </section>

      <section className="section-shell overflow-hidden">
        <div className="section-header">
          <p className="text-sm text-slate-500">Preferences</p>
          <h2 className="text-xl font-semibold">Delivery controls</h2>
        </div>
        <div className="section-body grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-(--secondary)">In-app notifications</p>
                <p className="text-sm text-(--muted)">Show reminders inside the application.</p>
              </div>
              <input type="checkbox" checked={preferences.inAppEnabled} onChange={(event) => setPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-(--secondary)">Email notifications</p>
                <p className="text-sm text-(--muted)">Send messages to your email address.</p>
              </div>
              <input type="checkbox" checked={preferences.emailEnabled} onChange={(event) => setPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-(--secondary)">SMS notifications</p>
                <p className="text-sm text-(--muted)">Use SMS for urgent updates.</p>
              </div>
              <input type="checkbox" checked={preferences.smsEnabled} onChange={(event) => setPreferences((current) => ({ ...current, smsEnabled: event.target.checked }))} />
            </label>
          </div>

          <div className="dashboard-tile p-5">
            <p className="text-sm text-(--muted)">Quiet hours</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Start</span>
                <input type="time" value={preferences.quietHoursStart ?? '22:00'} onChange={(event) => setPreferences((current) => ({ ...current, quietHoursStart: event.target.value }))} className="mt-1 w-full input" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">End</span>
                <input type="time" value={preferences.quietHoursEnd ?? '06:00'} onChange={(event) => setPreferences((current) => ({ ...current, quietHoursEnd: event.target.value }))} className="mt-1 w-full input" />
              </label>
            </div>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-(--secondary)">Priority override</p>
                <p className="text-sm text-(--muted)">Let critical notifications bypass quiet hours.</p>
              </div>
              <input type="checkbox" checked={preferences.priorityOverride} onChange={(event) => setPreferences((current) => ({ ...current, priorityOverride: event.target.checked }))} />
            </label>
            <button type="button" onClick={() => void savePreferences()} disabled={saving} className="btn btn-primary mt-5 w-full justify-center disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
