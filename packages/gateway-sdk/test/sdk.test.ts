import { describe, it, expect } from "vitest";
import { CustomerClient, GatewayClient, GatewayError, verifyWebhook } from "../src/index.js";

interface Call {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

function makeClient(
  handler: (call: Call, url: string, init: any) => { status: number; body: unknown }
): { client: GatewayClient; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init });
    const result = handler(calls[calls.length - 1], url, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      text: async () => JSON.stringify(result.body),
    } as Response;
  };
  return { client: new GatewayClient({ baseUrl: "http://gw.test", apiKey: "gw_live_testkey", fetchImpl }), calls };
}

const ok = (body: unknown) => (_c: Call, _u: string, _i: any) => ({ status: 200, body });

describe("verifyWebhook", () => {
  const secret = "whsec_test";
  async function sign(body: string, t = Math.floor(Date.now() / 1000)) {
    const { createHmac } = await import("crypto");
    return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  }
  it("accepts a valid signature and returns the event", async () => {
    const body = JSON.stringify({ id: "e1", type: "payment.paid", created: "x", data: { reference: "o1" } });
    const event = await verifyWebhook(body, await sign(body), secret);
    expect(event).toMatchObject({ type: "payment.paid", data: { reference: "o1" } });
  });
  it("rejects tampering, wrong secrets, stale timestamps and junk headers", async () => {
    const body = JSON.stringify({ type: "payment.paid" });
    const header = await sign(body);
    await expect(verifyWebhook(body.replace("paid", "PAID"), header, secret)).rejects.toThrow(/mismatch/);
    await expect(verifyWebhook(body, header, "whsec_other")).rejects.toThrow(/mismatch/);
    await expect(verifyWebhook(body, await sign(body, Math.floor(Date.now() / 1000) - 3600), secret)).rejects.toThrow(/window/);
    await expect(verifyWebhook(body, "nonsense", secret)).rejects.toThrow(/malformed/);
  });
});

