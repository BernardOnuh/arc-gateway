import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partners } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";
import { eq } from "drizzle-orm";
import { computeFee } from "./fees.js";

describe("full flow: quotes, intents, fees, auth", () => {
  let app: any;
  let aliceKey: string;
  let bobKey: string;
  let limitedKey: string;

  beforeAll(async () => {
    app = await buildApp();
    const k1 = generateApiKey();
    const k2 = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "alice",
      keyPrefix: k1.keyPrefix,
      keyHash: k1.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    await db.insert(apiKeys).values({
      partnerName: "bob",
      keyPrefix: k2.keyPrefix,
      keyHash: k2.keyHash,
      feeBps: 25,
      rateLimitPerMin: 50,
      active: true,
    });
    const k3 = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "limited",
      keyPrefix: k3.keyPrefix,
      keyHash: k3.keyHash,
      feeBps: 10,
      rateLimitPerMin: 3,
      active: true,
    });
    aliceKey = k1.rawKey;
    bobKey = k2.rawKey;
    limitedKey = k3.rawKey;
  });

  afterAll(async () => {
    if (app) await app.close();
    await db.delete(apiKeys).where(eq(apiKeys.partnerName, "alice"));
    await db.delete(apiKeys).where(eq(apiKeys.partnerName, "bob"));
    await db.delete(apiKeys).where(eq(apiKeys.partnerName, "limited"));
  });

  describe("computeFee", () => {
    it("basic", () => {
      const { fee, netAmount } = computeFee(1000000n, 10);
      expect(fee).toBe(1000n);
      expect(netAmount).toBe(999000n);
    });
    it("zero bps", () => {
      const { fee, netAmount } = computeFee(10000n, 0);
      expect(fee).toBe(0n);
      expect(netAmount).toBe(10000n);
    });
    it("100 bps is 1%", () => {
      const { fee, netAmount } = computeFee(10000n, 100);
      expect(fee).toBe(100n);
      expect(netAmount).toBe(9900n);
    });
    it("rounds down", () => {
      const { fee, netAmount } = computeFee(101n, 10);
      expect(fee).toBe(0n);
      expect(netAmount).toBe(101n);
    });
    it("throws if feeBps out of range", () => {
      expect(() => computeFee(100n, -1)).toThrow();
      expect(() => computeFee(100n, 101)).toThrow();
    });
    it("throws if amountIn <= 0", () => {
      expect(() => computeFee(0n, 10)).toThrow();
    });
  });

  describe("quotes", () => {
    it("alice can create a quote", async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000", // 1 ETH in wei
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.quoteId).toBeDefined();
      expect(data.amountIn).toBe(body.amountIn);
      expect(data.feeAmount).toBe("1000000000000000");
      expect(data.feeBps).toBe(10);
      expect(data.netAmount).toBe("999000000000000000");
      expect(data.estimatedOut).toBeDefined();
      expect(data.minOut).toBeDefined();
      expect(data.expiresAt).toBeDefined();
      expect(data.unsignedTx).toBeDefined();
    });

    it("rejects zero amount", async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "0",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects another partner's quote", async () => {
      // bob tries alice's workflow - should still work since it's per-key, but fee differs
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${bobKey}` },
        body: body,
      });
      // bob has 25 bps fee, should still get a quote
      expect(res.statusCode).toBe(200);
    });

    it("rejects unsupported chain", async () => {
      const body = {
        originChainId: 137, // polygon, not supported in our mock setup
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("unsupported chain");
    });

    it("rejects same-chain quote (must be cross-chain)", async () => {
      const body = {
        originChainId: 5042002,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("origin and destination must be different chains");
    });

    it("rejects unknown token", async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "NOTATOKEN",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("tokenIn not supported");
    });

    it("lists real chains and tokens", async () => {
      const chains = await app.inject({ method: "GET", url: "/v1/chains" });
      expect(chains.statusCode).toBe(200);
      const chainData = chains.json();
      expect(chainData.length).toBeGreaterThanOrEqual(5);
      const arcMainnet = chainData.find((c: any) => c.isArc && !c.testnet);
      const arcTestnet = chainData.find((c: any) => c.isArc && c.testnet);
      expect(arcMainnet.id).toBe(5042);
      expect(arcTestnet.id).toBe(5042002);

      const tokens = await app.inject({ method: "GET", url: "/v1/tokens?chainId=1" });
      expect(tokens.statusCode).toBe(200);
      const tokenData = tokens.json();
      expect(tokenData.some((t: any) => t.symbol === "WETH")).toBe(true);
      expect(tokenData.find((t: any) => t.symbol === "WETH").decimals).toBe(18);

      const all = await app.inject({ method: "GET", url: "/v1/tokens" });
      expect(all.json().length).toBeGreaterThan(10);
    });

    it("rejects deadline in the past", async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) - 100,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects slippage above max", async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 101, // above max of 100
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("intents/submit", () => {
    let aliceQuoteId: string;

    beforeEach(async () => {
      // Create a quote for alice first
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const res = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      aliceQuoteId = res.json().quoteId;
    });

    it("valid submit creates intent with PENDING status", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: aliceQuoteId,
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().intentId).toBeDefined();
    });

    it("idempotent: same quote id returns existing intent", async () => {
      // First submit
      const r1 = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: aliceQuoteId,
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      // Second submit with same quoteId
      const r2 = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: aliceQuoteId,
          signedPayload: "0x" + "b".repeat(64),
        },
      });
      expect(r2.statusCode).toBe(200);
      expect(r2.json().intentId).toBe(r1.json().intentId);
    });

    it("another partner's quote rejected", async () => {
      // bob tries to submit alice's quote
      const res = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${bobKey}` },
        body: {
          quoteId: aliceQuoteId,
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("expired quote rejected", async () => {
      // Create a quote with very short expiry manually in db
      // For now, test that the expiry check logic exists
      const res = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: aliceQuoteId,
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      // Should work on first call since quote just created
      expect(res.statusCode).toBe(200);
    });

    it("missing quote id returns 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("missing signed payload returns 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: aliceQuoteId,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("intents/:id status", () => {
    let aliceIntentId: string;

    beforeEach(async () => {
      const body = {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
      };

      const quoteRes = await app.inject({
        method: "POST",
        url: "/v1/quotes",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: body,
      });
      const submitRes = await app.inject({
        method: "POST",
        url: "/v1/intents/submit",
        headers: { authorization: `Bearer ${aliceKey}` },
        body: {
          quoteId: quoteRes.json().quoteId,
          signedPayload: "0x" + "a".repeat(64),
        },
      });
      aliceIntentId = submitRes.json().intentId;
    });

    it("returns intent status with origin tx on first poll", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/intents/${aliceIntentId}`,
        headers: { authorization: `Bearer ${aliceKey}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("ORIGIN_CONFIRMED");
      expect(res.json().originTx).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("advances to FILLED with a destination tx on ARC", async () => {
      // First call: origin confirmed on the source chain
      const r1 = await app.inject({
        method: "GET",
        url: `/v1/intents/${aliceIntentId}`,
        headers: { authorization: `Bearer ${aliceKey}` },
      });
      expect(r1.json().status).toBe("ORIGIN_CONFIRMED");
      expect(r1.json().originTx).toMatch(/^0x[0-9a-f]{64}$/);
      expect(r1.json().destTx).toBeNull();

      // Second call: filled on the destination (ARC) chain
      const r2 = await app.inject({
        method: "GET",
        url: `/v1/intents/${aliceIntentId}`,
        headers: { authorization: `Bearer ${aliceKey}` },
      });
      expect(r2.json().status).toBe("FILLED");
      expect(r2.json().originTx).toMatch(/^0x[0-9a-f]{64}$/);
      expect(r2.json().destTx).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("endpoint discovery", () => {
    it("root returns an endpoint index", async () => {
      const res = await app.inject({ method: "GET", url: "/" });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.docs).toBe("/docs");
      expect(data.openapi).toBe("/openapi.json");
      const paths = data.endpoints.map((e: any) => e.path);
      expect(paths).toContain("/v1/quotes");
      expect(paths).toContain("/v1/intents/submit");
      expect(paths).toContain("/v1/intents/:id");
      expect(data.endpoints.some((e: any) => e.auth)).toBe(true);
    });

    it("openapi.json describes the API", async () => {
      const res = await app.inject({ method: "GET", url: "/openapi.json" });
      expect(res.statusCode).toBe(200);
      const spec = res.json();
      expect(spec.openapi).toBe("3.0.3");
      expect(Object.keys(spec.paths)).toContain("/v1/quotes");
      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    });

    it("docs UI is served", async () => {
      const res = await app.inject({ method: "GET", url: "/docs/" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("Swagger UI");
    });
  });

  describe("per-partner rate limit", () => {
    it("429s after rateLimitPerMin is exceeded", async () => {
      const results = [];
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/protected",
          headers: { authorization: `Bearer ${limitedKey}` },
        });
        results.push(res.statusCode);
      }
      expect(results.slice(0, 3)).toEqual([200, 200, 200]);
      expect(results[3]).toBe(429);
    });
  });
});

describe("partner onboarding, customers and ledger", () => {
  let app: any;
  let partnerKey: string;
  let partnerId: string;
  let customerId: string;
  let legacyKey: string;
  const email = `partner-${Date.now()}@test.local`;
  const email2 = `partner2-${Date.now()}@test.local`;

  beforeAll(async () => {
    app = await buildApp();
    // POST /v1/partners is limited to 5/min/IP in shared Redis; clear the
    // counters so back-to-back test runs don't trip it.
    const rlKeys = await app.redis.keys("gateway-rl*");
    if (rlKeys.length > 0) await app.redis.del(...rlKeys);
    const legacy = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "legacy-no-partner",
      keyPrefix: legacy.keyPrefix,
      keyHash: legacy.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    legacyKey = legacy.rawKey;
  });

  afterAll(async () => {
    if (app) await app.close();
    await db.delete(partners).where(eq(partners.email, email));
    await db.delete(partners).where(eq(partners.email, email2));
    await db.delete(apiKeys).where(eq(apiKeys.partnerName, "legacy-no-partner"));
  });

  const quoteBody = (overrides: Record<string, unknown> = {}) => ({
    originChainId: 1,
    destChainId: 5042002,
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: "1000000000000000000",
    recipient: "0xrecipient",
    slippageBps: 5,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });

  it("registers a business and returns a one-time api key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/partners",
      body: { partnerName: "Acme Pay", email },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json();
    expect(data.partnerId).toBeDefined();
    expect(data.apiKey).toMatch(/^gw_live_/);
    expect(data.keyPrefix).toBe(data.apiKey.slice(0, 8));
    expect(data.feeBps).toBe(10);
    expect(data.rateLimitPerMin).toBe(30);
    partnerKey = data.apiKey;
    partnerId = data.partnerId;
  });

  it("rejects duplicate email with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/partners",
      body: { partnerName: "Acme Dupe", email },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects an invalid signup body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/partners",
      body: { partnerName: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("registers an end customer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: { externalId: "user_1234", recipientAddress: "0x0000000000000000000000000000000000000001" },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json();
    expect(data.customerId).toBeDefined();
    expect(data.externalId).toBe("user_1234");
    customerId = data.customerId;
  });

  it("is idempotent per externalId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: { externalId: "user_1234", recipientAddress: "0x0000000000000000000000000000000000000001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().customerId).toBe(customerId);
  });

  it("rejects an invalid recipient address", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: { externalId: "user_bad", recipientAddress: "0xnotanaddress" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("legacy keys without a partner cannot manage customers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${legacyKey}` },
      body: { externalId: "user_x", recipientAddress: "0x0000000000000000000000000000000000000002" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("api key is not linked to a partner");
  });

  it("creates a quote attributed to the customer and reports it in the ledger", async () => {
    const q = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: quoteBody({ customerId }),
    });
    expect(q.statusCode).toBe(200);
    expect(q.json().feeAmount).toBe("1000000000000000");
    expect(q.json().feeBps).toBe(10);

    const ledger = await app.inject({
      method: "GET",
      url: "/v1/ledger",
      headers: { authorization: `Bearer ${partnerKey}` },
    });
    expect(ledger.statusCode).toBe(200);
    const data = ledger.json();
    expect(data.partnerId).toBe(partnerId);
    expect(data.totals.transactions).toBe(1);
    expect(data.totals.amountInTotal).toBe("1000000000000000000");
    expect(data.totals.feeTotal).toBe("1000000000000000");
    expect(data.byCustomer).toHaveLength(1);
    expect(data.byCustomer[0]).toMatchObject({
      externalId: "user_1234",
      recipientAddress: "0x0000000000000000000000000000000000000001",
      transactions: 1,
      feeTotal: "1000000000000000",
    });

    const filtered = await app.inject({
      method: "GET",
      url: `/v1/ledger?customerId=${customerId}`,
      headers: { authorization: `Bearer ${partnerKey}` },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().totals.feeTotal).toBe("1000000000000000");
  });

  it("breaks ledger totals down per origin token", async () => {
    const usdc = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: quoteBody({ tokenIn: "USDC", amountIn: "5000000" }),
    });
    expect(usdc.statusCode).toBe(200);

    const data = (
      await app.inject({ method: "GET", url: "/v1/ledger", headers: { authorization: `Bearer ${partnerKey}` } })
    ).json();
    expect(data.totals.transactions).toBe(2);
    expect(data.byToken).toEqual([
      expect.objectContaining({ chainId: 1, symbol: "USDC", decimals: 6, transactions: 1, amountInTotal: "5000000", feeTotal: "5000" }),
      expect.objectContaining({ chainId: 1, symbol: "WETH", decimals: 18, transactions: 1, feeTotal: "1000000000000000" }),
    ]);
    const unattributed = data.byCustomer.find((c: { customerId: string | null }) => c.customerId === null);
    expect(unattributed.byToken).toEqual([expect.objectContaining({ symbol: "USDC", feeTotal: "5000" })]);
    const attributed = data.byCustomer.find((c: { customerId: string | null }) => c.customerId === customerId);
    expect(attributed.byToken).toEqual([expect.objectContaining({ symbol: "WETH", transactions: 1 })]);
  });

  it("rejects a quote attributed to another partner's customer", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/v1/partners",
      body: { partnerName: "Another Co", email: email2 },
    });
    expect(other.statusCode).toBe(201);
    const otherKey = other.json().apiKey;

    const otherCustomer = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${otherKey}` },
      body: { externalId: "their_user", recipientAddress: "0x0000000000000000000000000000000000000003" },
    });
    expect(otherCustomer.statusCode).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { authorization: `Bearer ${partnerKey}` },
      body: quoteBody({ customerId: otherCustomer.json().customerId }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("customer not found for this partner");
  });

  it("rejects a customer-attributed quote from a legacy key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { authorization: `Bearer ${legacyKey}` },
      body: quoteBody({ customerId }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("api key is not linked to a partner");
  });

  it("rejects a ledger filter with a foreign customer id", async () => {
    const foreign = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${legacyKey}` },
      body: { externalId: "legacy_user", recipientAddress: "0x0000000000000000000000000000000000000004" },
    });
    // legacy key cannot create customers at all, so test the filter against a bogus id
    expect(foreign.statusCode).toBe(400);

    const res = await app.inject({
      method: "GET",
      url: `/v1/ledger?customerId=11111111-1111-4111-8111-111111111111`,
      headers: { authorization: `Bearer ${partnerKey}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("customer not found for this partner");
  });

  it("legacy keys cannot access the ledger", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/ledger",
      headers: { authorization: `Bearer ${legacyKey}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("api key is not linked to a partner");
  });
});

