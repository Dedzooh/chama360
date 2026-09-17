import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  LoaderCircle,
  MoreHorizontal,
  MoveRight,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  startIcon,
  endIcon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'border-transparent bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] text-white shadow-[0_12px_26px_rgba(15,132,95,0.18)] hover:shadow-[0_16px_32px_rgba(15,132,95,0.24)]',
    secondary: 'border-[var(--ds-border)] bg-[var(--ds-surface-3)] text-[var(--ds-secondary)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface)]',
    outline: 'border-[var(--ds-border-strong)] bg-transparent text-[var(--ds-secondary)] hover:bg-[var(--ds-surface-2)]',
    ghost: 'border-transparent bg-transparent text-[var(--ds-text-muted)] hover:bg-[rgba(15,132,95,0.08)] hover:text-[var(--ds-secondary)]',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'min-h-10 px-3 text-sm',
    md: 'min-h-11 px-4 text-sm',
    lg: 'min-h-12 px-5 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        `ds-button ds-button-${variant} ds-button-${size} inline-flex items-center justify-center gap-2 rounded-[var(--ds-radius-md)] border font-semibold transition duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ds-ring)] disabled:cursor-not-allowed disabled:opacity-60`,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="ds-button-icon">
          <LoaderCircle className="h-4 w-4 animate-spin" />
        </span>
      ) : startIcon ? (
        <span className="ds-button-icon">{startIcon}</span>
      ) : null}
      <span className="ds-button-label">{children}</span>
      {endIcon ? <span className="ds-button-icon ds-button-icon-end">{endIcon}</span> : null}
    </button>
  );
};

export const IconButton = ({
  label,
  icon,
  variant = 'ghost',
  className,
  ...props
}: Omit<ButtonProps, 'children' | 'startIcon' | 'endIcon'> & { label: string; icon: ReactNode; variant?: ButtonVariant }) => (
  <Button
    aria-label={label}
    title={label}
    variant={variant}
    className={cx('ds-icon-button min-h-11 min-w-11 px-3', className)}
    startIcon={icon}
    {...props}
  >
    <span className="sr-only">{label}</span>
  </Button>
);

export const Fab = ({
  label,
  open = false,
  className,
  ...props
}: Omit<ButtonProps, 'children'> & { label: string; open?: boolean }) => (
  <Button
    {...props}
    variant="primary"
      className={cx(
        'h-14 rounded-full px-4 shadow-[0_18px_40px_rgba(15,132,95,0.32)] active:scale-[0.98] animate-[float_4.8s_ease-in-out_infinite]',
        open ? 'bg-[linear-gradient(135deg,var(--ds-secondary),var(--ds-primary))]' : '',
        className,
      )}
    startIcon={open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
  >
    <span className="text-sm font-bold">{label}</span>
  </Button>
);

export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <section
    className={cx(
      'ds-card rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] shadow-[var(--ds-shadow-soft)] transition duration-150',
      className,
    )}
    {...props}
  >
    {children}
  </section>
);

export const MetricCard = ({
  title,
  value,
  caption,
  tone = 'emerald',
  icon,
  className,
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  tone?: 'emerald' | 'navy' | 'gold' | 'success' | 'warning' | 'error' | 'info';
  icon?: ReactNode;
  className?: string;
}) => {
  const tones: Record<'emerald' | 'navy' | 'gold' | 'success' | 'warning' | 'error' | 'info', string> = {
    emerald: 'from-emerald-500 to-emerald-700',
    navy: 'from-slate-700 to-slate-950',
    gold: 'from-amber-500 to-yellow-700',
    success: 'from-emerald-500 to-lime-600',
    warning: 'from-amber-400 to-orange-500',
    error: 'from-rose-500 to-red-700',
    info: 'from-sky-500 to-blue-700',
  };

  return (
    <Card
      className={cx(
        `ds-metric-card ds-metric-card-${tone} overflow-hidden p-5`,
        tone === 'emerald' ? 'bg-[linear-gradient(180deg,rgba(15,132,95,0.08),rgba(255,255,255,0.98))]' : '',
        tone === 'navy' ? 'bg-[linear-gradient(180deg,rgba(18,58,99,0.08),rgba(255,255,255,0.98))]' : '',
        tone === 'gold' ? 'bg-[linear-gradient(180deg,rgba(190,138,18,0.10),rgba(255,255,255,0.98))]' : '',
        tone === 'success' ? 'bg-[linear-gradient(180deg,rgba(22,163,74,0.08),rgba(255,255,255,0.98))]' : '',
        tone === 'warning' ? 'bg-[linear-gradient(180deg,rgba(217,119,6,0.09),rgba(255,255,255,0.98))]' : '',
        tone === 'error' ? 'bg-[linear-gradient(180deg,rgba(220,38,38,0.08),rgba(255,255,255,0.98))]' : '',
        tone === 'info' ? 'bg-[linear-gradient(180deg,rgba(37,99,235,0.08),rgba(255,255,255,0.98))]' : '',
        className,
      )}
    >
      <div className={`h-1.5 rounded-full bg-gradient-to-r ${tones[tone]}`} />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{title}</p>
          <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{value}</p>
          {caption ? <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{caption}</p> : null}
        </div>
        {icon ? <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,132,95,0.12),rgba(18,58,99,0.12))] p-3 text-[var(--ds-primary)]">{icon}</div> : null}
      </div>
    </Card>
  );
};