describe("GatewayClient", () => {
  it("registerPartner posts to /v1/partners without auth", async () => {
    const { client, calls } = makeClient(ok({ partnerId: "p1", apiKey: "gw_live_abc", keyPrefix: "gw_live_", feeBps: 10, rateLimitPerMin: 30 }));
    const res = await client.registerPartner({ partnerName: "Acme Pay", email: "a@b.c", password: "long passphrase" });
    expect(res.partnerId).toBe("p1");
    expect(calls[0].url).toBe("http://gw.test/v1/partners");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["authorization"]).toBeUndefined();
    expect(JSON.parse(calls[0].init.body!)).toEqual({ partnerName: "Acme Pay", email: "a@b.c", password: "long passphrase" });
  });

  it("quote sends the client api key as a Bearer token and parses the response", async () => {
    const { client, calls } = makeClient(ok({ quoteId: "q1", amountIn: "1000", feeAmount: "1", feeBps: 10, netAmount: "999", estimatedOut: "900", minOut: "895", expiresAt: 999, unsignedTx: null }));
    const res = await client.quote({ originChainId: 1, destChainId: 5042002, tokenIn: "WETH", tokenOut: "USDC", amountIn: "1000", recipient: "0xRecipient00000000000000000000000000000000", slippageBps: 5, deadline: 9999999999 });
    expect(res.quoteId).toBe("q1");
    expect(calls[0].init.headers["authorization"]).toBe("Bearer gw_live_testkey");
    expect(JSON.parse(calls[0].init.body!).tokenIn).toBe("WETH");
  });

  it("a per-call api key overrides the client one", async () => {
    const { client, calls } = makeClient(ok({ ok: true }));
    await client.ledger(undefined, "gw_live_override");
    expect(calls[0].init.headers["authorization"]).toBe("Bearer gw_live_override");
  });

  it("getIntent encodes the id in the path", async () => {
    const { client, calls } = makeClient(ok({ id: "some-id", status: "PENDING", originTx: null, destTx: null, upstreamId: null, error: null, createdAt: "t", updatedAt: "t" }));
    await client.getIntent("some-id");
    expect(calls[0].url).toBe("http://gw.test/v1/intents/some-id");
  });

  it("ledger appends customerId as a query param", async () => {
    const { client, calls } = makeClient(ok({ partnerId: "p1", customerId: null, totals: { feeBps: 10, transactions: 0, amountInTotal: "0", feeTotal: "0" }, byCustomer: [] }));
    await client.ledger("11111111-1111-4111-8111-111111111111");
    expect(calls[0].url).toContain("?customerId=11111111-1111-4111-8111-111111111111");
  });

  it("chains and tokens hit the public discovery endpoints", async () => {
    const { client, calls } = makeClient(ok([]));
    await client.chains();
    await client.tokens(5042);
    expect(calls[0].url).toBe("http://gw.test/v1/chains");
    expect(calls[1].url).toBe("http://gw.test/v1/tokens?chainId=5042");
  });

  it("non-2xx responses throw GatewayError with status and body", async () => {
    const { client } = makeClient(() => ({ status: 400, body: { error: "customer not found for this partner" } }));
    await expect(client.quote({ originChainId: 1, destChainId: 5042002, tokenIn: "WETH", tokenOut: "USDC", amountIn: "1000", recipient: "0xRecipient00000000000000000000000000000000", slippageBps: 5, deadline: 9999999999, customerId: "11111111-1111-4111-8111-111111111111" })).rejects.toMatchObject({ name: "GatewayError", statusCode: 400, body: { error: "customer not found for this partner" } });
  });

  it("401 surfaces the API key failure", async () => {
    const { client } = makeClient(() => ({ status: 401, body: { error: "unauthorized" } }));
    await expect(client.createCustomer({ externalId: "u1", recipientAddress: "0x0000000000000000000000000000000000000000" })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("submitAndPoll returns when EXECUTED_ON_ARC", async () => {
    const states = ["PENDING", "ORIGIN_CONFIRMED", "EXECUTED_ON_ARC"];
    let i = 0;
    const { client } = makeClient((_c, url, _i) => {
      if (url.endsWith("/intents/submit")) return { status: 200, body: { intentId: "int-1" } };
      return { status: 200, body: { id: "int-1", status: states[Math.min(i++, 2)], originTx: "0x" + "a".repeat(64), destTx: i > 1 ? "0x" + "b".repeat(64) : null, upstreamId: "up", error: null, createdAt: "t", updatedAt: "t" } };
    });
    const updates: string[] = [];
    const result = await client.submitAndPoll({ quoteId: "q1", signedPayload: "0xab" }, { pollIntervalMs: 1, onUpdate: (s) => updates.push(s.status) });
    expect(result.status).toBe("EXECUTED_ON_ARC");
    expect(updates).toContain("ORIGIN_CONFIRMED");
  });

  it("submitAndPoll times out when the intent never settles", async () => {
    const { client } = makeClient((_c, url, _i) => {
      if (url.endsWith("/intents/submit")) return { status: 200, body: { intentId: "int-1" } };
      return { status: 200, body: { id: "int-1", status: "PENDING", originTx: null, destTx: null, upstreamId: "up", error: null, createdAt: "t", updatedAt: "t" } };
    });
    await expect(client.submitAndPoll({ quoteId: "q1", signedPayload: "0xab" }, { pollIntervalMs: 1, timeoutMs: 20 })).rejects.toBeInstanceOf(GatewayError);
  });

  it("list endpoints send paging and filters as query params", async () => {
    const { client, calls } = makeClient(ok({ items: [], total: 0, limit: 10, offset: 20 }));
    await client.listCustomers({ limit: 10, offset: 20 });
    await client.listQuotes({ customerId: "c1" });
    await client.listIntents({ status: "FAILED", limit: 5 });
    await client.listIntents();
    expect(calls.map((c) => c.url)).toEqual([
      "http://gw.test/v1/customers?limit=10&offset=20",
      "http://gw.test/v1/quotes?customerId=c1",
      "http://gw.test/v1/intents?status=FAILED&limit=5",
      "http://gw.test/v1/intents",
    ]);
    expect(calls.every((c) => c.init.method === "GET" && c.init.headers["authorization"] === "Bearer gw_live_testkey")).toBe(true);
  });

  it("me fetches the partner profile with auth", async () => {
    const { client, calls } = makeClient(ok({ partnerId: "p1", name: "Acme", email: null, feeBps: 10, rateLimitPerMin: 30, createdAt: "t", apiKey: { id: "k1", keyPrefix: "gw_live_", createdAt: "t" } }));
    const me = await client.me();
    expect(me.feeBps).toBe(10);
    expect(calls[0].url).toBe("http://gw.test/v1/partners/me");
    expect(calls[0].init.headers["authorization"]).toBe("Bearer gw_live_testkey");
  });

  it("key management hits the partner key routes with auth", async () => {
    const { client, calls } = makeClient(ok({}));
    await client.listApiKeys();
    await client.rotateApiKey();
    await client.createPublishableKey({ allowedOrigins: ["https://shop.example.com"] });
    await client.revokeApiKey("k-1");
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET http://gw.test/v1/partners/me/api-keys",
      "POST http://gw.test/v1/partners/me/api-keys/rotate",
      "POST http://gw.test/v1/partners/me/api-keys/publishable",
      "POST http://gw.test/v1/partners/me/api-keys/revoke",
    ]);
    expect(JSON.parse(calls[2].init.body!)).toEqual({ allowedOrigins: ["https://shop.example.com"] });
    expect(JSON.parse(calls[3].init.body!)).toEqual({ keyId: "k-1" });
    expect(calls.every((c) => c.init.headers!["authorization"] === "Bearer gw_live_testkey")).toBe(true);
  });

  it("createSetupLink posts for the customer with the partner key", async () => {
    const { client, calls } = makeClient(ok({ customerId: "c/1", token: "cst_x", expiresAt: "t" }));
    await client.createSetupLink("c/1");
    expect(calls[0].url).toBe("http://gw.test/v1/customers/c%2F1/setup-link");
    expect(calls[0].init.method).toBe("POST");
  });

  it("CustomerClient sends the session token, but not on setup/login", async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as unknown as typeof fetch;
    const customer = new CustomerClient({ baseUrl: "http://gw.test", sessionToken: "cs_abc", fetchImpl });
    await customer.setup({ token: "cst_x", email: "a@b.co", password: "p" });
    await customer.login({ partnerId: "p", email: "a@b.co", password: "p" });
    await customer.account();
    await customer.changePassword({ currentPassword: "a", newPassword: "b" });
    await customer.setPayoutWallet({ address: "0x1", chainId: 5042 });
    await customer.logout();
    expect(calls.map((c) => `${c.init.method} ${c.url.replace("http://gw.test", "")} ${c.init.headers!["authorization"] ?? "-"}`)).toEqual([
      "POST /v1/customer-auth/setup -",
      "POST /v1/customer-auth/login -",
      "GET /v1/customer/me Bearer cs_abc",
      "POST /v1/customer/me/password Bearer cs_abc",
      "POST /v1/customer/me/wallet Bearer cs_abc",
      "POST /v1/customer-auth/logout Bearer cs_abc",
    ]);
  });

  it("cookie-session clients send credentials and extra headers, never a bearer", async () => {
    const calls: Call[] = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => JSON.stringify({ expiresAt: "2026-10-17T00:00:00.000Z" }) } as Response;
    };
    const client = new GatewayClient({
      baseUrl: "http://gw.test",
      fetchImpl,
      credentials: "include",
      headers: { "x-arc-dashboard": "1" },
    });
    await client.openDashboardSession("gw_live_secret");
    expect(calls[0].url).toBe("http://gw.test/v1/dashboard/session");
    expect((calls[0].init as any).credentials).toBe("include");
    expect(calls[0].init.headers!["x-arc-dashboard"]).toBe("1");
    expect(calls[0].init.headers!["authorization"]).toBeUndefined();
    expect(JSON.parse(calls[0].init.body!)).toEqual({ apiKey: "gw_live_secret" });

    await client.me();
    expect(calls[1].init.headers!["authorization"]).toBeUndefined();
    await client.openDashboardSession({ email: "a@b.c", password: "long passphrase" });
    expect(JSON.parse(calls[2].init.body!)).toEqual({ email: "a@b.c", password: "long passphrase" });
    await client.closeDashboardSession();
    expect(calls[3].url).toBe("http://gw.test/v1/dashboard/session/logout");
    expect(calls[3].init.method).toBe("POST");
  });

  it("default fetch is called without the client bound as this", async () => {
    const original = globalThis.fetch;
    let receiver: unknown = "unset";
    globalThis.fetch = function (this: unknown) {
      receiver = this;
      return Promise.resolve({ ok: true, status: 200, text: async () => "[]" } as Response);
    } as typeof fetch;
    try {
      await new GatewayClient({ baseUrl: "http://gw.test" }).chains();
    } finally {
      globalThis.fetch = original;
    }
    expect(receiver).not.toBeInstanceOf(GatewayClient);
  });
});
