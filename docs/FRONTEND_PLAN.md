# ARC Gateway — B2B Frontend Development Plan

Authoritative plan for building the customer-facing and partner-facing frontend layer on top of the live `arc-gateway` API. This document is the handoff for an implementation agent. Read `src/server.ts`, `packages/gateway-sdk/`, and `reports/ENDPOINT_TEST_REPORT.md` for the current state before starting.

## 0. Decisions & progress (2026-10-08) — overrides the sections below where they conflict

**Decisions**
- **Widget auth = publishable keys** (`pk_live_…`, scoped to chains/tokens/quotes/intents + per-key origin allowlist). The secret `gw_live_` key must never ship to a browser the partner doesn't control.
- **One frontend app, `apps/web`**: marketing routes (`/`, `/how-it-works`, `/developers`, `/pricing`, `/signup`) + authenticated dashboard under `/app/*`. Signup hands the new key to the dashboard in memory (no key in URLs). Replaces separate `apps/landing` / `apps/dashboard`.
- Key-management routes become `/v1/partners/me/api-keys/...` (no `:id`; the key already identifies the partner).
- `packages/api-client` deferred: generate OpenAPI types into `@arc/gateway-sdk` instead of a second client.
- Quote/intent/ledger reads are scoped to the **partner** across all its keys (done in step 5 with key rotation). Legacy keys without a partner still see only their own rows.
- **Publishable keys cannot submit intents.** With `QUOTE_PROVIDER=arc`, submit spends the gateway hot wallet and `signedPayload` is not verified, so a browser-held key that could submit would let anyone drain it. The widget quotes and polls with `pk_live_`; the partner's server submits with the secret key via the widget's `submitIntent` callback.

**Order of work** (each step ends with green build/tests + a commit on `feat/b2b-frontend`)

| Step | Work | Status |
|---|---|---|
| 0 | Baseline commit; split `server.ts` into `src/routes/*` | ✅ done |
| 1 | Backend unblockers: CORS, `GET /v1/customers`, `GET /v1/partners/me`, `GET /v1/quotes`, `GET /v1/intents` (+ SDK methods) | ✅ done |
| 2 | Scaffold `apps/web` (React 18 + Vite + Tailwind 3 + react-query), API-key login, dashboard shell | ✅ done |
| 3 | Marketing pages + `/signup` with one-time key reveal | ✅ done |
| 4 | Dashboard: login, overview, customers, ledger + CSV, transactions, settings (+ `byToken` on `GET /v1/ledger`) | ✅ done |
| 5 | Publishable keys, key rotate/revoke, `ArcSwapWidget` (React + web component), partner-wide scope | ✅ done |
| 6 | Customer accounts: setup links, password (scrypt) + sessions + payout wallet; payout execution deferred | ✅ done |

---

## 1. Context & positioning

`arc-gateway` is a **B2B revenue layer on top of the ARC network**. Businesses (partners) are the paying customers. End users transacting through a partner's product are "customers" of that partner, tracked by the gateway so the partner earns per-transaction fees.

Product stack being delivered:

| Layer | Audience | Artifact | Status |
|---|---|---|---|
| Explainer site | Everyone/prospects | Web site explaining what we do, with sign-up CTA | to build |
| SDK + Widget | Partner developers | Typed SDK (`packages/gateway-sdk`) + embeddable widget for end customers | SDK exists; widget & packaging to build |
| API integration package | Partner developers | OpenAPI-generated client + integration docs | to build |
| Client dashboard | Partner businesses | Self-serve admin: customers, transactions, revenue, API keys | to build |
| End-customer accounts | End customers | Password set/change + wallet for fee earnings (payouts later) | backend + UI, later phase |

Guiding constraints:
- Reach the gateway **only through its REST API** (`http://localhost:3000`, real deploy URL later).
- Dashboard auth = **API-key login** (the key returned once by `POST /v1/partners`).
- B2B: no consumer payments/wallets in the widget MVP; the widget shows the partner's fee and submits on the partner's behalf.
- Customers will eventually receive fee earnings → they must be able to set/change a password and set a payout wallet address. Payout execution is intentionally **later**.

---

## 2. Repo conventions & building blocks to reuse (do not reinvent)

