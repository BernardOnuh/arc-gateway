import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { App } from "../App";
import { Providers } from "../Providers";
import { routerFuture } from "../lib/router";

export function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <Providers>
        <App />
      </Providers>
    </MemoryRouter>
  );
}

type Handler = (url: URL, init: RequestInit) => { status: number; body: unknown };

/**
 * Fake cookie jar: the key the browser's httpOnly session cookie stands for.
 * mockGateway plays the gateway's part, so handlers keep checking
 * `Bearer <key>` while the app itself never sends a key.
 */
export const gatewaySession: { key: string | null } = { key: null };

/** Email + password accounts the fake gateway accepts, each standing for a secret key. */
export const gatewayAccounts = new Map<string, { password: string; apiKey: string }>();

/** Start a test already signed in, as if the cookie survived a reload. */
export function startSession(key: string) {
  gatewaySession.key = key;
}

/** Stub global fetch; the SDK resolves `fetch` at call time. */
export function mockGateway(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { status, body } = route(new URL(String(input)), init, handler);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function route(url: URL, init: RequestInit, handler: Handler): { status: number; body: unknown } {
  const method = init.method ?? "GET";
  if (method === "POST" && url.pathname === "/v1/dashboard/session") {
    const body = JSON.parse(String(init.body)) as { apiKey?: string; email?: string; password?: string };
    let apiKey = body.apiKey;
    if (body.email !== undefined) {
      const account = gatewayAccounts.get(body.email.toLowerCase());
      if (!account || account.password !== body.password) return { status: 401, body: { error: "wrong email or password" } };
      apiKey = account.apiKey;
    }
    // The gateway accepts exactly the keys /me would accept.
    const check = handler(new URL("/v1/partners/me", url), { headers: { authorization: `Bearer ${apiKey}` } });
    if (check.status !== 200) return check;
    gatewaySession.key = apiKey ?? null;
    return { status: 200, body: { expiresAt: "2026-10-17T00:00:00.000Z" } };
  }
  if (method === "POST" && url.pathname === "/v1/dashboard/session/logout") {
    gatewaySession.key = null;
    return { status: 200, body: { ok: true } };
  }
  const headers = new Headers(init.headers);
  if (
    !headers.has("authorization") &&
    init.credentials === "include" &&
    headers.get("x-arc-dashboard") === "1" &&
    gatewaySession.key
  ) {
    headers.set("authorization", `Bearer ${gatewaySession.key}`);
  }
  const result = handler(url, { ...init, headers });
  // Rotating moves the session onto the new key, like the gateway does.
  if (method === "POST" && url.pathname === "/v1/partners/me/api-keys/rotate" && result.status === 201) {
    gatewaySession.key = (result.body as { apiKey: string }).apiKey;
  }
  return result;
}

export const profile = {
  partnerId: "p-1",
  name: "Acme Pay",
  email: "billing@acme.example",
  feeBps: 10,
  rateLimitPerMin: 30,
  createdAt: "2026-10-08T00:00:00.000Z",
  apiKey: { id: "k-1", keyPrefix: "gw_live_", createdAt: "2026-10-08T00:00:00.000Z" },
};

export const chains = [
  { id: 8453, name: "Base", symbol: "ETH", decimals: 18, isArc: false, testnet: false, rpcUrl: "", explorerUrl: "https://basescan.org", nativeTokenAddress: "0x0000000000000000000000000000000000000000" },
  { id: 5042, name: "Arc", symbol: "USDC", decimals: 18, isArc: true, testnet: false, rpcUrl: "", explorerUrl: "https://explorer.arc.io", nativeTokenAddress: "0x3600000000000000000000000000000000000000" },
];

export const tokens = [
  { chainId: 8453, symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18, isNative: false },
  { chainId: 8453, symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, isNative: false },
  { chainId: 5042, symbol: "USDC", name: "USD Coin", address: "0x3600000000000000000000000000000000000000", decimals: 18, isNative: true },
];
