#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?Set DATABASE_URL for the restore target}"
: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY used by the backup container}"
: "${BACKUP_FILE:?Set BACKUP_FILE to a downloaded .dump.enc file}"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BACKUP_FILE" -out "$work_dir/restore.dump" \
  -pass env:BACKUP_ENCRYPTION_KEY

pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$DATABASE_URL" "$work_dir/restore.dump"

echo "Restore completed. Run application smoke tests and financial reconciliation before promoting the target database."