- pnpm workspace. Root manifest `pnpm-workspace.yaml` currently includes `packages/*` — add new packages/apps there.
- Live API: `GET /`, `/v1/chains`, `/v1/tokens`, `POST /v1/partners`, `POST /v1/customers`, `POST /v1/quotes`, `POST /v1/intents/submit`, `GET /v1/intents/:id`, `GET /v1/ledger`. OpenAPI doc at `/openapi.json`, UI at `/docs`.
- SDK: `packages/gateway-sdk` — `GatewayClient` (registerPartner, createCustomer, quote, submitIntent, getIntent, submitAndPoll, ledger, chains, tokens), `GatewayError`, typed responses. **Use it in the dashboard**, not hand-rolled fetch.
- Swagger/JSON-Schema response shapes are defined by zod schemas in `src/schemas.ts` — mirror exact field names (e.g. `feeAmount`, `netAmount`, `unsignedTx`, `amountIn`, `minOut`).
- Typescript strict + NodeNext module resolution, `type: "module"` everywhere.
- No CSS framework is installed yet; **React 18 + Vite + Tailwind 3** is the chosen stack (single-file config, fast). If adding Tailwind 4, keep it vendored — don't require a network CDN at runtime.
- Vitest is the test runner; each new package/app gets its own `vitest` config and `test` script.

---

## 3. Deliverables

### 3.1 Explainer site — `apps/landing`

Public marketing pages explaining the product. Routes:

- `/` — Home. Value prop ("Drop-in cross-chain gateway to ARC for your business"), how it works (3 steps), fee model (partner feeBps shown as %, e.g. 0.10%), "Get your API key" CTA.
- `/how-it-works` — diagram of partner → gateway → ARC; roles (partner, customer).
- `/developers` — SDK + widget + API integration highlights with code snippets (use real SDK snippet from `packages/gateway-sdk`).
- `/pricing` — fee model explanation; note default feeBps = 10 (0.10%), set by gateway.
- `/signup` — one API call to `POST /v1/partners` with `{ partnerName, email }`. On 201 show the **`apiKey` once** with a "copied" state and a strong "store it now, it is shown only once" warning, then navigate to the dashboard login pre-filled with the key.
  - Handle `409` (email already registered) and `400` inline.

CTA UX: "Get your API key" always lands on `/signup`. No marketing analytics or tracking needed.

### 3.2 SDK + Widget package — `packages/arc-widget`

The successful SDK is already `@arc/gateway-sdk`. MVP widget scope:

- **Custom element / React component**: `ArcSwapWidget`, props `{ baseUrl, partnerApiKey, originChainId, destChainId, config? }`.
- UI: chain + token pickers (from `/v1/chains`, `/v1/tokens`), amount input, recipient input, shows `feeAmount` + `feeBps` + `estimatedOut`/`minOut` from `POST /v1/quotes`, "Submit" button → `POST /v1/intents/submit` → poll via `getIntent`.
- Emits `onIntent(res)` on terminal status (`EXECUTED_ON_ARC` | `FAILED` | `REFUNDED`). Does **not** handle customer password/wallet in MVP.
- Package: framework-agnostic wrapper (web component + React), `props` validated against existing SDK types; versioned independently.

### 3.3 API integration package — `packages/api-client`

- Generate a typed client from the gateway's `/openapi.json` (openapi-typescript) or hand-authored thin client mirroring the SDK types.
- Ship alongside `packages/gateway-sdk` docs: endpoint reference, error table (400 invalid input, 401 unauthorized, 409 duplicate email, 429 rate limited, 502 upstream), rate-limit section.
- Purpose: partners who want raw REST instead of the SDK.

### 3.4 Client dashboard — `apps/dashboard`

Self-serve admin for a partner business. **Login = API key.** Validate the key by calling `GET /v1/ledger` (fails 401 with wrong key) or `GET /protected`. Store key in localStorage only (document the tradeoff); allow "logout" to clear.

Routes:

- `/login` — API-key input → validate → dashboard.
- `/` — Overview: ledger totals (`totals.feeTotal`, `totals.transactions`, `feeBps`), quick actions (new customer, new swap), recent transactions.
- `/customers` — list/create customers (`GET` list + `POST /v1/customers`), per-customer revenue from `GET /v1/ledger` (`byCustomer`).
- `/transactions` — quotes + intents history, statuses, `originTx`/`destTx` links to explorers.
  - **Backend gap:** there is currently **no list endpoint** for quotes/intents. Add `GET /v1/quotes` and `GET /v1/intents` (auth; filter `?apiKeyId=&customerId=&status=`) before this screen exists. See §4.
