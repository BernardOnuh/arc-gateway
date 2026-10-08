import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partners } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";
import { hashPassword, verifyPassword } from "./auth/customer.js";

describe("password hashing", () => {
  it("uses salted scrypt and verifies in constant time", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong horse battery", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("customer accounts", () => {
  let app: any;
  let partnerKey: string;
  let partnerId: string;
  let otherKey: string;
  let customerId: string;
  let secondCustomerId: string;
  let session: string;
  const suffix = Date.now();
  const email = `cust-${suffix}@example.com`;
  const PASSWORD = "first passphrase 1";
  const NEW_PASSWORD = "second passphrase 2";
  const bearer = (k: string) => ({ authorization: `Bearer ${k}` });

  async function makePartner(name: string) {
    const [p] = await db
      .insert(partners)
      .values({ name, email: `${name}-${suffix}@test.local`, feeBps: 10, rateLimitPerMin: 200 })
      .returning({ id: partners.id });
    const k = generateApiKey();
    await db.insert(apiKeys).values({
      partnerId: p.id,
      partnerName: name,
      keyPrefix: k.keyPrefix,
      keyHash: k.keyHash,
      feeBps: 10,
      rateLimitPerMin: 200,
      active: true,
    });
    return { partnerId: p.id, rawKey: k.rawKey };
  }

  async function addCustomer(key: string, externalId: string) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/customers",
      headers: bearer(key),
      body: { externalId, recipientAddress: "0x00000000000000000000000000000000000000c1" },
    });
    return res.json().customerId as string;
  }

  const setupLink = (key: string, id: string) =>
    app.inject({ method: "POST", url: `/v1/customers/${id}/setup-link`, headers: bearer(key) });
  const setup = (token: string, body: Record<string, unknown> = {}) =>
    app.inject({ method: "POST", url: "/v1/customer-auth/setup", body: { token, email, password: PASSWORD, ...body } });
  const login = (password: string, who = email) =>
    app.inject({ method: "POST", url: "/v1/customer-auth/login", body: { partnerId, email: who, password } });

  beforeAll(async () => {
    app = await buildApp();
    const rl = await app.redis.keys("gateway-rl*");
    if (rl.length) await app.redis.del(...rl);
    const main = await makePartner("acct-main");
    partnerKey = main.rawKey;
    partnerId = main.partnerId;
    otherKey = (await makePartner("acct-other")).rawKey;
    customerId = await addCustomer(partnerKey, "acct_user_1");
    secondCustomerId = await addCustomer(partnerKey, "acct_user_2");
  });

  afterAll(async () => {
    const lock = await app.redis.keys(`gateway:cust-login:${partnerId}:*`);
    if (lock.length) await app.redis.del(...lock);
    await app.close();
  });

  it("issues setup links only for the partner's own customers", async () => {
    const foreign = await setupLink(otherKey, customerId);
    expect(foreign.statusCode).toBe(404);
    const res = await setupLink(partnerKey, customerId);
    expect(res.statusCode).toBe(201);
    expect(res.json().token).toMatch(/^cst_/);
    expect(new Date(res.json().expiresAt).getTime()).toBeGreaterThan(Date.now() + 71 * 3600 * 1000);
  });

  it("sets up the account once per token, and newer links replace older ones", async () => {
    const older = (await setupLink(partnerKey, customerId)).json().token;
    const newer = (await setupLink(partnerKey, customerId)).json().token;
    expect((await setup(older)).statusCode).toBe(400);

    const weak = await setup(newer, { password: "short" });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error).toContain("at least 10 characters");

    const res = await setup(newer, { email: `  ${email.toUpperCase()} ` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessionToken).toMatch(/^cs_/);
    expect(body.account).toMatchObject({ customerId, partnerId, partnerName: "acct-main", email, payoutsEnabled: false });
    session = body.sessionToken;

    expect((await setup(newer)).statusCode).toBe(400);
  });

  it("shows account status to the partner without exposing the hash", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/customers", headers: bearer(partnerKey) });
    const row = res.json().items.find((c: { customerId: string }) => c.customerId === customerId);
    expect(row).toMatchObject({ email, hasPassword: true, payoutWallet: null });
    expect(JSON.stringify(res.json())).not.toContain("scrypt");
  });

  it("rejects an email another customer of the partner already uses", async () => {
    const token = (await setupLink(partnerKey, secondCustomerId)).json().token;
    const res = await setup(token);
    expect(res.statusCode).toBe(409);
    // The failed attempt didn't burn the token.
    expect((await setup(token, { email: `other-${email}` })).statusCode).toBe(200);
  });

  it("reads the account with a session and rejects anything else", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer(session) })).json().email).toBe(email);
    expect((await app.inject({ method: "GET", url: "/v1/customer/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer(partnerKey) })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer("cs_nope") })).statusCode).toBe(401);
    // A customer session is not a partner key.
    expect((await app.inject({ method: "GET", url: "/v1/ledger", headers: bearer(session) })).statusCode).toBe(401);
  });

  it("stores a payout wallet on a supported chain", async () => {
    const bad = await app.inject({
      method: "POST",
      url: "/v1/customer/me/wallet",
      headers: bearer(session),
      body: { address: "0x123", chainId: 5042 },
    });
    expect(bad.statusCode).toBe(400);
    const unsupported = await app.inject({
      method: "POST",
      url: "/v1/customer/me/wallet",
      headers: bearer(session),
      body: { address: "0x00000000000000000000000000000000000000d1", chainId: 999 },
    });
    expect(unsupported.statusCode).toBe(400);
    const ok = await app.inject({
      method: "POST",
      url: "/v1/customer/me/wallet",
      headers: bearer(session),
      body: { address: "0x00000000000000000000000000000000000000d1", chainId: 5042 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ payoutWallet: "0x00000000000000000000000000000000000000d1", payoutChainId: 5042, payoutsEnabled: false });
  });

  it("logs in with the right password only, without revealing which part was wrong", async () => {
    const wrong = await login("not the password");
    const unknown = await login(PASSWORD, `nobody-${email}`);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error).toBe(unknown.json().error);
    const ok = await login(PASSWORD);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().account.payoutChainId).toBe(5042);
  });

  it("changes the password, signing out other sessions", async () => {
    const other = (await login(PASSWORD)).json().sessionToken;
    const wrongCurrent = await app.inject({
      method: "POST",
      url: "/v1/customer/me/password",
      headers: bearer(session),
      body: { currentPassword: "nope nope nope", newPassword: NEW_PASSWORD },
    });
    expect(wrongCurrent.statusCode).toBe(400);
    const ok = await app.inject({
      method: "POST",
      url: "/v1/customer/me/password",
      headers: bearer(session),
      body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer(other) })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer(session) })).statusCode).toBe(200);
    expect((await login(PASSWORD)).statusCode).toBe(401);
    expect((await login(NEW_PASSWORD)).statusCode).toBe(200);
  });

  it("logs out", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/customer-auth/logout", headers: bearer(session) });
    expect(res.json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: "/v1/customer/me", headers: bearer(session) })).statusCode).toBe(401);
  });

  it("locks an account after 5 failed logins", async () => {
    const lockEmail = `other-${email}`;
    for (let i = 0; i < 5; i++) expect((await login("wrong password!", lockEmail)).statusCode).toBe(401);
    const locked = await login(PASSWORD, lockEmail);
    expect(locked.statusCode).toBe(429);
    // Other accounts are unaffected.
    expect((await login(NEW_PASSWORD)).statusCode).toBe(200);
  });

  it("is off-limits to publishable keys", async () => {
    const pk = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/publishable",
      headers: bearer(partnerKey),
      body: { allowedOrigins: ["https://shop.example.com"] },
    });
    const res = await app.inject({
      method: "POST",
      url: `/v1/customers/${customerId}/setup-link`,
      headers: { ...bearer(pk.json().publishableKey), origin: "https://shop.example.com" },
    });
    expect(res.statusCode).toBe(403);
  });
});
