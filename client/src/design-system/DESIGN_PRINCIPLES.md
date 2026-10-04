# Chama360 Design Principles

Modern African Fintech + Community Finance.

The interface combines the trust and clarity of modern banking applications
with the warmth and accessibility of a community platform: sophisticated
green/teal palette, generous whitespace, soft rounded surfaces, restrained
shadows, clear financial typography, semantic status colors, accessible touch
targets, role-specific dashboards, responsive desktop tables and mobile cards.
Premium but approachable, never intimidating.

**Foundation rule: Simple for members. Powerful for officials. Transparent
for everyone.**

## 1. Palette

| Token | Role |
|---|---|
| Deep Chama Green (`--ds-primary`) | Brand, primary actions. Communicates money + growth + trust + community. Do NOT make every component green. |
| Emerald / Teal (`--ds-secondary`) | Supporting identity, links, secondary emphasis. |
| Soft mint / off-white / warm cream | Backgrounds and surfaces. |
| Navy/charcoal | Text. |
| Gold (`--ds-accent`) | Accents, attention states. |

## 2. Color is semantic

- Green: paid, approved, active, completed, healthy balance
- Gold/amber: pending, due soon, awaiting approval, partial
- Red: overdue, rejected, failed, suspended, reversed
- Blue: information, reports, statements, reconciliation
- Purple: special workflows (loans, investments)

Users learn this visual language once.

## 3. Hierarchy of information

- Money figures: large and bold
- Status: medium/bold pills
- Descriptions and metadata: regular weight, smaller
- Never give equal visual weight to everything
- KPI cards on desktop: Balance / Paid / Due / Members in a compact 4-up row;
  large single-stat cards are for mobile hero moments only

## 4. Layout

- Mobile-first, thumb-friendly. Touch targets >= 44-48px.
- Bottom navigation on mobile; contextual floating Add per module (payments
  offer paste-M-Pesa / statement / cash; loans offer new loan / repayment).
- Desktop is a proper application shell: left sidebar (Dashboard, module
  navigation for the active chama, other chamas, Settings, profile) - never a
  stretched mobile layout.
- Desktop favors tables (Member / Period / Amount / Method / Status / Action);
  mobile favors cards.
- Rounded corners: cards 20px, buttons and inputs 14-16px, pills full-round.
- Shadows: very soft, low opacity, floating feel - never 3D.
- Backgrounds: near-white (#F7FAF9 style), cards pure white.
- Hero (gradient green) treatments only on major section headers, not every
  screen.

## 5. Role-based UI

Same application, different experience:

- Member: simple. My balance, my contribution status, my loan, my welfare.
- Treasurer: financial. Collections, outstanding, unmatched payments,
  approvals queue.
- Secretary: administrative. Members, meetings, minutes, notices.
- Chairperson: governance. Chama health, approval queues, participation.
- Auditor: verification. Read-only financials and audit trail.
- Welfare officer: claims. Loan officer: credit.

Permissions influence what appears in the UI; modules influence it too
(a savings-only chama never shows welfare).

## 6. States

- Empty states have personality: explain what will appear here and offer the
  next action ("Record first payment").
- Loading: skeletons, never blank space.
- Financial actions get strong confirmations with full context (who, what,
  amount, method, reference) and consequence explanations ("This will remove
  KSh 1,000 from October and create a reversal record; the original
  transaction is not deleted").

## 7. Transaction context (trust)

Every financial screen answers "do I know what happened?": who, what, when,
amount, method, reference, status (e.g. "Matched automatically"). Money data
is visually prominent; sync timestamps and metadata are small.

## 8. Navigation discipline

- Primary: 4-6 important actions visible.
- Secondary: a More menu.
- Advanced: Settings.
- The chama switcher is a first-class control: current chama + role always
  visible, tap to see all chamas with roles, plus Create/Join.

## Typography scale

- H1: 32-40px desktop, 28-32px mobile
- H2: 24-28px
- H3: 18-20px
- Body: 15-16px
- Metadata: 13-14px