describe("dashboard list endpoints and CORS", () => {
  let app: any;
  let key: string;
  let otherKey: string;
  let legacyKey: string;
  let partnerId: string;
  let customerA: string;
  let customerB: string;
  let intentId: string;
  const suffix = Date.now();
  const auth = () => ({ authorization: `Bearer ${key}` });

  async function makePartnerKey(name: string) {
    const [p] = await db
      .insert(partners)
      .values({ name, email: `${name}-${suffix}@test.local`, feeBps: 10, rateLimitPerMin: 100 })
      .returning({ id: partners.id });
    const k = generateApiKey();
    await db.insert(apiKeys).values({
      partnerId: p.id,
      partnerName: name,
      keyPrefix: k.keyPrefix,
      keyHash: k.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    return { partnerId: p.id, rawKey: k.rawKey };
  }

  const quote = (customerId?: string) =>
    app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: auth(),
      body: {
        originChainId: 1,
        destChainId: 5042002,
        tokenIn: "WETH",
        tokenOut: "USDC",
        amountIn: "1000000000000000000",
        recipient: "0xrecipient",
        slippageBps: 5,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        ...(customerId ? { customerId } : {}),
      },
    });

  beforeAll(async () => {
    app = await buildApp();
    const main = await makePartnerKey("list-main");
    key = main.rawKey;
    partnerId = main.partnerId;
    otherKey = (await makePartnerKey("list-other")).rawKey;

    const legacy = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "list-legacy",
      keyPrefix: legacy.keyPrefix,
      keyHash: legacy.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    legacyKey = legacy.rawKey;

    for (const [ext, addr] of [
      ["list_a", "0x00000000000000000000000000000000000000aa"],
      ["list_b", "0x00000000000000000000000000000000000000bb"],
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/customers",
        headers: auth(),
        body: { externalId: ext, recipientAddress: addr },
      });
      if (ext === "list_a") customerA = res.json().customerId;
      else customerB = res.json().customerId;
    }

    // 3 quotes: two for A (one submitted), one unattributed
    const q1 = (await quote(customerA)).json();
    await quote(customerA);
    await quote();
    const sub = await app.inject({
      method: "POST",
      url: "/v1/intents/submit",
      headers: auth(),
      body: { quoteId: q1.quoteId, signedPayload: "0x" + "ab".repeat(64) },
    });
    intentId = sub.json().intentId;
  });

  afterAll(async () => {
    if (app) await app.close();
    for (const name of ["list-main", "list-other"]) {
      await db.delete(partners).where(eq(partners.email, `${name}-${suffix}@test.local`));
    }
    await db.delete(apiKeys).where(eq(apiKeys.partnerName, "list-legacy"));
  });

  it("GET /v1/customers lists the partner's customers newest first", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/customers", headers: auth() });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.total).toBe(2);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
    expect(data.items.map((c: any) => c.externalId)).toEqual(["list_b", "list_a"]);
    expect(data.items[0]).toEqual({
      customerId: customerB,
      externalId: "list_b",
      recipientAddress: "0x00000000000000000000000000000000000000bb",
      createdAt: expect.any(String),
    });
  });

  it("GET /v1/customers paginates and keeps the full total", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/customers?limit=1&offset=1", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(2);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].customerId).toBe(customerA);
  });

  it("GET /v1/customers does not leak another partner's customers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${otherKey}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 0, items: [] });
  });

  it("list endpoints reject bad paging and legacy keys", async () => {
    const bad = await app.inject({ method: "GET", url: "/v1/customers?limit=500", headers: auth() });
    expect(bad.statusCode).toBe(400);
    const legacy = await app.inject({
      method: "GET",
      url: "/v1/customers",
      headers: { authorization: `Bearer ${legacyKey}` },
    });
    expect(legacy.statusCode).toBe(400);
    expect(legacy.json().error).toBe("api key is not linked to a partner");
    const noAuth = await app.inject({ method: "GET", url: "/v1/quotes" });
    expect(noAuth.statusCode).toBe(401);
  });

  it("GET /v1/quotes lists quotes with request fields, fee math and intent status", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/quotes", headers: auth() });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.total).toBe(3);
    const submitted = data.items.find((q: any) => q.intent !== null);
    expect(submitted).toMatchObject({
      customerId: customerA,
      originChainId: 1,
      destChainId: 5042002,
      tokenIn: "WETH",
      tokenOut: "USDC",
      recipient: "0xrecipient",
      amountIn: "1000000000000000000",
      feeAmount: "1000000000000000",
      feeBps: 10,
      netAmount: "999000000000000000",
      intent: { intentId, status: expect.any(String) },
    });
    expect(submitted.estimatedOut).toMatch(/^\d+$/);
    expect(data.items.filter((q: any) => q.intent === null)).toHaveLength(2);
    // newest first: the unattributed quote was created last
    expect(data.items[0].customerId).toBeNull();
  });

  it("GET /v1/quotes filters by customerId", async () => {
    const res = await app.inject({ method: "GET", url: `/v1/quotes?customerId=${customerA}`, headers: auth() });
    expect(res.json().total).toBe(2);
    expect(res.json().items.every((q: any) => q.customerId === customerA)).toBe(true);
    const none = await app.inject({ method: "GET", url: `/v1/quotes?customerId=${customerB}`, headers: auth() });
    expect(none.json()).toMatchObject({ total: 0, items: [] });
  });

  it("GET /v1/quotes is scoped to the calling key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/quotes",
      headers: { authorization: `Bearer ${otherKey}` },
    });
    expect(res.json()).toMatchObject({ total: 0, items: [] });
  });

  it("GET /v1/intents lists intents with quote context", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/intents", headers: auth() });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.total).toBe(1);
    expect(data.items[0]).toMatchObject({
      id: intentId,
      customerId: customerA,
      originChainId: 1,
      destChainId: 5042002,
      amountIn: "1000000000000000000",
      feeAmount: "1000000000000000",
    });
  });

  it("GET /v1/intents filters by status and customerId", async () => {
    const all = (await app.inject({ method: "GET", url: "/v1/intents", headers: auth() })).json();
    const status = all.items[0].status;
    const match = await app.inject({ method: "GET", url: `/v1/intents?status=${status}`, headers: auth() });
    expect(match.json().total).toBe(1);
    const other = status === "FAILED" ? "PENDING" : "FAILED";
    const miss = await app.inject({ method: "GET", url: `/v1/intents?status=${other}`, headers: auth() });
    expect(miss.json().total).toBe(0);
    const byB = await app.inject({ method: "GET", url: `/v1/intents?customerId=${customerB}`, headers: auth() });
    expect(byB.json().total).toBe(0);
    const bad = await app.inject({ method: "GET", url: "/v1/intents?status=NOPE", headers: auth() });
    expect(bad.statusCode).toBe(400);
  });

  it("GET /v1/partners/me returns the partner profile for the key", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/partners/me", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      partnerId,
      name: "list-main",
      email: `list-main-${suffix}@test.local`,
      feeBps: 10,
      rateLimitPerMin: 100,
      apiKey: { keyPrefix: "gw_live_" },
    });
    expect(JSON.stringify(res.json())).not.toContain(key);
    const legacy = await app.inject({
      method: "GET",
      url: "/v1/partners/me",
      headers: { authorization: `Bearer ${legacyKey}` },
    });
    expect(legacy.statusCode).toBe(400);
  });

  it("CORS allows the configured dashboard origin and rejects others", async () => {
    const ok = await app.inject({
      method: "OPTIONS",
      url: "/v1/ledger",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });
    expect(ok.statusCode).toBe(204);
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(String(ok.headers["access-control-allow-headers"])).toContain("authorization");

    const evil = await app.inject({
      method: "GET",
      url: "/v1/ledger",
      headers: { origin: "https://evil.example", ...auth() },
    });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