export const WalletCard = ({
  name,
  balance,
  detail,
  status = 'Active',
}: {
  name: string;
  balance: string;
  detail?: string;
  status?: string;
}) => (
  <Card className="ds-wallet-card wallet-card-premium overflow-hidden p-0 text-white shadow-[var(--ds-shadow-elevated)]">
    <div className="wallet-card-inner p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/76">{name}</p>
          <p className="mt-2 text-[12px] font-medium text-white/70">Current Balance</p>
          <p className="mt-1 text-[2rem] font-black leading-none sm:text-[2.25rem]">{balance}</p>
        </div>
        <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold">{status}</span>
      </div>
      {detail ? <p className="mt-3 max-w-[18rem] text-sm text-white/80">{detail}</p> : null}
      <div className="mt-5 flex items-center justify-between text-xs text-white/76">
        <span>Premium wallet</span>
        <Sparkles className="h-4 w-4" />
      </div>
    </div>
  </Card>
);

export const ChamaCard = ({
  name,
  type,
  members,
  balance,
  status,
  onClick,
}: {
  name: string;
  type: string;
  members: string;
  balance: string;
  status: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full overflow-hidden rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] text-left shadow-[var(--ds-shadow-soft)] transition duration-150 active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-card)]"
  >
    <div className="h-1.5 bg-gradient-to-r from-[var(--ds-primary)] via-[var(--ds-secondary)] to-[var(--ds-accent)]" />
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{type}</p>
          <h3 className="mt-1.5 text-[1rem] font-black text-[var(--ds-secondary)]">{name}</h3>
        </div>
        <span className="rounded-full bg-[rgba(200,155,60,0.12)] px-3 py-1 text-[11px] font-semibold text-[var(--ds-accent)]">{status}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--ds-text-muted)]">
        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{members} members</span>
        <span className="rounded-full bg-[var(--ds-surface-2)] px-3 py-1">{balance}</span>
      </div>
    </div>
  </button>
);

export const MemberCard = ({
  name,
  role,
  email,
  status,
  avatar,
}: {
  name: string;
  role: string;
  email?: string;
  status?: string;
  avatar?: string;
}) => (
  <Card className="ds-member-card p-4">
    <div className="flex items-start gap-3">
      <Avatar name={name} src={avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-base font-bold text-[var(--ds-secondary)]">{name}</h3>
          {status ? <span className="rounded-full bg-[var(--ds-surface-2)] px-2.5 py-1 text-xs font-semibold">{status}</span> : null}
        </div>
        <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{role}</p>
        {email ? <p className="mt-1 truncate text-sm text-[var(--ds-text-muted)]">{email}</p> : null}
      </div>
    </div>
  </Card>
);

export const LoanCard = ({
  title,
  amount,
  balance,
  dueDate,
  status,
}: {
  title: string;
  amount: string;
  balance: string;
  dueDate?: string;
  status: string;
}) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Loan</p>
        <h3 className="mt-2 text-lg font-bold text-[var(--ds-secondary)]">{title}</h3>
      </div>
      <span className="rounded-full border border-[var(--ds-border)] px-3 py-1 text-xs font-semibold text-[var(--ds-text-secondary)]">{status}</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
        <p className="text-xs text-[var(--ds-text-muted)]">Amount</p>
        <p className="mt-1 font-bold text-[var(--ds-text)]">{amount}</p>
      </div>
      <div className="rounded-2xl bg-[var(--ds-surface-2)] px-3 py-2">
        <p className="text-xs text-[var(--ds-text-muted)]">Balance</p>
        <p className="mt-1 font-bold text-[var(--ds-text)]">{balance}</p>
      </div>
    </div>
    {dueDate ? <p className="mt-3 text-sm text-[var(--ds-text-muted)]">Due {dueDate}</p> : null}
  </Card>
);

