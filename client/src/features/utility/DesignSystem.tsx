import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  Heart,
  Home,
  LayoutGrid,
  List,
  Menu,
  MessageSquare,
  Plus,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Breadcrumbs,
  BottomNavigation,
  Button,
  Card,
  ChartCard,
  Chip,
  ChamaCard,
  Dialog,
  Drawer,
  EmptyState,
  Fab,
  IconButton,
  LoanCard,
  MemberCard,
  MetricCard,
  OtpInput,
  Progress,
  QuickAction,
  SearchBar,
  SelectField,
  Skeleton,
  SparklineChart,
  StatCard,
  Stepper,
  Tabs,
  TextField,
  Timeline,
  Toast,
  TopAppBar,
  WalletCard,
  WelfareCard,
  designTokens,
} from '../../design-system';

const paletteRows = [
  { name: 'Emerald', scale: designTokens.colors.emerald },
  { name: 'Navy', scale: designTokens.colors.navy },
  { name: 'Gold', scale: designTokens.colors.gold },
  { name: 'Success', scale: designTokens.colors.success },
  { name: 'Warning', scale: designTokens.colors.warning },
  { name: 'Error', scale: designTokens.colors.error },
  { name: 'Info', scale: designTokens.colors.info },
  { name: 'Neutral', scale: designTokens.colors.neutral },
] as const;

const swatchKeys = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

