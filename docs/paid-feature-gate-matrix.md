# Paid Feature Gate Matrix

Every paid capability must have all four layers:

1. Frontend lock or upgrade prompt
2. Backend `requireSubscriptionFeature` gate
3. Active organization membership
4. Organization role/permission enforcement where the action is privileged

| Capability | Minimum plan | Backend enforcement |
|---|---:|---|
| Members, manual contributions, basic loans, basic welfare | Community | Membership and route RBAC |
| Professional reports and advanced exports | Starter | `ADVANCED_EXPORTS` |
| Documents and organization storage | Starter | `DOCUMENTS` |
| Voting | Growth | `VOTING` |
| Audit trail | Growth | `AUDIT_LOGS` |
| Advanced approvals | Growth | `ADMIN_CONTROLS` |
| Admin controls and role administration | Growth | `ADMIN_CONTROLS` |
| M-Pesa automation | Pro | `MPESA_AUTOMATION` |
| Financial exceptions | Pro | `ADMIN_CONTROLS` |
| Investment automation | Investment & SACCO Automation | `INVESTMENT_AUTOMATION` |

For every new paid endpoint, add a route-level gate and an integration test covering Community denial, active-plan access, expired subscription denial, grace behavior, and trial behavior.