export const WelfareCard = ({
  title,
  amount,
  category,
  status,
}: {
  title: string;
  amount: string;
  category: string;
  status: string;
}) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{category}</p>
        <h3 className="mt-2 text-lg font-bold text-[var(--ds-secondary)]">{title}</h3>
      </div>
      <span className="rounded-full bg-[rgba(212,161,22,0.12)] px-3 py-1 text-xs font-semibold text-[var(--ds-accent)]">{status}</span>
    </div>
    <p className="mt-4 text-2xl font-black text-[var(--ds-text)]">{amount}</p>
  </Card>
);

export const StatCard = ({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  icon?: ReactNode;
}) => (
  <Card className="ds-stat-card overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,248,0.96))] p-4 transition duration-150 active:scale-[0.99]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{label}</p>
        <p className="mt-2 text-2xl font-black text-[var(--ds-secondary)]">{value}</p>
        {trend ? <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{trend}</p> : null}
      </div>
      {icon ? <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,132,95,0.10),rgba(190,138,18,0.10))] p-3 text-[var(--ds-primary)]">{icon}</div> : null}
    </div>
  </Card>
);

export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  children: ReactNode;
  className?: string;
}) => {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    neutral: 'bg-[var(--ds-surface-2)] text-[var(--ds-text-secondary)] border-[var(--ds-border)]',
    success: 'bg-[rgba(22,163,74,0.12)] text-[var(--ds-success)] border-[rgba(22,163,74,0.2)]',
    warning: 'bg-[rgba(217,119,6,0.12)] text-[var(--ds-warning)] border-[rgba(217,119,6,0.2)]',
    error: 'bg-[rgba(220,38,38,0.12)] text-[var(--ds-error)] border-[rgba(220,38,38,0.2)]',
    info: 'bg-[rgba(37,99,235,0.12)] text-[var(--ds-info)] border-[rgba(37,99,235,0.2)]',
    accent: 'bg-[rgba(212,161,22,0.12)] text-[var(--ds-accent)] border-[rgba(212,161,22,0.24)]',
  };

  return <span className={cx(`ds-badge ds-badge-${tone} inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold`, toneClasses[tone], className)}>{children}</span>;
};

export const Chip = ({
  active = false,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    {...props}
    className={cx(
      'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ds-ring)]',
      active
        ? 'border-[rgba(15,132,95,0.24)] bg-[rgba(15,132,95,0.10)] text-[var(--ds-primary-strong)]'
        : 'border-[var(--ds-border)] bg-[var(--ds-surface-3)] text-[var(--ds-text-muted)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface-2)]',
      className,
    )}
  >
    {children}
  </button>
);

export const Avatar = ({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
  };

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  }, [name]);

  return src ? (
    <img src={src} alt={name} className={cx('rounded-full object-cover', sizes[size])} />
  ) : (
    <div className={cx('flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))] font-bold text-white', sizes[size])}>
      {initials}
    </div>
  );
};

export const Progress = ({ value, label }: { value: number; label?: string }) => (
  <div className="space-y-2">
    {label ? <div className="flex items-center justify-between gap-3 text-sm text-[var(--ds-text-muted)]"><span>{label}</span><span>{Math.max(0, Math.min(100, value))}%</span></div> : null}
    <div className="h-2 overflow-hidden rounded-full bg-[var(--ds-surface-inset)]">
      <div className="h-full rounded-full bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-secondary))]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cx('animate-pulse rounded-full bg-[linear-gradient(90deg,#e7f1ed,#f6f8f7,#e7f1ed)] bg-[length:180%_100%]', className)} />
);