export const DesignSystem = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabs, setTabs] = useState('components');
  const [search, setSearch] = useState('');
  const [otp, setOtp] = useState('482901');

  const sparkline = useMemo(() => [3, 8, 6, 12, 10, 16, 14, 22, 19, 26], []);

  return (
    <div className="space-y-6 pb-10">
      <TopAppBar
        subtitle="Design system"
        title="CHAMA360"
        onBack={() => window.history.back()}
        actions={
          <>
            <IconButton label="Open drawer" icon={<Menu className="h-4 w-4" />} onClick={() => setDrawerOpen(true)} />
            <IconButton label="Settings" icon={<Settings2 className="h-4 w-4" />} />
          </>
        }
      />

      <section className="hero-card overflow-hidden p-6 sm:p-8">
        <div className="hero-gradient rounded-[1.35rem] p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Premium fintech foundation</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">A reusable system for every CHAMA360 screen</h1>
          <p className="mt-3 max-w-3xl text-white/85">
            Tokens, Tailwind mapping, CSS variables, and shared UI primitives aligned to the same visual language.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" startIcon={<Plus className="h-4 w-4" />} onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
            <Button variant="outline" startIcon={<ArrowRight className="h-4 w-4" />}>
              Review components
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Primary" value="Emerald" caption="Trust and action color" tone="emerald" icon={<BarChart3 className="h-5 w-5" />} />
        <MetricCard title="Secondary" value="Navy" caption="Depth and structure" tone="navy" icon={<CreditCard className="h-5 w-5" />} />
        <MetricCard title="Accent" value="Gold" caption="Highlights and rewards" tone="gold" icon={<Wallet className="h-5 w-5" />} />
        <MetricCard title="Touch Target" value={`${designTokens.touchTarget}px`} caption="Mobile accessibility baseline" tone="info" icon={<Users className="h-5 w-5" />} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ds-text-muted)]">Color palette</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Brand and semantic scales</h2>
          </div>
        </div>
        <div className="grid gap-3">
          {paletteRows.map((row) => (
            <Card key={row.name} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-28 text-sm font-bold text-[var(--ds-secondary)]">{row.name}</div>
                <div className="grid flex-1 grid-cols-5 gap-2 sm:grid-cols-11">
                  {swatchKeys.map((key) => (
                    <div key={key} className="space-y-1">
                      <div className="h-10 rounded-xl border border-black/5" style={{ backgroundColor: row.scale[Number(key) as keyof typeof row.scale] }} />
                      <div className="text-[10px] text-[var(--ds-text-muted)]">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Typography</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Display through caption</h2>
            </div>
            <Badge tone="accent">Plus Jakarta Sans</Badge>
          </div>
          <div className="mt-5 space-y-3">
            <p className="text-4xl font-black text-[var(--ds-secondary)]">Display</p>
            <p className="text-3xl font-black text-[var(--ds-secondary)]">Heading 1</p>
            <p className="text-2xl font-bold text-[var(--ds-secondary)]">Heading 2</p>
            <p className="text-xl font-bold text-[var(--ds-secondary)]">Heading 3</p>
            <p className="text-lg font-semibold text-[var(--ds-secondary)]">Body Large</p>
            <p className="text-sm text-[var(--ds-text-muted)]">Caption and labels use tighter spacing and quieter tones.</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--ds-text-muted)]">Motion and feedback</p>
              <h2 className="text-xl font-black text-[var(--ds-secondary)]">Charts, progress, skeletons</h2>
            </div>
            <Badge tone="success">Accessible</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <Progress value={72} label="Contribution cycle" />
            <ChartCard title="Savings growth" subtitle="Last 10 periods">
              <SparklineChart data={sparkline} />
            </ChartCard>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ds-text-muted)]">Buttons and chips</p>
            <h2 className="text-xl font-black text-[var(--ds-secondary)]">Interaction primitives</h2>
          </div>
          <Tabs
            value={tabs}
            onChange={setTabs}
            items={[
              { value: 'components', label: 'Components' },
              { value: 'forms', label: 'Forms' },
              { value: 'navigation', label: 'Navigation' },
            ]}
          />
        </div>
        <Card className="p-5">
          <div className="flex flex-wrap gap-3">
            <Button startIcon={<Plus className="h-4 w-4" />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Loading</Button>
            <IconButton label="Favorites" icon={<Heart className="h-4 w-4" />} />
            <Fab label="Create" />
            <Chip active>Active</Chip>
            <Chip>Archived</Chip>
            <Badge tone="success">Approved</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="error">Rejected</Badge>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Forms</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Inputs and OTP</h2>
          <div className="mt-5 grid gap-4">
            <TextField label="Search member" placeholder="Type a name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            <SearchBar value={search} onChange={setSearch} placeholder="Search chamas" />
            <SelectField label="Chama type" defaultValue="investment">
              <option value="investment">Investment</option>
              <option value="welfare">Welfare</option>
              <option value="savings">Savings</option>
            </SelectField>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Cards</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">System card patterns</h2>
          <div className="mt-5 grid gap-3">
            <WalletCard name="Portfolio wallet" balance="KES 245,300" detail="Across all active chamas" />
            <ChamaCard name="Vision Investors" type="Investment Chama" members="48 Members" balance="KES 1,450,000" status="Active" />
            <div className="grid gap-3 md:grid-cols-2">
              <MemberCard name="Kimdee Dan" role="Treasurer" email="kimdedan95@gmail.com" status="Active" />
              <LoanCard title="Business expansion" amount="KES 120,000" balance="KES 84,000" dueDate="10 Aug 2026" status="Current" />
            </div>
            <WelfareCard title="Medical support" category="Welfare" amount="KES 38,400" status="Open" />
            <StatCard label="Member growth" value="+8 this month" trend="More activity than last month" icon={<Users className="h-5 w-5" />} />
          </div>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Navigation</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Top bar, drawer, breadcrumbs, bottom nav</h2>
          <div className="mt-5 space-y-4">
            <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'My Chamas', to: '/my-chamas' }, { label: 'Design System' }]} />
            <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-3">
              <BottomNavigation
                activeValue="home"
                items={[
                  { value: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
                  { value: 'members', label: 'Members', icon: <Users className="h-5 w-5" /> },
                  { value: 'finance', label: 'Finance', icon: <Wallet className="h-5 w-5" /> },
                  { value: 'welfare', label: 'Welfare', icon: <Heart className="h-5 w-5" /> },
                  { value: 'more', label: 'More', icon: <Menu className="h-5 w-5" /> },
                ]}
              />
            </div>
            <Stepper
              currentStep="review"
              steps={[
                { key: 'type', label: 'Type' },
                { key: 'modules', label: 'Modules' },
                { key: 'committee', label: 'Committee' },
                { key: 'review', label: 'Review' },
              ]}
            />
            <Timeline
              items={[
                { title: 'Created chama', description: 'Investment group launched', time: 'Now' },
                { title: 'Committee approved', description: 'Role assignments locked', time: '5 min ago' },
                { title: 'Members invited', description: '10 invites sent', time: '10 min ago' },
              ]}
            />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Feedback</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Toasts, empty states, drawers</h2>
          <div className="mt-5 grid gap-3">
            <Toast tone="success" title="Payment confirmed" description="Receipt stored and wallet updated." />
            <Toast tone="warning" title="Contribution due" description="Members will receive reminders tonight." />
            <EmptyState
              title="No records yet"
              description="Use this state when a section has no transactions, members, or meetings."
              action={<Button startIcon={<Plus className="h-4 w-4" />}>Create record</Button>}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Reusable actions</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Quick actions and charts</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <QuickAction label="Create Chama" description="Start a new group" icon={<Plus className="h-5 w-5" />} />
            <QuickAction label="Join Chama" description="Open an invitation" icon={<ArrowRight className="h-5 w-5" />} />
            <QuickAction label="Schedule meeting" description="Plan the next session" icon={<CalendarDays className="h-5 w-5" />} />
            <QuickAction label="Open reports" description="Review statements" icon={<MessageSquare className="h-5 w-5" />} />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-[var(--ds-text-muted)]">Surface states</p>
          <h2 className="text-xl font-black text-[var(--ds-secondary)]">Dark-mode ready tokens</h2>
          <div className="mt-5 rounded-[var(--ds-radius-xl)] border border-[var(--ds-border)] bg-[var(--ds-surface-2)] p-5">
            <p className="text-sm text-[var(--ds-text-muted)]">
              The token set maps directly to CSS variables and can be inverted for dark themes without redesigning component behavior.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--ds-surface-3)] p-4 shadow-[var(--ds-shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Background</p>
                <p className="mt-1 font-bold text-[var(--ds-secondary)]">Page / subtle / raised</p>
              </div>
              <div className="rounded-2xl bg-[var(--ds-surface-3)] p-4 shadow-[var(--ds-shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">Accessibility</p>
                <p className="mt-1 font-bold text-[var(--ds-secondary)]">44px touch target baseline</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Drawer open={drawerOpen} title="Design system" onClose={() => setDrawerOpen(false)}>
        <div className="space-y-3">
          <Button className="w-full justify-start" startIcon={<LayoutGrid className="h-4 w-4" />}>Overview</Button>
          <Button className="w-full justify-start" variant="secondary" startIcon={<List className="h-4 w-4" />}>Components</Button>
          <Button className="w-full justify-start" variant="outline" startIcon={<Settings2 className="h-4 w-4" />}>Theme</Button>
        </div>
      </Drawer>

      <Dialog open={dialogOpen} title="Design system dialog" description="Use this pattern for confirmations, forms, and inspections." onClose={() => setDialogOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--ds-text-muted)]">
            This dialog and its overlay are reusable across onboarding, settings, approvals, and finance actions.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

