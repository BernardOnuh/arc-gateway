# @arc/web

ARC Gateway marketing site (`/`, `/how-it-works`, `/developers`, `/pricing`, `/signup`) and partner dashboard (`/app/*`, lazy-loaded) in one Vite app.

Stack: React 18, Vite 8, Tailwind 3, TanStack Query 5, React Router 6, `@arc/gateway-sdk` (workspace).

## Run

```bash
pnpm install
pnpm --filter @arc/gateway-sdk build      # the app imports the SDK's dist/
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