export const EmptyState = ({
  title,
  description,
  action,
  icon = <CircleHelp className="h-7 w-7" />,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <Card className="p-6 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-[linear-gradient(135deg,rgba(15,132,95,0.10),rgba(18,58,99,0.08))] text-[var(--ds-primary)]">
      {icon}
    </div>
    <h3 className="mt-4 text-[1.15rem] font-black text-[var(--ds-secondary)]">{title}</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--ds-text-muted)]">{description}</p>
    {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
  </Card>
);

export const Toast = ({
  title,
  description,
  tone = 'info',
}: {
  title: string;
  description?: string;
  tone?: 'success' | 'warning' | 'error' | 'info';
}) => {
  const iconMap = {
    success: <CircleCheck className="h-5 w-5" />,
    warning: <CircleAlert className="h-5 w-5" />,
    error: <BadgeCheck className="h-5 w-5" />,
    info: <Bell className="h-5 w-5" />,
  };

  const toneClasses: Record<'success' | 'warning' | 'error' | 'info', string> = {
    success: 'border-[rgba(22,163,74,0.2)] bg-[rgba(240,253,244,0.96)] text-[var(--ds-success)]',
    warning: 'border-[rgba(217,119,6,0.2)] bg-[rgba(255,251,235,0.96)] text-[var(--ds-warning)]',
    error: 'border-[rgba(220,38,38,0.2)] bg-[rgba(254,242,242,0.96)] text-[var(--ds-error)]',
    info: 'border-[rgba(37,99,235,0.2)] bg-[rgba(239,246,255,0.96)] text-[var(--ds-info)]',
  };

  return (
    <div className={cx('flex items-start gap-3 rounded-[var(--ds-radius-lg)] border p-4 shadow-[var(--ds-shadow-card)]', toneClasses[tone])}>
      <div className="mt-0.5">{iconMap[tone]}</div>
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
      </div>
    </div>
  );
};

