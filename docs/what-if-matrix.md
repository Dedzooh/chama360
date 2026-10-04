# Chama360 What-If Matrix

Every hard question a client (or chama) can ask, mapped to how Chama360
answers it today. Items marked **[GAP]** are not yet implemented and need a
build decision before they are promised to a client.

Last verified against the codebase: 2026-10-04.

## 1. Identity & accounts

| What if... | Chama360's answer |
|---|---|
| I belong to two or ten chamas? | One account, unlimited memberships. My Chamas lists each with your role; switch context any time. |
| I create a chama and also hold a role in it? | Normal. Creator is not a special account. Creator status grants owner-level privileges within that chama regardless of officer role. |
| I create more than one chama? | Create as many as you like from My Chamas - Create Chama. |
| I am Treasurer here but a Member elsewhere? | Roles are per-membership. Features follow the chama you are currently in. |
| I change my phone or email? | Your User ID is the identity key. Memberships, contributions, loans, claims all stay attached. Contact details are updatable. |
| Two members have the same name? | Records reference User IDs, never names. |
| Someone invites a person who already has an account? | No duplicate account. The invite attaches a new membership to the existing user. |
| I want to leave one chama but stay in another? | Leaving one membership never touches the account or other chamas. Exit settlement is per chama. |
| A member dies? | **[GAP]** Bereavement workflow: suspend member + trigger welfare claim + settlement flow. |

## 2. Chama lifecycle

| What if... | Chama360's answer |
|---|---|
| The chama is still being set up? | Draft status + setup checklist. Dashboard shows progress (5/7 etc.). |
| The founder leaves? | Founder can transfer ownership through the role-change flow (protected: cannot demote the last founder). |
| The chama becomes archived? | Archived organizations are read-only at the API level (403 on writes). |
| A chama does not use welfare or loans? | Module scoping: hidden in UI AND blocked server-side (requireModuleEnabled). Savings-only chamas never see welfare. |
| I want two chamas with the same name? | Fine - identity is Chama ID, not name. |

## 3. Membership & roles

| What if... | Chama360's answer |
|---|---|
| Someone rejects an invitation? | Invitation expires; no membership created. |
| Someone joins twice? | Unique membership per (user, chama). Never duplicates. |
| Someone is suspended? | Loses access; records remain. Restore reactivates. |
| A member exits mid-cycle? | Exit settlement calculates contributions, arrears, loan balances, welfare obligations, share-outs with approval flow. |
| The Treasurer resigns? | Officer handover: role moves atomically to the chosen member; old officer access revoked immediately; immutable audit entry records previous/new officer, approver, date. |
| An official tries to approve their own transaction? | Self-approval blocked (welfare). **[GAP]** Extend to loans and expenses systematically. |
| The Treasurer changes rules or payment details without authorization? | Permission-gated settings + audited with old/new values. |
| Someone tries to modify old financial records? | Records never deleted - reversed/voided with reason, all audited. |
| I left as treasurer but still have access? | Impossible after handover (immediate revocation). |

## 4. Contributions

| What if... | Chama360's answer |
|---|---|
| A member pays late? | Arrears tracked per period; visible on member statement and treasurer dashboard. |
| A member pays partially (500 of 1,000)? | Status Partially Paid: Required 1000 / Paid 500 / Balance 500, with carry-forward. |
| A member overpays (3,000 at 1,000/month)? | Allocation engine (if allowAdvancePayments): fills Oct-Nov-Dec as allocations; remainder becomes contribution credit. Configuration-controlled. |
| The same M-Pesa message is pasted twice? | Transaction-ID deduplication prevents a second record. |
| Payment is reversed? | Reverse-with-reason workflow; allocation removed; wallet debited; audited. Never hard delete. |
| Payment cannot be identified? | Reconciliation exceptions: Unmatched with Assign/Hold/Reject for the treasurer. |
| A member pays from someone else's phone? | Parser matches amount + registry; sender-name mismatch = medium/low confidence, treasurer confirms. Never blind auto-mark. |
| I have 500 members? | Search, filters, pagination, bulk actions, import/export. |

