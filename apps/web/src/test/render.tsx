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

/** Stub global fetch; the SDK resolves `fetch` at call time. */
export function mockGateway(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { status, body } = handler(new URL(String(input)), init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
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