- `/ledger` — full revenue report + per-customer table + CSV export (client-side).
- `/settings` — show partner feeBps/rate limit; API-key management placeholder (rotate/revoke needs backend, see §4).

Widget codebase independence: dashboard may embed `ArcSwapWidget` for a quick "Send a swap" demo.

### 3.5 End-customer self-service (accounts)

MVP-late; listed so backend work is sequenced now.

- Customer (of a partner) can set their password once via a link (temporary token) and later change it.
- Customer can set/update a **payout wallet address** (chain-selectable: at least Ethereum + Arc) for **future fee earnings**.
- Fees → customer payout is **explicitly "integrated later"**: build the data model + endpoints now (store the wallet), no payout execution.
- Where it lives: either inside the widget or a small `apps/customer` account page. Decision deferred; keep the API contract first.

---

## 4. Backend changes required (implement in tandem; gateway repo = same monorepo)

The frontend depends on these. Keep zod schemas + Swagger + endpoint report updated for every change (existing convention).

### 4.1 Schema / migration (`src/db/schema.ts` + `drizzle/0003_*.sql`)

`customers` table additions:
- `email text` (nullable, unique)
- `password_hash text` (nullable — set on first password)
- `payout_wallet text` (nullable)
- `payout_chain_id integer` (nullable)

New tables:
- `customer_sessions` (`id`, `customer_id`, `token_hash`, `expires_at`, `created_at`) — password-based sessions.
- `password_reset_tokens` (`id`, `customer_id`, `token_hash`, `expires_at`, `used_at`).

### 4.2 New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/v1/customers` | partner key | ✅ built — list customers: `?limit=&offset=` |
| `GET` | `/v1/quotes` | partner key | ✅ built — list quotes for a key: `?customerId=&limit=&offset=` |
| `GET` | `/v1/intents` | partner key | ✅ built — list intents for a key: `?status=&customerId=&limit=&offset=` |
| `GET` | `/v1/partners/me` | partner key | ✅ built — partner profile for `/settings` |
| `GET`/`POST` | `/v1/partners/me/api-keys[/rotate,/publishable,/revoke]` | partner key | ✅ built (step 5) — see §9 "API keys" |
| `POST` | `/v1/customer/me/password`, `/v1/customer/me/wallet` (+ setup link, setup, login, logout, me) | customer session | ✅ built (step 6) — see §9 "Customer accounts" |

### 4.3 Customer auth model (no new libraries required)

- Password hashing: `scrypt` or `argon2` (node:crypto `scrypt` + per-user salt, constant-time compare — reuse the `timingSafeEqual` pattern already in `src/auth/apiKey.ts`).
- Sessions: opaque random token, store sha256 hash (same pattern as API keys), expiry, `customer_sessions` table.
- No email delivery in MVP: the "set password" link/token is returned by the API for the dashboard/agent to surface (documented as a known gap to wire to a real email provider later).

### 4.4 Rate limiting

- New customer-auth routes: rely on global IP rate limit (already present) + a per-account attempt limiter in Redis (pattern exists in `src/auth/rateLimit.ts`).

---

## 5. Tech & scaffolding decisions

- Monorepo layout: `apps/landing`, `apps/dashboard`, `packages/arc-widget`, `packages/api-client`, existing `packages/gateway-sdk`. Register all in `pnpm-workspace.yaml`.
- Stack: React 18 + Vite + Tailwind 3 + `@tanstack/react-query` for data fetching. Shared UI primitives if overlap grows.
- Env config per app via `VITE_GATEWAY_URL` (default `http://localhost:3000`); no secrets in frontend bundles.
- Dashboard fetches through `@arc/gateway-sdk` (workspace dependency `"workspace:*"`). Widget talks REST directly (it must be standalone for partners to drop into their apps).
- Tests: Vitest + React Testing Library for components; the dashboard is thin (focused on API-call coverage + happy-path rendering).
- Accessibility/responsiveness: base, desktop-first, mobile not blocking.

---

## 6. Implementation phases (do in order; each ends green: `pnpm build` + tests)

### Phase 0 — Scaffold
- Add `apps/landing`, `apps/dashboard`, `packages/arc-widget`, `packages/api-client` to workspace; shared Vite/Tailwind config; CI/`pnpm build` runs for each.