export const Dialog = ({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const focusTarget = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      focusTarget?.focus();
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ds-overlay)] p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close dialog" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="relative z-10 w-full max-w-lg rounded-[var(--ds-radius-2xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] p-5 shadow-[var(--ds-shadow-floating)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id={titleId} className="text-xl font-black text-[var(--ds-secondary)]">{title}</h3>
            {description ? <p id={descriptionId} className="mt-1 text-sm text-[var(--ds-text-muted)]">{description}</p> : null}
          </div>
          <IconButton label="Close dialog" icon={<X className="h-4 w-4" />} onClick={onClose} />
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Dialog open={open} title={title} description={description} onClose={busy ? () => undefined : onClose}>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button
        loading={busy}
        disabled={busy}
        className={destructive ? 'ds-button-danger' : undefined}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  </Dialog>
);

export const BottomSheet = ({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" className="absolute inset-0 bg-[var(--ds-overlay)]" aria-label="Close sheet" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] border-t border-[var(--ds-border)] bg-[rgba(255,255,255,0.96)] p-4 shadow-[var(--ds-shadow-floating)] animate-[sheet-up_220ms_ease-out]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--ds-surface-inset)]" />
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[var(--ds-secondary)]">{title}</h3>
          <IconButton label="Close sheet" icon={<X className="h-4 w-4" />} onClick={onClose} />
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

export const Stepper = ({
  steps,
  currentStep,
}: {
  steps: Array<{ key: string; label: string }>;
  currentStep: string;
}) => (
  <ol className="flex flex-wrap items-center gap-3">
    {steps.map((step, index) => {
      const active = step.key === currentStep;
      const done = steps.findIndex((item) => item.key === currentStep) > index;
      return (
        <li key={step.key} className="flex items-center gap-3">
          <span
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold',
              active
                ? 'border-[var(--ds-primary)] bg-[rgba(15,132,95,0.12)] text-[var(--ds-primary-strong)]'
                : done
                  ? 'border-[var(--ds-success)] bg-[rgba(22,163,74,0.12)] text-[var(--ds-success)]'
                  : 'border-[var(--ds-border)] bg-[var(--ds-surface-3)] text-[var(--ds-text-muted)]',
            )}
          >
            {done ? <CircleCheck className="h-4 w-4" /> : index + 1}
          </span>
          <span className={cx('text-sm font-semibold', active ? 'text-[var(--ds-secondary)]' : 'text-[var(--ds-text-muted)]')}>{step.label}</span>
          {index < steps.length - 1 ? <ChevronRight className="h-4 w-4 text-[var(--ds-text-muted)]" /> : null}
        </li>
      );
    })}
  </ol>
);

export const Timeline = ({
  items,
}: {
  items: Array<{ title: string; description?: string; time?: string; tone?: 'success' | 'warning' | 'error' | 'info' }>;
}) => (
  <div className="space-y-4">
    {items.map((item) => (
      <div key={`${item.title}-${item.time ?? ''}`} className="flex gap-3">
        <div className="relative mt-1 flex w-5 justify-center">
          <span className="h-3 w-3 rounded-full bg-[var(--ds-primary)]" />
          <span className="absolute top-3 bottom-[-1rem] w-px bg-[var(--ds-border)]" />
        </div>
        <div className="flex-1 pb-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-[var(--ds-secondary)]">{item.title}</p>
            {item.time ? <span className="text-xs text-[var(--ds-text-muted)]">{item.time}</span> : null}
          </div>
          {item.description ? <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{item.description}</p> : null}
        </div>
      </div>
    ))}
  </div>
);

export const Breadcrumbs = ({
  items,
}: {
  items: Array<{ label: string; to?: string }>;
}) => (
  <nav aria-label="Breadcrumb">
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <ChevronRight className="h-4 w-4 text-[var(--ds-text-muted)]" /> : null}
          {item.to ? (
            <Link to={item.to} className="font-semibold text-[var(--ds-text-muted)] transition hover:text-[var(--ds-secondary)]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[var(--ds-secondary)]">{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export const Tabs = ({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) => (
  <div className="inline-flex rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-1">
    {items.map((item) => {
      const active = item.value === value;
      return (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cx(
            'min-h-11 rounded-full px-4 text-sm font-semibold transition',
            active
              ? 'bg-[var(--ds-surface-3)] text-[var(--ds-secondary)] shadow-[var(--ds-shadow-soft)]'
              : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-secondary)]',
          )}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <label className="flex min-h-11 items-center gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 shadow-[var(--ds-shadow-soft)]">
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--ds-text-muted)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--ds-text-muted)]"
    />
  </label>
);

export const TextField = ({ label, error, helperText, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string }) => (
  <label className="ds-field block">
    {label ? <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">{label}</span> : null}
    <input
      className={cx(
        'ds-input h-11 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 text-sm text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-muted)] focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]',
        error ? 'border-[var(--ds-error)] focus:border-[var(--ds-error)] focus:ring-[rgba(220,38,38,0.16)]' : '',
        className,
      )}
      {...props}
    />
    {error ? <p className="mt-2 text-sm text-[var(--ds-error)]">{error}</p> : helperText ? <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{helperText}</p> : null}
  </label>
);

export const SelectField = ({
  label,
  children,
  error,
  helperText,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; helperText?: string; children: ReactNode }) => (
  <label className="ds-field block">
    {label ? <span className="mb-2 block text-sm font-semibold text-[var(--ds-secondary)]">{label}</span> : null}
    <select
      className={cx(
        'ds-select h-11 w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] px-4 text-sm text-[var(--ds-text)] outline-none transition focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]',
        error ? 'border-[var(--ds-error)] focus:border-[var(--ds-error)] focus:ring-[rgba(220,38,38,0.16)]' : '',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    {error ? <p className="mt-2 text-sm text-[var(--ds-error)]">{error}</p> : helperText ? <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{helperText}</p> : null}
  </label>
);

export const DateField = (props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string }) => <TextField {...props} type="date" />;

export const NumberField = (props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string }) => <TextField {...props} inputMode="decimal" />;

export const OtpInput = ({
  length = 6,
  value,
  onChange,
  className,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => Array.from({ length }, (_, index) => value[index] ?? ''), [length, value]);

  const updateValue = (nextDigits: string[]) => onChange(nextDigits.join('').slice(0, length));

  return (
    <div className={cx('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`OTP digit ${index + 1}`}
          className="h-12 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-surface-3)] text-center text-lg font-bold text-[var(--ds-text)] outline-none transition focus:border-[var(--ds-primary)] focus:ring-4 focus:ring-[var(--ds-ring)]"
          onChange={(event) => {
            const nextDigits = [...digits];
            nextDigits[index] = event.target.value.replace(/\D/g, '').slice(-1);
            updateValue(nextDigits);
            if (nextDigits[index] && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
};

export const TopAppBar = ({
  title,
  subtitle,
  leading,
  actions,
  onBack,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
}) => (
  <header className="sticky top-0 z-30 border-b border-[var(--ds-border)] bg-[rgba(255,255,255,0.94)] backdrop-blur-md">
    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onBack ? (
          <IconButton label="Go back" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack} />
        ) : null}
        {leading}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{subtitle}</p>
          <h1 className="truncate text-xl font-black text-[var(--ds-secondary)]">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  </header>
);

export const BottomNavigation = ({
  items,
  activeValue,
  onItemSelect,
}: {
  items: Array<{ value: string; label: string; icon: ReactNode; to?: string }>;
  activeValue: string;
  onItemSelect?: (value: string) => void;
}) => (
  <nav className="rounded-t-[1.5rem] border border-b-0 border-[var(--ds-border)] bg-[rgba(255,255,255,0.96)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(16,38,31,0.08)]">
    <div className="grid grid-cols-5 gap-1">
      {items.map((item) => {
        const active = item.value === activeValue;
        const content = (
          <>
            <span className={cx('text-[1.35rem]', active ? 'text-[var(--ds-primary)]' : 'text-[var(--ds-text-muted)]')}>{item.icon}</span>
            <span className={cx('text-[10px] font-semibold leading-none', active ? 'text-[var(--ds-primary-strong)]' : 'text-[var(--ds-text-muted)]')}>
              {item.label}
            </span>
          </>
        );

        const className = cx(
          'flex min-h-[3.45rem] flex-col items-center justify-center gap-0.5 rounded-[var(--ds-radius-lg)] px-1 transition',
          active ? 'bg-[rgba(15,132,95,0.08)]' : '',
        );

        return item.to ? (
          <Link key={item.value} to={item.to} className={className}>
            {content}
          </Link>
        ) : (
          <button key={item.value} type="button" onClick={() => onItemSelect?.(item.value)} className={className}>
            {content}
          </button>
        );
      })}
    </div>
  </nav>
);

export const Drawer = ({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-[var(--ds-overlay)]" aria-label="Close drawer" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-[var(--ds-border)] bg-[var(--ds-surface-3)] shadow-[var(--ds-shadow-floating)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Menu</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">{title}</h2>
          </div>
          <IconButton label="Close drawer" icon={<X className="h-4 w-4" />} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
};

export const SparklineChart = ({
  data,
  accent = 'var(--ds-primary)',
  className,
}: {
  data: number[];
  accent?: string;
  className?: string;
}) => {
  const points = useMemo(() => {
    if (data.length === 0) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data
      .map((value, index) => {
        const x = (index / Math.max(1, data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data]);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cx('h-20 w-full', className)} aria-hidden="true">
      <defs>
        <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,100 ${points} 100,100`} fill="url(#sparkline-fill)" stroke="none" />
      <polyline points={points} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-[var(--ds-text-muted)]">{subtitle}</p>
        <h3 className="mt-1 text-lg font-black text-[var(--ds-secondary)]">{title}</h3>
      </div>
      <ShieldCheck className="h-5 w-5 text-[var(--ds-primary)]" />
    </div>
    <div className="mt-4">{children}</div>
  </Card>
);

export const QuickAction = ({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="ds-quick-action flex w-full items-center gap-3 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,244,0.96))] p-4 text-left shadow-[var(--ds-shadow-soft)] transition duration-150 active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-card)]"
  >
    <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,132,95,0.10),rgba(18,58,99,0.10))] p-3 text-[var(--ds-primary)]">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="font-bold text-[var(--ds-secondary)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{description}</p>
    </div>
    <MoveRight className="h-4 w-4 text-[var(--ds-text-muted)]" />
  </button>
);

export const UtilityIcon = {
  MoreHorizontal,
  Plus,
  BadgeCheck,
  Bell,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ShieldCheck,
  Sparkles,
};
