import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { gatewayAccounts, gatewaySession } from "./render";

// Never let a test reach a real gateway: unmocked requests fail fast.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "no mock for this request" }), { status: 503 }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  gatewaySession.key = null;
  gatewayAccounts.clear();
});
