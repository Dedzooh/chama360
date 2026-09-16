#!/usr/bin/env bash
set -euo pipefail

install -d -m 755 /opt/chama360
if [[ ! -f /opt/chama360/docker-compose.prod.yml ]]; then
  tar -xzf /tmp/chama360-deploy.tar.gz -C /opt/chama360
fi
cd /opt/chama360

if [[ ! -f .env ]]; then
  postgres_password="$(openssl rand -hex 32)"
  redis_password="$(openssl rand -hex 32)"
  jwt_secret="$(openssl rand -hex 48)"
  jwt_refresh_secret="$(openssl rand -hex 48)"
  session_secret="$(openssl rand -hex 48)"
  mfa_key="$(openssl rand -hex 32)"
  identity_secret="$(openssl rand -hex 48)"
  document_secret="$(openssl rand -hex 48)"

  umask 077
  printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' \
    "$postgres_password" "$redis_password" > .env

  cat > .env.production <<EOF
DATABASE_URL=postgresql://chama:${postgres_password}@postgres:5432/chama_management_system?schema=public
REDIS_URL=redis://:${redis_password}@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${redis_password}
REDIS_DB=0
REDIS_QUEUE_DB=1
BULL_REDIS_URL=redis://:${redis_password}@redis:6379/1
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_SECRET=${session_secret}
MFA_ENCRYPTION_KEY=${mfa_key}
IDENTITY_HASH_SECRET=${identity_secret}
DOCUMENT_HASH_SECRET=${document_secret}
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
API_VERSION=v1
APP_WEB_URL=http://15.235.33.47
CORS_ORIGIN=http://15.235.33.47
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads
LOG_LEVEL=info
LOG_FILE=logs/app.log
BCRYPT_ROUNDS=12
METRICS_ENABLED=true
MPESA_ENVIRONMENT=sandbox
BILLING_BUSINESS_NAME=CHAMA360
BILLING_BUSINESS_ADDRESS=Nairobi, Kenya
BILLING_VAT_RATE=0
EOF
  chmod 600 .env .env.production
fi

docker compose --env-file .env -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env -f docker-compose.prod.yml up -d
docker compose --env-file .env -f docker-compose.prod.yml ps
