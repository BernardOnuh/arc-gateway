import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partners } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";

const SHOP = "https://shop.example.com";
const PAYOUT = "0x00000000000000000000000000000000000000aa";
const PAYER = "0x00000000000000000000000000000000000000bb";
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

describe("checkout payments", () => {
  let app: any;
  let secret: string;
  let pk: string;
  let otherSecret: string;
  const suffix = Date.now();

  async function makePartner(name: string) {
    const [p] = await db
      .insert(partners)
      .values({ name, email: `${name}-${suffix}@test.local`, feeBps: 10, rateLimitPerMin: 500 })
      .returning({ id: partners.id });
    const k = generateApiKey();
    await db.insert(apiKeys).values({
      partnerId: p.id,
      partnerName: name,
      keyPrefix: k.keyPrefix,
      keyHash: k.keyHash,
      last4: k.last4,
      feeBps: 10,
      rateLimitPerMin: 500,
      active: true,
    });
    return k.rawKey;
  }

  const as = (key: string, origin?: string) => ({ authorization: `Bearer ${key}`, ...(origin ? { origin } : {}) });
  const createPayment = (body: Record<string, unknown>, key = secret) =>
    app.inject({ method: "POST", url: "/v1/payments", headers: as(key), body });
  const getPayment = (id: string, key = pk) =>
    app.inject({ method: "GET", url: `/v1/payments/${id}`, headers: as(key, SHOP) });
  const addLeg = (id: string, body: Record<string, unknown>, key = pk) =>
    app.inject({ method: "POST", url: `/v1/payments/${id}/legs`, headers: as(key, SHOP), body });
  const submitted = (id: string, legId: string, txHash: string) =>
    app.inject({ method: "POST", url: `/v1/payments/${id}/legs/${legId}/submitted`, headers: as(pk, SHOP), body: { txHash } });

  /** The mock provider advances one status per poll: PENDING → ORIGIN_CONFIRMED → FILLED → EXECUTED_ON_ARC. */
  async function pollUntil(id: string, status: string) {
    for (let i = 0; i < 6; i++) {
      const res = await getPayment(id);
      if (res.json().status === status) return res.json();
    }
    throw new Error(`payment never reached ${status}`);
  }

  beforeAll(async () => {
    app = await buildApp();
    const rl = await app.redis.keys("gateway-rl*");
    if (rl.length) await app.redis.del(...rl);
    secret = await makePartner("pay-main");
    otherSecret = await makePartner("pay-other");
    const created = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/publishable",
      headers: as(secret),
      body: { allowedOrigins: [SHOP] },
    });
    pk = created.json().publishableKey;
  });

  afterAll(async () => {
    await app.close();
  });

  it("needs a payout address before payments can be created", async () => {
    const res = await createPayment({ amount: "10.00" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/payout address/);

    const bad = await app.inject({ method: "POST", url: "/v1/partners/me/payout", headers: as(secret), body: { payoutAddress: "0x12" } });
    expect(bad.statusCode).toBe(400);
    const set = await app.inject({ method: "POST", url: "/v1/partners/me/payout", headers: as(secret), body: { payoutAddress: PAYOUT.toUpperCase().replace("0X", "0x") } });
    expect(set.statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/v1/partners/me", headers: as(secret) });
    expect(me.json().payoutAddress).toBe(PAYOUT);
  });

  it("creates a payment in cents and validates the amount", async () => {
    expect((await createPayment({ amount: "abc" })).statusCode).toBe(400);
    expect((await createPayment({ amount: "0.10" })).statusCode).toBe(400);
    const res = await createPayment({ amount: "10.5", description: "Pro plan", reference: "order_1" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      amountCents: 1050,
      status: "open",
      remainingCents: 1050,
      description: "Pro plan",
      reference: "order_1",
      merchantName: "pay-main",
      payoutAddress: PAYOUT,
      legs: [],
    });
  });

  it("publishable keys can't create payments", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/payments", headers: as(pk, SHOP), body: { amount: "5" } });
    expect(res.statusCode).toBe(403);
  });

  it("serves prices for showing balances in dollars", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/prices", headers: as(pk, SHOP) });
    expect(res.statusCode).toBe(200);
    const usdcBase = res.json().items.find((i: any) => i.chainId === 8453 && i.symbol === "USDC");
    expect(usdcBase.priceUsd).toBe(1);
    expect(res.json().items.every((i: any) => i.chainId !== 5042)).toBe(true);
  });

  it("pays $10 with two tokens: legs are priced, reported, tracked, and roll up to paid", async () => {
    const payment = (await createPayment({ amount: "10.00" })).json();

    // $5 of USDC on Base (6 decimals) and $5.10 of ETH on Ethereum (0.00204 ETH at the reference $2,500).
    const legA = await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "5100000", payer: PAYER });
    expect(legA.statusCode).toBe(201);
    expect(legA.json()).toMatchObject({ status: "QUOTED", token: { symbol: "USDC", decimals: 6 }, payer: PAYER });
    expect(legA.json().valueCents).toBeGreaterThanOrEqual(500);
    const legB = await addLeg(payment.paymentId, { originChainId: 1, tokenIn: "ETH", amountIn: "2040000000000000", payer: PAYER });
    expect(legB.statusCode).toBe(201);

    const quoted = (await getPayment(payment.paymentId)).json();
    expect(quoted.status).toBe("open");
    expect(quoted.legs).toHaveLength(2);

    expect((await submitted(payment.paymentId, legA.json().legId, tx(1))).statusCode).toBe(200);
    // Idempotent for the same hash, conflict for a different one.
    expect((await submitted(payment.paymentId, legA.json().legId, tx(1))).statusCode).toBe(200);
    expect((await submitted(payment.paymentId, legA.json().legId, tx(9))).statusCode).toBe(409);
    expect((await submitted(payment.paymentId, legB.json().legId, tx(2))).statusCode).toBe(200);

    const processing = (await getPayment(payment.paymentId)).json();
    expect(processing.status).toBe("processing");
    expect(processing.pendingCents).toBeGreaterThan(0);

    const paid = await pollUntil(payment.paymentId, "paid");
    expect(paid.paidCents).toBeGreaterThanOrEqual(1000);
    expect(paid.remainingCents).toBe(0);
    expect(paid.paidAt).not.toBeNull();
    expect(paid.legs.every((l: any) => l.status === "EXECUTED_ON_ARC")).toBe(true);

    // Paid payments take no more legs.
    expect((await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "1000000", payer: PAYER })).statusCode).toBe(409);
  });

  it("is partially paid when legs settle short, and the remainder can be covered", async () => {
    const payment = (await createPayment({ amount: "10.00" })).json();
    const small = (await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "4000000", payer: PAYER })).json();
    await submitted(payment.paymentId, small.legId, tx(3));
    const partial = await pollUntil(payment.paymentId, "partially_paid");
    expect(partial.remainingCents).toBe(1000 - partial.paidCents);

    const rest = (await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "6500000", payer: PAYER })).json();
    await submitted(payment.paymentId, rest.legId, tx(4));
    await pollUntil(payment.paymentId, "paid");
  });

  it("rejects a transaction hash reused across payments", async () => {
    const payment = (await createPayment({ amount: "1.00" })).json();
    const leg = (await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "1100000", payer: PAYER })).json();
    const res = await submitted(payment.paymentId, leg.legId, tx(1));
    expect(res.statusCode).toBe(409);
  });

  it("validates legs: unknown token, ARC as origin, bad payer", async () => {
    const payment = (await createPayment({ amount: "3.00" })).json();
    expect((await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "NOPE", amountIn: "1", payer: PAYER })).statusCode).toBe(400);
    expect((await addLeg(payment.paymentId, { originChainId: 5042, tokenIn: "USDC", amountIn: "1", payer: PAYER })).statusCode).toBe(400);
    expect((await addLeg(payment.paymentId, { originChainId: 8453, tokenIn: "USDC", amountIn: "1", payer: "0x1" })).statusCode).toBe(400);
  });

  it("keeps each business's payments private", async () => {
    const payment = (await createPayment({ amount: "2.00" })).json();
    const res = await app.inject({ method: "GET", url: `/v1/payments/${payment.paymentId}`, headers: as(otherSecret) });
    expect(res.statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/payments/not-a-uuid", headers: as(secret) })).statusCode).toBe(404);
  });

  it("lists payments for the dashboard", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/payments?limit=2", headers: as(secret) });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(2);
    expect(res.json().total).toBeGreaterThanOrEqual(5);
  });

  it("answers checkout CORS from any site", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/payments/abc/legs",
      headers: { origin: "https://anywhere.example", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("https://anywhere.example");
  });
});
