# Deploying ARC Gateway

Two containers plus Postgres and Redis:

| Piece | Image | Port | Public URL (example) |
|---|---|---|---|
| API | `Dockerfile` (repo root) | 3000 | `https://api.example.com` |
| Web app (marketing, dashboard, hosted checkout, widget bundle) | `apps/web/Dockerfile` | 8080 | `https://app.example.com` |
| Postgres 16 | managed, or the compose service | 5432 | private |
| Redis 7 | managed, or the compose service | 6379 | private |

Both images run on any Docker host (Fly.io, Render, Railway, AWS ECS/App Runner, a VPS).
The API is stateless: run 2+ instances behind a load balancer. Background work
(webhook delivery, payment sweeps) is safe with several instances.

## 1. Before the first deploy (one-time)

1. **Domains.** Use two subdomains of one domain (e.g. `api.example.com`, `app.example.com`) so the
   session cookie works with `SESSION_COOKIE_SAMESITE=lax`. Different sites need `none`.
2. **TLS.** Terminate HTTPS at your load balancer or proxy (Caddy and Traefik do it automatically).
   The API refuses to start in production with `http://` origins.
3. **Postgres and Redis.** Managed services are strongly recommended (automatic backups, failover).
   Turn on daily backups with at least 7 days of retention and **test a restore** once.
4. **Secrets** go in your platform's secret store, never in git. Copy `.env.production.example`
   and fill in every value. Required: `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `CORS_ORIGINS`,
   `PUBLIC_API_URL` (web build), `ARC_RPC_URL`.
5. **Circle API key** (`CIRCLE_API_KEY`) for App Kit: the shared rate limit is too low for real traffic.
6. **Resend** (`RESEND_API_KEY`, `EMAIL_FROM`): verify your sending domain in Resend first.
   Without a key, password-reset emails are only written to the log.

## 2. Deploy

Every deploy runs in this order:

```bash
# 1. Build images (CI can do this; see .github/workflows/ci.yml)
docker build -t arc-gateway-api .
docker build -f apps/web/Dockerfile --build-arg VITE_GATEWAY_URL=https://api.example.com -t arc-gateway-web .

# 2. Apply database migrations (one-off; safe to re-run)
docker run --rm --env-file .env.production arc-gateway-api node dist/migrate.js

# 3. Roll out the API, then the web app
```

On a single host, `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
does all three, with migrations as a one-off service that must succeed before the API starts.

**Rollback:** redeploy the previous image tags. Migrations are additive (new tables and columns), so an
older API runs against a newer schema. Don't drop columns in the same release that stops using them.

## 3. After deploy: smoke test (5 minutes)

1. `GET https://api.example.com/health` → `{"status":"ok","db":"up","redis":"up"}`
2. Open `https://app.example.com`, sign up, and confirm the secret key dialog appears.
3. Settings: set a payout address, create a publishable key for `https://app.example.com`,
   and add a webhook endpoint, then click **Send test** and expect HTTP 200.
4. Payments: create a $1 payment, open the checkout link, connect a funded wallet and pay.
   Confirm it reaches **paid**, the USDC arrives at the payout address on Arc, and a `payment.paid`
   webhook was delivered.
5. "Forgot password?" sends an email (Resend dashboard shows it).

## 4. Running it

- **Health:** point uptime checks at `/health` (API) and `/healthz` (web). Both containers have Docker
  healthchecks.
- **Logs:** JSON (pino) on stdout. Authorization headers and cookies are redacted. Ship them to your
  log service; alert on `"level":50` (errors), on `webhook delivery failed`, and on `payment sweep failed`.
- **Things to alert on:** payments stuck in `processing` for more than 30 minutes; webhook events
  with `status = 'failed'`; `/health` returning 503.
- **Scaling:** add API instances. Per-IP rate limits need `TRUST_PROXY` set to the number of proxies in
  front (usually 1), or every request looks like it came from the load balancer.
- **Rotating secrets:** partners rotate their own keys in Settings. Database and Redis credentials:
  update the secret store, then restart the API instances one at a time.

## 5. Security notes

- The gateway is **non-custodial**: customers' wallets pay merchants' payout addresses directly.
  The legacy `POST /v1/intents/submit` (gateway wallet pays) is off unless
  `ENABLE_GATEWAY_FUNDED_SUBMIT=true`. Leave it off.
- Webhook URLs must be `https` on public hosts in production (SSRF guard). DNS rebinding isn't
  covered; if you run in a VPC with sensitive internal services, add an egress proxy.
- Refunds for partly paid, expired checkouts are owed by the **merchant** (they hold the funds).
  The API and dashboard show who to refund and how much, and so does the `payment.expired` webhook.
- Get an independent security review before onboarding merchants who handle real volume.
