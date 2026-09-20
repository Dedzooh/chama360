# Backup and Restore

Production Compose includes a dedicated `backup` container. It performs a full PostgreSQL custom-format dump daily, encrypts it with AES-256-CBC using `BACKUP_ENCRYPTION_KEY`, and uploads it to the configured S3-compatible bucket. It also encrypts a configuration snapshot and the local uploads volume when present.

## Required production settings

Set these in the deployment secret store or `.env.production` outside source control:

```text
BACKUP_S3_BUCKET=chama360-backups
BACKUP_S3_PREFIX=production/chama360
BACKUP_ENCRYPTION_KEY=<long random secret>
AWS_ACCESS_KEY_ID=<backup-writer key>
AWS_SECRET_ACCESS_KEY=<backup-writer secret>
AWS_REGION=<region>
```

The backup writer needs permission to upload objects and configure the bucket lifecycle. The container configures a 30-day object-retention rule. Enable bucket versioning, server-side encryption, and an off-site replication policy at the storage provider as well.

## Restore test

At least monthly, download a database backup into an isolated PostgreSQL instance and run:

```powershell
$env:DATABASE_URL = 'postgresql://chama:password@localhost:5435/chama_restore'
$env:BACKUP_ENCRYPTION_KEY = '<backup secret>'
$env:BACKUP_FILE = '.\database\20260918T000000Z.dump.enc'
bash scripts/restore-postgres-backup.sh
npm run type-check
npm run test:offline
bash scripts/verify-restored-financial-data.sh
```

The verification script checks organizations, members, contributions, loans, welfare claims, transactions, audit logs, reconciliation exceptions, wallet totals, completed ledger totals, paid contributions, outstanding loans, paid welfare totals, negative wallets, and missing idempotency keys. Create a production-like fixture before the dump with members, a contribution, a loan, and a welfare transaction, then compare the printed totals before and after restore. Record the restore duration and result as an operational control before destroying the isolated restore target.

## Production monitoring

The public liveness/readiness endpoints are:

```text
/health/live
/health/ready
/health/detailed
/health/operations
```

`/health/operations` reports recent failed subscription payments, failed SMS delivery, failed background jobs, pending M-Pesa callbacks with errors, reconciliation-required transactions, process memory/uptime/load, and organization document storage usage. Alert on non-200 readiness, database/Redis unhealthy status, any reconciliation-required increase, failed callbacks, failed jobs, failed SMS spikes, negative wallet balances, and backup container/object-store failure. Backup success must also be checked externally from the backup container logs and the backup bucket's latest object timestamp; do not rely on API liveness as proof of backup success.

## Operational notes

The backup container is intentionally separate from the API container. Database credentials, S3 credentials, and the encryption key must not be placed in the image or committed files. Losing the encryption key makes the encrypted backups unrecoverable.