### Phase 1 — Explainer site
- Build `/`, `/how-it-works`, `/developers`, `/pricing`, `/signup` (real `POST /v1/partners` + one-time key reveal). Wire `GET /v1/chains` + `/v1/tokens` for a live "supported networks/tokens" section.

### Phase 2 — Dashboard core
- `/login` (API-key), `/` overview (ledger totals), `/customers` (create + list + per-customer revenue), `/ledger` (totals + CSV). Depends on §4.1 `GET /v1/quotes`? No — ledger only needs existing `GET /v1/ledger`. Ship without transactions screen.

### Phase 3 — Transactions (needs backend)
- Implement §4.1 `GET /v1/quotes`, `GET /v1/intents`; build `/transactions` + `/transactions/:id` (status polling via `submitAndPoll`-style client). Add explorer links for `originTx` / `destTx`.

### Phase 4 — SDK widget + api-client package
- `ArcSwapWidget` (React + web component), demo page in landing `/developers`; publish-shape the `api-client` package.

### Phase 5 — End-customer accounts (backend + UI)
- Implement §4.2/4.3 customer password + wallet endpoints; add a minimal "set your password" + "manage payout wallet" flow (in widget or `apps/dashboard` demo page). Keep payout execution out.

### Phase 6 — Fee payout placeholder
- Document/contract only: wallet stored, `feeTotal` amounts tracked; no on-chain payout yet. Finalize the "payouts later" contract in the dashboard `/settings` copy.

---

## 7. Ground truth to verify against (live today)

`curl http://localhost:3000/` lists 33 endpoints (after step 6). Key invariants the frontend must respect:

- A quote response is `amountIn` (full), `feeAmount`, `feeBps`, `netAmount`, `estimatedOut`, `minOut`, `expiresAt`, `unsignedTx` (nullable). Fee = `amountIn * feeBps / 10000`.
- `POST /v1/quotes` rejects: bad token/chain (400), same origin/dest (400), amount ≤ 0 (400), past deadline (400), `customerId` not owned by the key's partner (400).
- `POST /v1/intents/submit` is **idempotent per quoteId**; `GET /v1/intents/:id` transitions `PENDING → ORIGIN_CONFIRMED → FILLED → EXECUTED_ON_ARC | FAILED`.
- `GET /v1/ledger` requires a partner-linked key (legacy keys → 400 `api key is not linked to a partner`).
- Errors are `{"error": "..."}`; 401 unauthorized, 429 rate_limited, 409 duplicate email.
- Default partner fee = 10 bps (0.10%), default rate limit = 30 req/min — surface both in docs/dashboard.

---

## 8. Definition of done (checklist for the receiving agent)

- [x] `apps/web` (marketing + dashboard + customer accounts), `packages/arc-widget`, `packages/gateway-sdk` build + test green (`packages/api-client` deferred per §0)
- [x] `/signup` produces a working key against a live gateway; key shown exactly once with copy + storage warning
- [x] Dashboard login validates the API key; overview, customers, transactions, ledger (+CSV), widget and settings render real gateway data
- [x] Widget quotes with a publishable key, submits through the partner's server, and surfaces status through a terminal state with typed events
- [x] Customer password set/change + payout-wallet endpoints with scrypt hashing and hashed sessions; frontend flow at `/account`; payout execution deferred
- [x] Swagger `/docs` and `reports/ENDPOINT_TEST_REPORT.md` updated for every backend addition (60/60 after step 6)
- [x] No secrets in any frontend bundle; only `VITE_GATEWAY_URL` envs

---

## 9. API endpoint reference (live)

Base URL: `http://localhost:3000` (deploy URL later). Content type: `application/json`.
Auth: `Authorization: Bearer gw_live_...` — key issued once by `POST /v1/partners`.
Rate limits: global 600 req/min/IP; `POST /v1/partners` 5 req/min/IP; authenticated routes also limited to `rateLimitPerMin` per key (default 30/min) → HTTP 429 `{"error":"rate_limited","statusCode":429}`.
Errors: always `{"error":"<reason>"}`. Codes: `400` invalid input, `401` unauthorized, `409` duplicate email, `429` rate limited, `502` upstream failure.
Discovery: `GET /` (JSON endpoint index), `GET /openapi.json`, `GET /docs` (Swagger UI).

