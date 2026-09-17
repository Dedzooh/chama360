# Chama Constitution

This document defines the core business rules and workflows for the Chama application. It is the functional source of truth before implementation.

## 0. Guiding Principles

- A Chama must always have a clear state and a single source of truth for financial records.
- Any action that changes money, membership, governance, or approvals must be auditable.
- Closed or archived records must never be silently mutated.
- Finance rules should favor traceability over convenience.
- Committee decisions override individual convenience unless the constitution says otherwise.

## 1. Organization Lifecycle

### States

`Draft` -> `Active` -> `Suspended` -> `Closed` -> `Archived`

### Rules

- `Draft`
  - The Chama exists but is not operational.
  - Only the creator, chairperson, secretary, treasurer, or admin can edit setup data.
  - No contributions, loans, or welfare claims can be processed.
- `Active`
  - Normal operating state.
  - Contributions, loans, welfare claims, meetings, and notifications are enabled.
- `Suspended`
  - Temporarily restricted due to governance, compliance, or financial issues.
  - New contributions and new loans are blocked.
  - Existing repayments, audits, and internal reviews may continue.
- `Closed`
  - No new contributions or loans can be created.
  - Repayments, reversals, closing entries, and reporting remain allowed.
  - The Chama can only move to `Archived` after closing reconciliation is complete.
- `Archived`
  - Read-only.
  - No operational write actions are allowed.

### Activation Rule

- Only the creator or committee can activate a new Chama.
- Activation requires at least one governance role to be assigned, at minimum chairperson and treasurer.
- A Chama may not be activated if core settings are incomplete.

## 2. Member Lifecycle

### States

`Invitation Sent` -> `Pending Approval` -> `Active Member` -> `Suspended` -> `Exited` -> `Archived`

### Rules

- `Invitation Sent`
  - A join invitation has been issued but not accepted.
- `Pending Approval`
  - The invitee has accepted, but the membership still requires approval.
- `Active Member`
  - The member can participate according to their role and status.
- `Suspended`
  - The member cannot vote, borrow, or transact until reinstated.
- `Exited`
  - The member has left the Chama or has been removed.
- `Archived`
  - Historical record only.

### Approval Rule

- New members are approved by the chairperson, secretary, or a committee majority, depending on the Chama's configured governance policy.
- If the Chama uses committee approval, approval requires a majority vote of the active committee members.

### Exit Rule

- Members may leave voluntarily if their account is settled.
- If a member still owes a loan, they cannot fully exit until one of the following happens:
  - the loan is cleared,
  - the committee approves a controlled exit with a debt recovery plan,
  - or the Chama marks the member as exited but retains the debt obligation.
- Exited members may rejoin later only through a new invitation or reapplication.

### Debt Rule

- A member with unpaid loans cannot be treated as fully cleared for financial closure.
- Guarantor liabilities remain active until the loan is settled or formally released.

## 3. Contribution Rules

### Core Rules

- Contributions are tied to a contribution cycle and a due date.
- A contribution can be `PENDING`, `PAID`, `OVERDUE`, or `PARTIAL`.
- Contribution amounts should be editable only before payment is posted.
- After payment, edits require an authorized reversal and re-entry.

### Payment Rules

- Members may pay in advance.
- One payment may cover multiple months or cycles if the contribution schedule supports it.
- Partial payments are allowed only if the Chama enables them.
- Any payment must generate a receipt automatically.

### Reversal Rules

- A payment reversal can only be done by the treasurer, chairperson, or admin.
- A reversal must include a reason, the original transaction reference, and an audit entry.
- Reversals after monthly closing require additional approval from the chairperson or admin.

### Penalty Rules

- Penalties apply when a contribution is overdue past the configured grace period.
- Penalty calculation should be configurable per Chama.
- Default penalty model:
  - fixed daily penalty or
  - percentage of the overdue amount per period.
- Penalties must be visible in member statements and contribution summaries.

## 4. Loan Workflow

### Workflow

`Application` -> `Committee Review` -> `Approval` -> `Disbursement` -> `Repayment` -> `Completed`

### Rules

- Loan applications may only be submitted by active members.
- A member in `Suspended`, `Exited`, or `Archived` status cannot apply.
- A loan must not be disbursed before approval and disbursement authorization.

### Maximum Loan Multiplier

- Default rule: a member may borrow up to `3x` their verified contribution average, subject to available funds and committee approval.
- Chamas may configure a lower multiplier, but not a higher one without admin policy approval.

### Guarantor Requirements

- Loans above the base threshold require guarantors.
- Default requirement:
  - up to threshold: 0 guarantors,
  - above threshold: 2 guarantors,
  - high-risk or high-value loans: 3 guarantors.
- Guarantors must be active members with sufficient contribution history or reliability score.

### Interest Rules

- Interest must be explicit in the loan contract before approval.
- Default model: flat monthly interest on outstanding principal.
- The interest model must be stored with the loan so repayment schedules are reproducible.

### Early Repayment

- Early repayment is allowed.
- Early repayment closes future interest accrual from the date of settlement.
- Any precomputed fees or penalties still due must be collected before the loan is marked completed.

### Overdue Process

- Once a loan passes its due date and grace period:
  - the loan becomes overdue,
  - reminders are sent,
  - guarantors may be notified,
  - penalties may be applied,
  - the member may be suspended from new borrowing,
  - and the loan may be marked defaulted after committee review.

## 5. Welfare Workflow

### Workflow

`Claim Submitted` -> `Documents Verified` -> `Committee Review` -> `Approved / Rejected` -> `Payment` -> `Closed`

### Claim Categories

- Emergency
- Medical
- Funeral
- Education
- Other, with mandatory explanation

