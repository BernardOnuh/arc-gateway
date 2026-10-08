import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, isWidgetRoute } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partners } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";

const SHOP = "https://shop.example.com";

describe("api keys: publishable keys, rotate, revoke, partner scope", () => {
  let app: any;
  let secret: string;
  let partnerId: string;
  let otherSecret: string;
  let legacyKey: string;
  let pk: string;
  let pkId: string;
  const suffix = Date.now();
  const bearer = (k: string) => ({ authorization: `Bearer ${k}` });

  async function makePartner(name: string) {
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
      last4: k.last4,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    return { partnerId: p.id, rawKey: k.rawKey };
  }

  const quoteBody = {
    originChainId: 1,
    destChainId: 5042002,
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: "1000000000000000000",
    recipient: "0xrecipient",
    slippageBps: 5,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeAll(async () => {
    app = await buildApp();
    // Rotate/create are rate limited per IP in shared Redis.
    const rlKeys = await app.redis.keys("gateway-rl*");
    if (rlKeys.length > 0) await app.redis.del(...rlKeys);
    const main = await makePartner("keys-main");
    secret = main.rawKey;
    partnerId = main.partnerId;
    otherSecret = (await makePartner("keys-other")).rawKey;
    const legacy = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "keys-legacy",
      keyPrefix: legacy.keyPrefix,
      keyHash: legacy.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    legacyKey = legacy.rawKey;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a publishable key with an origin allowlist", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/publishable",
      headers: bearer(secret),
      body: { allowedOrigins: [SHOP, SHOP] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.kind).toBe("publishable");
    expect(body.publishableKey).toMatch(/^pk_live_/);
    expect(body.last4).toBe(body.publishableKey.slice(-4));
    expect(body.allowedOrigins).toEqual([SHOP]);
    expect(body.current).toBe(false);
    pk = body.publishableKey;
    pkId = body.id;
  });

  it("rejects malformed origins", async () => {
    for (const origin of ["https://shop.example.com/", "https://shop.example.com/path", "shop.example.com", "ftp://x.y"]) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/partners/me/api-keys/publishable",
        headers: bearer(secret),
        body: { allowedOrigins: [origin] },
      });
      expect(res.statusCode, origin).toBe(400);
    }
    const empty = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/publishable",
      headers: bearer(secret),
      body: { allowedOrigins: [] },
    });
    expect(empty.statusCode).toBe(400);
  });

  it("lets a publishable key quote from an allowed origin only", async () => {
    const ok = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { ...bearer(pk), origin: SHOP },
      body: quoteBody,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().feeBps).toBe(10);

    const wrongOrigin = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { ...bearer(pk), origin: "https://evil.example" },
      body: quoteBody,
    });
    expect(wrongOrigin.statusCode).toBe(403);
    expect(wrongOrigin.json().error).toBe("origin not allowed for this publishable key");

    const noOrigin = await app.inject({ method: "POST", url: "/v1/quotes", headers: bearer(pk), body: quoteBody });
    expect(noOrigin.statusCode).toBe(403);
  });

  it("blocks publishable keys from submitting intents and from secret-only endpoints", async () => {
    const quote = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { ...bearer(pk), origin: SHOP },
      body: quoteBody,
    });
    for (const [method, url, body] of [
      ["POST", "/v1/intents/submit", { quoteId: quote.json().quoteId, signedPayload: "0xabc" }],
      ["GET", "/v1/ledger", undefined],
      ["GET", "/v1/partners/me", undefined],
      ["GET", "/v1/partners/me/api-keys", undefined],
      ["POST", "/v1/partners/me/api-keys/rotate", undefined],
      ["POST", "/v1/customers", { externalId: "x", recipientAddress: "0x0000000000000000000000000000000000000001" }],
      ["GET", "/v1/quotes", undefined],
    ] as const) {
      const res = await app.inject({ method, url, headers: { ...bearer(pk), origin: SHOP }, body });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it("shares quotes, intents and ledger across the partner's keys", async () => {
    // The widget quotes with the publishable key; the partner's server submits with the secret key.
    const quote = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { ...bearer(pk), origin: SHOP },
      body: quoteBody,
    });
    const quoteId = quote.json().quoteId;
    const submit = await app.inject({
      method: "POST",
      url: "/v1/intents/submit",
      headers: bearer(secret),
      body: { quoteId, signedPayload: "0xabc" },
    });
    expect(submit.statusCode).toBe(200);
    const intentId = submit.json().intentId;

    // The widget can then poll status with the publishable key.
    const status = await app.inject({
      method: "GET",
      url: `/v1/intents/${intentId}`,
      headers: { ...bearer(pk), origin: SHOP },
    });
    expect(status.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/v1/quotes", headers: bearer(secret) });
    expect(list.json().items.some((q: { quoteId: string }) => q.quoteId === quoteId)).toBe(true);
    const ledger = await app.inject({ method: "GET", url: "/v1/ledger", headers: bearer(secret) });
    expect(ledger.json().totals.transactions).toBeGreaterThanOrEqual(3);

    // Another partner sees none of it.
    const foreign = await app.inject({ method: "GET", url: `/v1/intents/${intentId}`, headers: bearer(otherSecret) });
    expect(foreign.statusCode).toBe(404);
    const foreignSubmit = await app.inject({
      method: "POST",
      url: "/v1/intents/submit",
      headers: bearer(otherSecret),
      body: { quoteId, signedPayload: "0xabc" },
    });
    expect(foreignSubmit.statusCode).toBe(400);
  });

  it("lists keys without exposing the secret", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/partners/me/api-keys", headers: bearer(secret) });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(2);
    const sk = items.find((k: { kind: string }) => k.kind === "secret");
    expect(sk).toMatchObject({ current: true, active: true, publishableKey: null, last4: secret.slice(-4) });
    expect(JSON.stringify(res.json())).not.toContain(secret);
    expect(items.find((k: { kind: string }) => k.kind === "publishable").publishableKey).toBe(pk);
  });

  it("revokes a publishable key, idempotently, but never the calling key", async () => {
    const self = await app.inject({
      method: "GET",
      url: "/v1/partners/me/api-keys",
      headers: bearer(secret),
    });
    const selfId = self.json().items.find((k: { current: boolean }) => k.current).id;
    const own = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/revoke",
      headers: bearer(secret),
      body: { keyId: selfId },
    });
    expect(own.statusCode).toBe(400);

    const foreign = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/revoke",
      headers: bearer(otherSecret),
      body: { keyId: pkId },
    });
    expect(foreign.statusCode).toBe(404);

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/partners/me/api-keys/revoke",
        headers: bearer(secret),
        body: { keyId: pkId },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ active: false, revokedAt: expect.any(String) });
    }
    const after = await app.inject({
      method: "POST",
      url: "/v1/quotes",
      headers: { ...bearer(pk), origin: SHOP },
      body: quoteBody,
    });
    expect(after.statusCode).toBe(401);
  });

  it("rotates the secret key, keeping history and revoking the old key", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/partners/me/api-keys/rotate", headers: bearer(secret) });
    expect(res.statusCode).toBe(201);
    const { apiKey, key } = res.json();
    expect(apiKey).toMatch(/^gw_live_/);
    expect(key).toMatchObject({ kind: "secret", active: true, last4: apiKey.slice(-4) });

    expect((await app.inject({ method: "GET", url: "/v1/partners/me", headers: bearer(secret) })).statusCode).toBe(401);
    const me = await app.inject({ method: "GET", url: "/v1/partners/me", headers: bearer(apiKey) });
    expect(me.statusCode).toBe(200);
    expect(me.json().partnerId).toBe(partnerId);

    const ledger = await app.inject({ method: "GET", url: "/v1/ledger", headers: bearer(apiKey) });
    expect(ledger.json().totals.transactions).toBeGreaterThanOrEqual(3);

    const again = await app.inject({ method: "POST", url: "/v1/partners/me/api-keys/rotate", headers: bearer(secret) });
    expect(again.statusCode).toBe(401);
    secret = apiKey;
  });

  it("refuses key management for legacy keys", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/partners/me/api-keys", headers: bearer(legacyKey) });
    expect(res.statusCode).toBe(400);
  });

  it("answers CORS for widget routes from any origin, and dashboard routes only from CORS_ORIGINS", async () => {
    const widget = await app.inject({
      method: "OPTIONS",
      url: "/v1/quotes",
      headers: { origin: SHOP, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    expect(widget.statusCode).toBe(204);
    expect(widget.headers["access-control-allow-origin"]).toBe(SHOP);

    const listPreflight = await app.inject({
      method: "OPTIONS",
      url: "/v1/quotes",
      headers: { origin: SHOP, "access-control-request-method": "GET" },
    });
    expect(listPreflight.headers["access-control-allow-origin"]).toBeUndefined();

    const keysPreflight = await app.inject({
      method: "OPTIONS",
      url: "/v1/partners/me/api-keys/rotate",
      headers: { origin: SHOP, "access-control-request-method": "POST" },
    });
    expect(keysPreflight.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("classifies widget routes", () => {
    expect(isWidgetRoute("GET", "/v1/chains")).toBe(true);
    expect(isWidgetRoute("GET", "/v1/tokens?chainId=1")).toBe(true);
    expect(isWidgetRoute("POST", "/v1/quotes")).toBe(true);
    expect(isWidgetRoute("GET", "/v1/intents/abc")).toBe(true);
    expect(isWidgetRoute("GET", "/v1/intents")).toBe(false);
    expect(isWidgetRoute("POST", "/v1/intents/submit")).toBe(false);
    expect(isWidgetRoute("GET", "/v1/quotes")).toBe(false);
  });
});
