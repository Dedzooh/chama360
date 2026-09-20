#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the restored database}"

psql_cmd=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At)

query() { "${psql_cmd[@]}" -c "$1"; }

printf 'organizations=%s\n' "$(query 'SELECT count(*) FROM organizations;')"
printf 'members=%s\n' "$(query 'SELECT count(*) FROM organization_members;')"
printf 'contributions=%s\n' "$(query 'SELECT count(*) FROM contributions;')"
printf 'loans=%s\n' "$(query 'SELECT count(*) FROM loans;')"
printf 'welfare_claims=%s\n' "$(query 'SELECT count(*) FROM welfare_claims;')"
printf 'transactions=%s\n' "$(query 'SELECT count(*) FROM transactions;')"
printf 'audit_logs=%s\n' "$(query 'SELECT count(*) FROM organization_audit_logs;')"
printf 'reconciliation_required=%s\n' "$(query \"SELECT count(*) FROM transactions WHERE status = 'RECONCILIATION_REQUIRED';\")"
printf 'wallet_total=%s\n' "$(query 'SELECT coalesce(sum(balance), 0) FROM organization_wallets;')"
printf 'ledger_total=%s\n' "$(query \"SELECT coalesce(sum(amount), 0) FROM transactions WHERE status = 'COMPLETED';\")"
printf 'contribution_paid_total=%s\n' "$(query \"SELECT coalesce(sum(amount), 0) FROM contributions WHERE status = 'PAID';\")"
printf 'loan_outstanding_total=%s\n' "$(query \"SELECT coalesce(sum(balance), 0) FROM loans WHERE status IN ('ACTIVE', 'DEFAULTED');\")"
printf 'welfare_paid_total=%s\n' "$(query \"SELECT coalesce(sum(\\\"amountApproved\\\"), 0) FROM welfare_claims WHERE status = 'PAID';\")"

if [[ "$(query \"SELECT count(*) FROM organization_wallets WHERE balance < 0;\")" != "0" ]]; then
  echo 'RESTORE VERIFICATION FAILED: negative wallet balance detected' >&2
  exit 1
fi

if [[ "$(query \"SELECT count(*) FROM transactions WHERE \\\"idempotencyKey\\\" IS NULL OR \\\"idempotencyKey\\\" = '';\")" != "0" ]]; then
  echo 'RESTORE VERIFICATION FAILED: transaction without idempotency key detected' >&2
  exit 1
fi

echo 'RESTORE VERIFICATION PASSED'