### Required Documents

- Medical claims: medical note, invoice, or discharge summary.
- Funeral claims: death certificate, burial notice, or family confirmation.
- Education claims: fee structure, invoice, or school letter.
- Emergency claims: incident evidence and incident explanation.
- Other claims: supporting evidence appropriate to the claim.

### Approval Thresholds

- Small claims may be approved by the chairperson and secretary.
- Medium and large claims require committee review.
- Claims above the configured maximum require full committee approval.

### Maximum Support Amounts

- Welfare support must be capped by Chama policy.
- Default rule:
  - small claim cap,
  - annual member cap,
  - and total fund availability checks.

## 6. Meeting Workflow

### Workflow

`Schedule` -> `Notify Members` -> `Attendance` -> `Minutes` -> `Voting` -> `Action Items` -> `Closed`

### Rules

- Meetings may be scheduled by authorized governance roles.
- Attendance must be captured against the actual member list for the meeting date.
- Minutes are editable until the meeting is closed.
- Voting is only allowed while the meeting is open or ongoing.
- Action items must be assigned an owner and due date where applicable.

## 7. Notifications

### Trigger Events

- Contribution due.
- Contribution overdue.
- Loan application submitted.
- Loan approved.
- Loan disbursed.
- Loan repayment due.
- Loan overdue.
- Welfare claim submitted.
- Welfare claim approved or rejected.
- New meeting scheduled.
- Meeting reminder.
- New announcement.
- Member invitation sent.
- Member approval.
- Member suspension.
- Member exit or removal.
- Monthly closing completed.

### Rules

- Notifications should be scoped to the affected Chama unless explicitly marked global.
- Critical financial and governance events should use high-priority notifications.
- Notification delivery status must be tracked.

## 8. Audit Rules

### Required Audit Events

- Login.
- Logout.
- Payment creation.
- Payment reversal.
- Loan application.
- Loan approval.
- Loan disbursement.
- Loan repayment.
- Welfare submission.
- Welfare approval.
- Welfare rejection.
- Member invitation.
- Member approval.
- Member removal.
- Member suspension.
- Settings changes.
- Role changes.
- Closing and archiving actions.

### Rules

- No important financial or governance action should occur without an audit entry.
- Audit entries must include:
  - who performed the action,
  - what was changed,
  - when it happened,
  - the affected entity,
  - and relevant before/after values.
- Audit logs are immutable.

## 9. Financial Rules

### Payment Channels

- Cash
- M-Pesa
- Bank transfer

### Rules

- Every financial transaction must have a reference.
- Every payment must map to a contribution, loan repayment, welfare payment, or adjustment.
- Reversals must preserve the original transaction history.
- Refunds require explicit authorization and a linked audit trail.
- Receipts are generated automatically for all successful financial postings.

### Monthly Closing

- At month end, finance records should be reconciled.
- Monthly closing should:
  - freeze finalized contribution records,
  - flag unresolved variances,
  - summarize collections, disbursements, reversals, and penalties,
  - and produce a close-out report.

### Reconciliation

- Cash, M-Pesa, and bank balances must be reconciled against the ledger.
- Any variance must remain open until resolved by the treasurer or admin.

## 10. Permission Matrix

Legend:

- `Member` = ordinary active member
- `Treasurer` = financial officer
- `Secretary` = records officer
- `Chairperson` = governance lead
- `Admin` = system administrator

| Action | Member | Treasurer | Secretary | Chairperson | Admin |
| --- | --- | --- | --- | --- | --- |
| View own profile | Yes | Yes | Yes | Yes | Yes |
| View member profiles | No | Yes | Yes | Yes | Yes |
| Create invitation | No | No | Yes | Yes | Yes |
| Approve member | No | No | Yes | Yes | Yes |
| Suspend member | No | No | No | Yes | Yes |
| Remove member | No | No | No | Yes | Yes |
| View contributions | Own only | Yes | Yes | Yes | Yes |
| Record contribution | No | Yes | No | Yes | Yes |
| Edit unpaid contribution | No | Yes | No | Yes | Yes |
| Reverse contribution payment | No | Yes | No | Yes | Yes |
| Approve loan | No | No | No | Yes | Yes |
| Disburse loan | No | Yes | No | Yes | Yes |
| Record loan repayment | No | Yes | No | Yes | Yes |
| Mark loan defaulted | No | No | No | Yes | Yes |
| Submit welfare claim | Yes | Yes | Yes | Yes | Yes |
| Approve welfare | No | No | No | Yes | Yes |
| Create meeting | No | No | Yes | Yes | Yes |
| Record attendance | No | No | Yes | Yes | Yes |
| Close meeting | No | No | Yes | Yes | Yes |
| Send announcement | No | No | Yes | Yes | Yes |
| Change settings | No | No | No | No | Yes |
| View audit logs | No | Yes | Yes | Yes | Yes |
| Export reports | No | Yes | Yes | Yes | Yes |
| Archive Chama | No | No | No | Yes | Yes |

## 11. Implementation Notes

- The current schema already has the main entities for memberships, contributions, loans, welfare claims, meetings, notifications, and audit logs.
- The business lifecycle defined here is stricter than the current enum set in the Prisma schema and will require either:
  - enum expansion, or
  - a clean mapping layer between business states and stored states.
- Recommended schema alignment:
  - `ChamaStatus` should represent `Draft`, `Active`, `Suspended`, `Closed`, and `Archived`.
  - `MemberStatus` should support invitation and approval states if the app needs to distinguish them at the data level.
  - `LoanStatus`, `ContributionStatus`, `WelfareClaimStatus`, and `MeetingStatus` should remain event-driven and auditable.

