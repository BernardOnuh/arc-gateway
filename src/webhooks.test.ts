import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partners, payments, webhookEvents } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";
import { deliverDue, signPayload, webhookUrlProblem } from "./webhooks.js";
import { sweepPayments } from "./routes/payments.js";

const PAYOUT = "0x00000000000000000000000000000000000000aa";
const PAYER = "0x00000000000000000000000000000000000000bb";
const RUN = BigInt(Date.now()) * 1000n + 500n;
const tx = (n: number) => `0x${(RUN + BigInt(n)).toString(16).padStart(64, "0")}`;

interface Received {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

describe("webhooks", () => {
  let app: any;
  let secret: string;
  let partnerId: string;
  let server: Server;
  let url: string;
  const received: Received[] = [];
  let respondWith = 200;
  const suffix = Date.now();
  const as = (key: string) => ({ authorization: `Bearer ${key}` });

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.statusCode = respondWith;
        res.end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hooks`;

    app = await buildApp();
    const [p] = await db
      .insert(partners)
      .values({ name: "hooks-main", email: `hooks-${suffix}@test.local`, feeBps: 10, rateLimitPerMin: 500, payoutAddress: PAYOUT })
      .returning({ id: partners.id });
    partnerId = p.id;
    const k = generateApiKey();
    await db.insert(apiKeys).values({ partnerId, partnerName: "hooks-main", keyPrefix: k.keyPrefix, keyHash: k.keyHash, feeBps: 10, rateLimitPerMin: 500, active: true });
    secret = k.rawKey;
  });

  beforeEach(async () => {
    received.length = 0;
    respondWith = 200;
    const rl = await app.redis.keys("gateway-rl*");
    if (rl.length) await app.redis.del(...rl);
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => server.close(r));
  });

  it("validates endpoint URLs (production rules are stricter)", () => {
    expect(webhookUrlProblem("not a url")).toMatch(/valid URL/);
    expect(webhookUrlProblem("ftp://example.com")).toMatch(/http/);
    expect(webhookUrlProblem("https://user:pw@example.com")).toMatch(/credentials/);
    expect(webhookUrlProblem("http://localhost:4000/hook")).toBeNull(); // allowed outside production
  });

  it("adds an endpoint with a secret, sends a signed test ping, and lists deliveries", async () => {
    const created = await app.inject({ method: "POST", url: "/v1/webhooks", headers: as(secret), body: { url } });
    expect(created.statusCode).toBe(201);
    const hook = created.json();
    expect(hook.secret).toMatch(/^whsec_/);

    const ping = await app.inject({ method: "POST", url: `/v1/webhooks/${hook.id}/test`, headers: as(secret) });
    expect(ping.json()).toMatchObject({ type: "ping", status: "succeeded", lastStatusCode: 200, attempts: 1 });

    const got = received[0];
    const [, t, v1] = String(got.headers["stableflowr-signature"]).match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    expect(signPayload(hook.secret, got.body, Number(t))).toBe(`t=${t},v1=${v1}`);
    expect(got.headers["stableflowr-event"]).toBe("ping");
    expect(JSON.parse(got.body)).toMatchObject({ type: "ping", data: { message: "Hello from Stableflowr" } });

    const events = await app.inject({ method: "GET", url: `/v1/webhooks/${hook.id}/events`, headers: as(secret) });
    expect(events.json().items[0]).toMatchObject({ type: "ping", status: "succeeded" });
  });

  it("emits payment.processing then payment.paid, without branding in the payload", async () => {
    await app.inject({ method: "POST", url: "/v1/webhooks", headers: as(secret), body: { url } });
    const payment = (await app.inject({ method: "POST", url: "/v1/payments", headers: as(secret), body: { amount: "2.00", reference: "ord_hook" } })).json();
    const leg = (
      await app.inject({ method: "POST", url: `/v1/payments/${payment.paymentId}/legs`, headers: as(secret), body: { originChainId: 8453, tokenIn: "USDC", amountIn: "2100000", payer: PAYER } })
    ).json();
    await app.inject({ method: "POST", url: `/v1/payments/${payment.paymentId}/legs/${leg.legId}/submitted`, headers: as(secret), body: { txHash: tx(1) } });
    // Mock provider settles over three polls; the sweep does the polling.
    for (let i = 0; i < 4; i++) await sweepPayments();
    await deliverDue();

    const types = received.map((r) => JSON.parse(r.body)).filter((b) => b.data?.paymentId === payment.paymentId).map((b) => b.type);
    // Every endpoint gets processing before paid.
    expect([...new Set(types)]).toEqual(["payment.processing", "payment.paid"]);
    expect(types.filter((t) => t === "payment.paid").length).toBe(types.filter((t) => t === "payment.processing").length);
    const paid = received.map((r) => JSON.parse(r.body)).find((b) => b.type === "payment.paid");
    expect(paid.data).toMatchObject({ status: "paid", reference: "ord_hook", paidCents: expect.any(Number) });
    expect(paid.data.branding).toBeUndefined();
  });

  it("retries failed deliveries with backoff", async () => {
    respondWith = 500;
    const payment = (await app.inject({ method: "POST", url: "/v1/payments", headers: as(secret), body: { amount: "1.00" } })).json();
    await db.update(payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(payments.id, payment.paymentId));
    await sweepPayments(); // → expired, queues payment.expired
    await deliverDue();
    const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.paymentId, payment.paymentId));
    expect(event).toMatchObject({ type: "payment.expired", status: "pending", attempts: 1, lastStatusCode: 500 });
    expect(event.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 20_000);

    respondWith = 200;
    await db.update(webhookEvents).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(webhookEvents.id, event.id));
    await deliverDue();
    const [retried] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
    expect(retried).toMatchObject({ status: "succeeded", attempts: 2 });
  });

  it("marks a refund owed when a partly paid payment expires", async () => {
    const payment = (await app.inject({ method: "POST", url: "/v1/payments", headers: as(secret), body: { amount: "10.00" } })).json();
    const leg = (
      await app.inject({ method: "POST", url: `/v1/payments/${payment.paymentId}/legs`, headers: as(secret), body: { originChainId: 8453, tokenIn: "USDC", amountIn: "3000000", payer: PAYER } })
    ).json();
    await app.inject({ method: "POST", url: `/v1/payments/${payment.paymentId}/legs/${leg.legId}/submitted`, headers: as(secret), body: { txHash: tx(2) } });
    for (let i = 0; i < 4; i++) await sweepPayments();
    await db.update(payments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(payments.id, payment.paymentId));
    await sweepPayments();

    const view = (await app.inject({ method: "GET", url: `/v1/payments/${payment.paymentId}`, headers: as(secret) })).json();
    expect(view.status).toBe("expired");
    expect(view.refundOwedCents).toBe(view.paidCents);
    expect(view.refundOwedCents).toBeGreaterThan(0);
    expect(view.refunds).toEqual([expect.objectContaining({ payer: PAYER, legId: leg.legId })]);
    await deliverDue();
    const expiredEvent = received.map((r) => JSON.parse(r.body)).find((b) => b.type === "payment.expired" && b.data.paymentId === payment.paymentId);
    expect(expiredEvent.data.refundOwedCents).toBe(view.refundOwedCents);
  });

  it("removes endpoints and keeps them private to the business", async () => {
    const hook = (await app.inject({ method: "POST", url: "/v1/webhooks", headers: as(secret), body: { url } })).json();
    const other = generateApiKey();
    const [op] = await db.insert(partners).values({ name: "hooks-other", email: `hooks-o-${suffix}@test.local`, feeBps: 10, rateLimitPerMin: 100 }).returning({ id: partners.id });
    await db.insert(apiKeys).values({ partnerId: op.id, partnerName: "hooks-other", keyPrefix: other.keyPrefix, keyHash: other.keyHash, feeBps: 10, rateLimitPerMin: 100, active: true });
    expect((await app.inject({ method: "DELETE", url: `/v1/webhooks/${hook.id}`, headers: as(other.rawKey) })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/webhooks/${hook.id}`, headers: as(secret) })).statusCode).toBe(200);
    const list = (await app.inject({ method: "GET", url: "/v1/webhooks", headers: as(secret) })).json();
    expect(list.items.some((w: any) => w.id === hook.id)).toBe(false);
  });
});