## 5. M-Pesa & bank

| What if... | Chama360's answer |
|---|---|
| Member pastes the M-Pesa SMS? | Parser extracts transaction ID, amount, sender, phone, date; matches to member registry with confidence level. |
| Who configures M-Pesa / payment methods? | Treasurer (or creator) in Settings - Payments: mode, accepted methods, bank details, instructions. Validated and audited server-side. |
| The statement has 147 transactions? | Bulk reconciliation: matched (auto-approved), needs-confirmation, unmatched - treasurer reviews only exceptions. |
| Two transactions have the same amount? | Transaction ID + reference + date disambiguate; ambiguous go to needs-confirmation. |
| M-Pesa reference missing? | Amount+date matching (AMOUNT_ONLY confidence), treasurer confirms. |
| M-Pesa is down? | Cash/manual recording continues; reconciliation catches up. |

## 6. Loans

| What if... | Chama360's answer |
|---|---|
| Member already has a loan? | Eligibility check considers existing exposure vs limit. |
| A guarantor rejects? | Accept/decline with timestamp; insufficient guarantors block approval. |
| A member defaults? | Outstanding tracked; feeds future eligibility. |
| Partial repayment? | Supported; balance and next repayment on member statement. |
| Someone applies for another member? | Requires LOAN_APPLY_FOR_OTHERS permission. |
| Loan officer approves their own loan? | **[GAP]** Self-approval block extension. |

## 7. Welfare

| What if... | Chama360's answer |
|---|---|
| The chama has no welfare module? | Hidden entirely and blocked server-side. |
| A claim is rejected? | Reason recorded; history immutable; member can open a dispute. |
| The claimant disputes the decision? | Disputes module: case number, parties, evidence, decision, resolution date. |
| The welfare fund is insufficient? | Wallet balance shown in review; payout guarded by balance. |
| Who configures categories? | Welfare rules step in setup/Settings: categories, amounts, approval mode. |

## 8. Meetings & governance

| What if... | Chama360's answer |
|---|---|
| Quorum is not met? | System calculates quorum vs attendance. |
| A decision was made on WhatsApp? | Record as meeting + resolution; permanent record with approval date. |
| Members should vote? | Voting module: YES/NO/ABSTAIN tallies, Resolution Passed on the record. |
| Contribution amount increases? | Via resolution, audited. |
| Officials change? | Officer handover (section 3). |

## 9. Security & access

| What if... | Chama360's answer |
|---|---|
| A treasurer tries to access another chama? | Chama context enforced on every request via getOrganizationAccess. No cross-chama leakage. |
| Sensitive endpoints are brute-forced? | Rate limiting. |
| Platform team needs to intervene? | Platform admin is a separate role, audited. **[GAP]** Formal support impersonation with expiry + member notification. |

## 10. Reports & audit

| What if... | Chama360's answer |
|---|---|
| Figures do not reconcile? | Financial exceptions page lists mismatches. |
| A transaction is reversed after a report? | Reports generated live from ledger; reversals post-date entries with audit reasons. |
| End-of-year statement? | Member statements + reports module. |
| Who verifies the treasurer? | Auditor role: read-only access to all financial records and audit logs. Recorder is not verifier. |

## 11. Separation of duties (core principle)

No single person controls the entire financial lifecycle.

Example flow for a KSh 50,000 expense:

1. Treasurer creates the expense
2. Chairperson reviews
3. Secretary confirms the meeting/resolution where required
4. System records the approval chain
5. Treasurer executes payment
6. Auditor verifies afterwards

Every step produces an audit entry. Nothing is deletable - only reversible with reasons.

## Gap register (build queue)

1. **[GAP] Systematic self-approval block** - extend the welfare-style rule to loans and expense approvals.
2. **[GAP] Bereavement/death workflow** - member suspension + claim trigger + settlement orchestration.
3. **[GAP] Support impersonation** - time-boxed, member-notified, fully-audited platform support access.

These are the only three blueprint items without an implemented answer.
