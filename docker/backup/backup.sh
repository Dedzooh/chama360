#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-chama360}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_S3_ENDPOINT="${AWS_S3_ENDPOINT:-}"
WORK_DIR="${BACKUP_WORK_DIR:-/tmp/chama360-backup}"

mkdir -p "$WORK_DIR"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

aws_args=(--region "$AWS_REGION")
if [[ -n "$AWS_S3_ENDPOINT" ]]; then
  aws_args+=(--endpoint-url "$AWS_S3_ENDPOINT")
fi

s3_uri="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}"

upload_encrypted() {
  local source="$1"
  local destination="$2"
  openssl enc -aes-256-cbc -pbkdf2 -salt -iter 200000 \
    -in "$source" -out "$WORK_DIR/payload.enc" \
    -pass env:BACKUP_ENCRYPTION_KEY
  aws s3 cp "${WORK_DIR}/payload.enc" "${s3_uri}/${destination}" "${aws_args[@]}" --only-show-errors
  rm -f "$WORK_DIR/payload.enc"
}

configure_lifecycle() {
  cat > "$WORK_DIR/lifecycle.json" <<EOF
{"Rules":[{"ID":"chama360-backup-retention","Status":"Enabled","Filter":{"Prefix":"${BACKUP_S3_PREFIX}/"},"Expiration":{"Days":30}}]}
EOF
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BACKUP_S3_BUCKET" \
    --lifecycle-configuration "file://$WORK_DIR/lifecycle.json" \
    "${aws_args[@]}" >/dev/null
}

backup_once() {
  local timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local dump="$WORK_DIR/chama360-${timestamp}.dump"
  local config="$WORK_DIR/chama360-${timestamp}.env"

  pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > "$dump"
  upload_encrypted "$dump" "database/${timestamp}.dump.enc"

  # Capture configuration in encrypted form; plaintext exists only in the container work directory.
  env | sort > "$config"
  upload_encrypted "$config" "configuration/${timestamp}.env.enc"

  if [[ -d /var/lib/chama360/uploads ]]; then
    tar -C /var/lib/chama360/uploads -czf "$WORK_DIR/uploads-${timestamp}.tar.gz" .
    upload_encrypted "$WORK_DIR/uploads-${timestamp}.tar.gz" "uploads/${timestamp}.tar.gz.enc"
  fi

  configure_lifecycle
  echo "[$(date -u +%FT%TZ)] backup uploaded: ${timestamp}" >&2
}

while true; do
  backup_once
  sleep "$BACKUP_INTERVAL_SECONDS"
done
