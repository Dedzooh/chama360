# Proxy and Production Network

## Express proxy trust

The backend defaults to `TRUST_PROXY_HOPS=1`, matching the checked-in production topology:

```text
Internet -> Nginx -> Express container
```

Set `TRUST_PROXY_HOPS` in `.env.production` to the exact number of trusted reverse proxies in front of Express. For example:

```text
Internet -> Cloudflare/FortiGate -> Nginx -> Express
```

requires `TRUST_PROXY_HOPS=2` only when both external proxy hops forward the client address and are controlled by the deployment. Do not increase this value merely because a network device exists elsewhere in the path. An incorrect value can let clients influence `req.ip`, rate limits, and audit records.

## Android production API

Production Docker builds require `VITE_ANDROID_API_URL` to be supplied as an explicit `https://` URL. The production Compose file intentionally has no public-IP fallback:

```powershell
$env:VITE_ANDROID_API_URL = 'https://chamaz360.co.ke/api/v1'
docker compose -f docker-compose.prod.yml build web
```

Use local emulator or LAN URLs only in development environment files. Production M-Pesa callbacks and mobile API traffic must use HTTPS endpoints.