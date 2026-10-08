# @arc/web

ARC Gateway in one Vite app:

- Marketing site: `/`, `/how-it-works`, `/developers`, `/pricing`, `/signup` (one-time key reveal).
- Partner dashboard `/app/*` (lazy-loaded): overview, customers (+ setup links), transactions, ledger (+ CSV), widget (embed code + live preview), settings (key rotation, publishable keys).
- Customer accounts `/account/*` (lazy-loaded): `/account/setup?token=…`, `/account/login?partner=…`, `/account` (payout wallet, password).

Stack: React 18, Vite 8, Tailwind 3, TanStack Query 5, React Router 6, `@arc/gateway-sdk` and `@arc/widget` (workspace).

## Run

```bash
pnpm install
pnpm --filter @arc/gateway-sdk --filter @arc/widget build   # the app imports their dist/
cp apps/web/.env.example apps/web/.env    # optional; defaults to http://localhost:3000
pnpm --filter @arc/web dev                # http://localhost:5173
```

The gateway must allow this origin: `CORS_ORIGINS=http://localhost:5173` (the gateway default).

## Build and test

```bash
pnpm --filter "@arc/web..." build   # builds the SDK first, then type-checks and bundles the app
pnpm --filter @arc/web test
```

## Config

| Variable | Default | Notes |
|---|---|---|
| `VITE_GATEWAY_URL` | `http://localhost:3000` | Public: compiled into the bundle. Never put secrets in `VITE_*` vars. |

## Auth

Dashboard login is the partner's secret API key, validated with `GET /v1/partners/me` and stored in `localStorage` (`arc-gateway.apiKey`) so reloads stay signed in. Tradeoff: script running on this origin could read it. A 401 from the gateway signs the partner out. Planned: exchange the key for an httpOnly session cookie.

Customer accounts use a separate session token (`cs_…`, 7-day expiry) in `localStorage` (`arc-gateway.customerSession`), plus the business id (`arc-gateway.customerPartner`) so sign-in knows which partner the customer belongs to. Setup tokens are read once and removed from the address bar.