### Meta (public)

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/` | none | `{service, version, docs, openapi, endpoints:[{method,path,auth}]}` |
| `GET` | `/openapi.json` | none | OpenAPI 3.0.3 document |
| `GET` | `/health` | none | `200 {status:"ok",db:"up",redis:"up"}` / `503 {status:"degraded",db,redis}` |
| `GET` | `/protected` | bearer | `200 {ok:true}` |

### Chains & tokens (public, used by landing "supported networks" section)

| Method | Path | Response |
|---|---|---|
| `GET` | `/v1/chains` | `[{id, name, symbol, decimals, isArc, testnet, rpcUrl, explorerUrl, nativeTokenAddress}]` — ids: 1 Ethereum, 56 BNB, 8453 Base, 4663 Robinhood, **5042 Arc mainnet**, 5042002 Arc testnet. `isArc===true` marks destinations. |
| `GET` | `/v1/tokens?chainId=` | `[{chainId, symbol, name, address, decimals, isNative}]`; omit `chainId` for all (29 tokens). |

### Partner onboarding (public)

**`POST /v1/partners`** — rate-limited 5/min/IP.

Request:
```json
{ "partnerName": "Acme Pay", "email": "billing@acme.example" }
```
Responses:
- `201` `{"partnerId": "uuid", "apiKey": "gw_live_...", "keyPrefix": "gw_live_", "feeBps": 10, "rateLimitPerMin": 30}` — **apiKey shown once, never recoverable**
- `400` `{"error":"invalid input"}` (empty partnerName / bad email)
- `409` `{"error":"email already registered"}`

### Customers (partner key required)

**`POST /v1/customers`** — idempotent per `(partnerId, externalId)`.

Request:
```json
{ "externalId": "user_1234", "recipientAddress": "0x0000000000000000000000000000000000000001" }
```
Responses:
- `201` `{"customerId": "uuid", "externalId": "...", "recipientAddress": "0x...", "createdAt": "ISO"}`
- `200` same body, if the `externalId` already exists for this partner
- `400` `{"error":"invalid input"}` (bad 0x address) or `{"error":"api key is not linked to a partner"}` (legacy key)
- `401` unauthorized

### Quotes (partner key required)

**`POST /v1/quotes`**

Request:
```json
{
  "originChainId": 1,
  "destChainId": 5042002,
  "tokenIn": "WETH",
  "tokenOut": "USDC",
  "amountIn": "1000000000000000000",
  "recipient": "0xRecipientAddress",
  "slippageBps": 5,
  "deadline": 1791400000,
  "customerId": "uuid (optional — must belong to this partner)"
}
```
- `tokenIn`/`tokenOut`: symbol (`WETH`, `USDC`, `EURC`, `WBNB`, `USDG`, `ETH`, `BNB`, `USDT`) **or** a real ERC-20 address from `GET /v1/tokens`.
- `amountIn`: base units (integer string) — decimals come from the token (`decimals` field of `/v1/tokens`).
- `slippageBps`: 0–100. `deadline`: unix seconds, must be future.
- `customerId`: optional, for ledger attribution; must exist for this partner or `400`.

Response `200`:
```json
{
  "quoteId": "uuid",
  "amountIn": "1000000000000000000",
  "feeAmount": "1000000000000000",
  "feeBps": 10,
  "netAmount": "999000000000000000",
  "estimatedOut": "929070000000000000",
  "minOut": "924424650000000000",
  "expiresAt": 1791400000,
  "unsignedTx": "0x..." | null
}
```
Fee math: `feeAmount = amountIn * feeBps / 10000` (floor), `netAmount = amountIn - feeAmount`; `minOut = estimatedOut * (1 - slippageBps/10000)`.
Errors: `400` `unsupported chain` | `origin and destination must be different chains` | `tokenIn not supported on chain N` | `tokenOut not supported...` | `amount must be positive` | `deadline must be in the future` | `customer not found for this partner`; `401`; `429`; `502` `upstream quote failed: ...` (with `QUOTE_PROVIDER=arc`, no-liquidity routes return `400` with the solver reason instead).

### Intents (partner key required)

**`POST /v1/intents/submit`** — **idempotent per `quoteId`**; re-submitting returns the existing `intentId`.

Request: `{ "quoteId": "uuid", "signedPayload": "0x<64 bytes>" }` (payload currently unused — gateway wallet signs).
Responses: `200 {"intentId":"uuid"}` | `400` `quote not found or not yours` / `quote expired` / invalid input | `401` | `500` | `502` `upstream submit failed`.

**`GET /v1/intents/:id`** — poll this to track settlement.
Response `200`:
```json
{
  "id": "uuid",
  "status": "PENDING | ORIGIN_CONFIRMED | FILLED | EXECUTED_ON_ARC | REFUNDED | FAILED",
  "originTx": "0x... | null",
  "destTx": "0x... | null",
  "upstreamId": "string | null",
  "error": "string | null",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```
Lifecycle: `PENDING → ORIGIN_CONFIRMED (originTx) → FILLED (destTx) → EXECUTED_ON_ARC`, or `FAILED`/`REFUNDED`.
Errors: `404 not found`, `502 upstream status unavailable`, `401`, `400`.

### Ledger / revenue (partner key required)

**`GET /v1/ledger?customerId=<uuid>`** — optional `customerId` filter.

Response `200`:
```json
{
  "partnerId": "uuid",
  "customerId": "uuid | null",
  "totals": { "feeBps": 10, "transactions": 3, "amountInTotal": "3000000000000000000", "feeTotal": "3000000000000000" },
  "byToken": [
    { "chainId": 8453, "symbol": "WETH", "address": "0x4200...0006", "decimals": 18, "transactions": 2, "amountInTotal": "...", "feeTotal": "..." }
  ],
  "byCustomer": [
    { "customerId": "uuid | null", "externalId": "user_1234 | null", "recipientAddress": "0x... | null", "transactions": 1, "amountInTotal": "...", "feeTotal": "...", "byToken": [ ... ] }
  ]
}
```
- Aggregates quotes created by this API key; `amountInTotal`/`feeTotal` are base-unit integer strings.
- `totals` and per-customer `amountInTotal`/`feeTotal` add base units across **different tokens** (mixed decimals), so they are not displayable money. Use `byToken` (added in step 4), grouped by origin chain + `tokenIn`, with `decimals` for formatting (`null` if the token left the registry).
- `byCustomer` includes an unattributed bucket (`customerId: null`) for quotes made without `customerId`.
Errors: `400` `api key is not linked to a partner` (legacy key) or `customer not found for this partner` (foreign filter); `401`.

### Dashboard read endpoints (partner key required) — built in step 1

All lists return `{ "items": [...], "total": n, "limit": 50, "offset": 0 }`, newest first. `limit` 1–200 (default 50), `offset` ≥ 0; out-of-range → `400`. Lists return stored state and never poll upstream — use `GET /v1/intents/:id` to refresh one intent.

| Method | Path | Query | Item shape |
|---|---|---|---|
| `GET` | `/v1/customers` | `limit, offset` | `{customerId, externalId, recipientAddress, createdAt}` — partner-scoped; legacy key → `400` |
| `GET` | `/v1/quotes` | `customerId, limit, offset` | `{quoteId, customerId, originChainId, destChainId, tokenIn, tokenOut, recipient, amountIn, feeAmount, feeBps, netAmount, estimatedOut, minOut, expiresAt, createdAt, intent: {intentId, status} \| null}` — key-scoped |
| `GET` | `/v1/intents` | `status, customerId, limit, offset` | `{id, quoteId, customerId, originChainId, destChainId, amountIn, feeAmount, status, originTx, destTx, error, createdAt, updatedAt}` — key-scoped |
| `GET` | `/v1/partners/me` | — | `{partnerId, name, email, feeBps, rateLimitPerMin, createdAt, apiKey: {id, keyPrefix, createdAt}}`; legacy key → `400` |

SDK: `client.listCustomers()`, `client.listQuotes()`, `client.listIntents()`, `client.me()`.

**CORS:** browser origins allowed via `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`, `*` = any). Methods `GET, POST`; headers `authorization, content-type, x-arc-dashboard`. `CORS_ORIGINS` responses allow credentials (the session cookie); widget routes and `*` never do.

### Dashboard session (cookie)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/partners` | Body `{ partnerName, email, password }`. Email and a password of 10+ characters are required; the password is stored as a salted scrypt hash. Returns the one-time `apiKey`; the dashboard shows it once after signup instead of the signup page. |
| `POST` | `/v1/partners/me/password` | `{ currentPassword?, newPassword }`. Sets the dashboard password (key-only partners) or changes it (current password required). |
| `POST` | `/v1/dashboard/session` | Body `{ email, password }` or `{ apiKey }` (secret key). Wrong email/password → generic `401`; 5 failures per email in 15 min → `429`. Sets `arc_session` (httpOnly, SameSite=Lax by default, Secure in production, 7 days), returns `{ expiresAt }`. `401` bad key, `403` publishable key, `400` legacy key. 10/min/IP. |
| `POST` | `/v1/dashboard/session/logout` | Deletes the session and clears the cookie. Safe when signed out. |

Every `requireApiKey` route accepts the cookie in place of a bearer key, but only with `x-arc-dashboard: 1` (CSRF guard: cross-site pages can't add it without a preflight that only `CORS_ORIGINS` passes); a bearer header always wins. Only the sha256 of the `ps_` token is stored (`partner_sessions`). A session acts as the key it was opened with: revoking that key ends it, and rotating from the dashboard moves it to the new key. Env: `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE` (`none` requires Secure, for a dashboard on a different site).

### API keys (partner secret key required) — built in step 5

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/partners/me/api-keys` | All keys of the business (secret keys masked: `keyPrefix` + `last4`; publishable keys in full), with `current`, `active`, `revokedAt`. |
| `POST` | `/v1/partners/me/api-keys/rotate` | `201 { apiKey, key }`. New secret key shown once; the calling key is revoked in the same transaction. 5/min/IP. |
| `POST` | `/v1/partners/me/api-keys/publishable` | Body `{ allowedOrigins: ["https://shop.example.com"] }` (1–10 origins, scheme+host[+port], no path). `201` key summary with `publishableKey`. |
| `POST` | `/v1/partners/me/api-keys/revoke` | Body `{ keyId }`. Idempotent. `400` when revoking the calling key (rotate instead), `404` for another partner's key. |

Publishable keys (`pk_live_…`) are accepted only on `POST /v1/quotes` and `GET /v1/intents/:id`, and only with an `Origin` header in the key's allowlist; anything else → `403`. Those routes (plus `/v1/chains`, `/v1/tokens`) answer CORS from any origin; all other routes follow `CORS_ORIGINS`.

### Customer accounts — built in step 6

The plan's `/v1/customers/:id/password|wallet` became session-scoped `/v1/customer/me/*` routes: the session already identifies the customer, so there's no id to tamper with.

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/v1/customers/:id/setup-link` | partner secret key | `201 { customerId, token: "cst_…", expiresAt }`. One-time, 72h; replaces earlier unused links; doubles as password reset. **No email is sent**: the dashboard shows `/account/setup?token=…` for the partner to send. |
| `POST` | `/v1/customer-auth/setup` | — | `{ token, email, password }` (password ≥ 10 chars). Sets email+password, signs out other sessions, returns `{ sessionToken: "cs_…", expiresAt, account }`. `400` bad/used/expired link, `409` email used by another customer of the partner. |
| `POST` | `/v1/customer-auth/login` | — | `{ partnerId, email, password }` → session. `401` generic message; 5 failures per account in 15 min → `429`. |
| `POST` | `/v1/customer-auth/logout` | customer session | Deletes the session. |
| `GET` | `/v1/customer/me` | customer session | `{ customerId, partnerId, partnerName, externalId, email, recipientAddress, payoutWallet, payoutChainId, payoutsEnabled: false }` |
| `POST` | `/v1/customer/me/password` | customer session | `{ currentPassword, newPassword }`; signs out other sessions. |
| `POST` | `/v1/customer/me/wallet` | customer session | `{ address, chainId }` (supported chain). Stored only. |

`GET /v1/customers` items now include `email`, `hasPassword`, `payoutWallet`, `payoutChainId`. Passwords: scrypt (N=16384, r=8, p=1, 16-byte salt), constant-time verify, dummy verify for unknown emails. Sessions: random `cs_` token, sha256 stored, 7-day expiry. Customer sessions are rejected on partner routes and vice versa.

### Still open (not built)

- Email delivery for setup/reset links (the dashboard shows the link for the partner to send).
- Fee payouts to customer wallets (wallets are stored; `payoutsEnabled` is false).
- Verifying `signedPayload` on submit (currently unused; the gateway wallet signs).
- `packages/api-client` (OpenAPI-generated types) — deferred per §0.