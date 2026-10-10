import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "./server.js";
import { db } from "./db/index.js";
import { apiKeys, partnerSessions, partners } from "./db/schema.js";
import { generateApiKey } from "./auth/apiKey.js";

describe("dashboard session cookie", () => {
  let app: any;
  let secret: string;
  let partnerId: string;
  const suffix = Date.now();
  const DASH = "http://localhost:5173";

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

  const open = (apiKey: string) =>
    app.inject({ method: "POST", url: "/v1/dashboard/session", body: { apiKey } });
  const sessionCookie = (res: any): string => {
    const c = res.cookies.find((x: any) => x.name === "arc_session");
    expect(c).toBeDefined();
    return c.value;
  };
  const withCookie = (token: string, header = true) => ({
    cookie: `arc_session=${token}`,
    ...(header ? { "x-arc-dashboard": "1" } : {}),
  });
  const me = (token: string, header = true) =>
    app.inject({ method: "GET", url: "/v1/partners/me", headers: withCookie(token, header) });

  beforeAll(async () => {
    app = await buildApp();
    const rl = await app.redis.keys("gateway-rl*");
    if (rl.length) await app.redis.del(...rl);
    const main = await makePartner("sess-main");
    secret = main.rawKey;
    partnerId = main.partnerId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("exchanges a secret key for an httpOnly cookie that authenticates dashboard calls", async () => {
    const res = await open(secret);
    expect(res.statusCode).toBe(200);
    expect(new Date(res.json().expiresAt).getTime()).toBeGreaterThan(Date.now());
    const c = res.cookies.find((x: any) => x.name === "arc_session");
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Lax");
    expect(c.path).toBe("/");
    expect(c.value).toMatch(/^ps_/);
    // Only the hash is stored.
    const rows = await db.select().from(partnerSessions).where(eq(partnerSessions.tokenHash, c.value));
    expect(rows).toHaveLength(0);

    const profile = await me(c.value);
    expect(profile.statusCode).toBe(200);
    expect(profile.json().partnerId).toBe(partnerId);
  });

  it("rejects bad keys, publishable keys and unlinked keys", async () => {
    expect((await open("gw_live_nope")).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/dashboard/session", body: {} })).statusCode).toBe(400);

    const pk = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/publishable",
      headers: { authorization: `Bearer ${secret}` },
      body: { allowedOrigins: ["https://shop.example.com"] },
    });
    expect((await open(pk.json().publishableKey)).statusCode).toBe(403);

    const legacy = generateApiKey();
    await db.insert(apiKeys).values({
      partnerName: "sess-legacy",
      keyPrefix: legacy.keyPrefix,
      keyHash: legacy.keyHash,
      feeBps: 10,
      rateLimitPerMin: 100,
      active: true,
    });
    expect((await open(legacy.rawKey)).statusCode).toBe(400);
  });

  it("requires the x-arc-dashboard header with the cookie (CSRF guard)", async () => {
    const token = sessionCookie(await open(secret));
    const res = await me(token, false);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/x-arc-dashboard/);
    expect((await me("ps_forged")).statusCode).toBe(401);
  });

  it("lets only dashboard origins send credentials", async () => {
    const dash = await app.inject({
      method: "OPTIONS",
      url: "/v1/partners/me",
      headers: { origin: DASH, "access-control-request-method": "GET", "access-control-request-headers": "x-arc-dashboard" },
    });
    expect(dash.headers["access-control-allow-origin"]).toBe(DASH);
    expect(dash.headers["access-control-allow-credentials"]).toBe("true");
    expect(String(dash.headers["access-control-allow-headers"])).toContain("x-arc-dashboard");

    const evil = await app.inject({
      method: "OPTIONS",
      url: "/v1/partners/me",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();

    const widget = await app.inject({
      method: "OPTIONS",
      url: "/v1/quotes",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });
    expect(widget.headers["access-control-allow-origin"]).toBe("https://evil.example");
    expect(widget.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("keeps the session across a rotate and ends it when the key is revoked", async () => {
    const own = await makePartner("sess-rotate");
    const token = sessionCookie(await open(own.rawKey));

    const rotated = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/rotate",
      headers: withCookie(token),
    });
    expect(rotated.statusCode).toBe(201);
    const newKey = rotated.json().apiKey;
    // Same cookie still works, now acting as the new key.
    const keys = await app.inject({ method: "GET", url: "/v1/partners/me/api-keys", headers: withCookie(token) });
    expect(keys.statusCode).toBe(200);
    const current = keys.json().items.find((k: any) => k.current);
    expect(current.id).toBe(rotated.json().key.id);

    // Rotating again from a bearer call revokes the key the session is on, so the session dies.
    const again = await app.inject({
      method: "POST",
      url: "/v1/partners/me/api-keys/rotate",
      headers: { authorization: `Bearer ${newKey}` },
    });
    expect(again.statusCode).toBe(201);
    expect((await me(token)).statusCode).toBe(401);
  });

  it("logout deletes the session and clears the cookie", async () => {
    const token = sessionCookie(await open(secret));
    const res = await app.inject({
      method: "POST",
      url: "/v1/dashboard/session/logout",
      headers: withCookie(token),
    });
    expect(res.statusCode).toBe(200);
    const cleared = res.cookies.find((x: any) => x.name === "arc_session");
    expect(cleared.value).toBe("");
    expect((await me(token)).statusCode).toBe(401);

    // Signed-out logout is a no-op.
    expect((await app.inject({ method: "POST", url: "/v1/dashboard/session/logout" })).statusCode).toBe(200);
  });

  it("prefers the bearer key over the cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/partners/me",
      headers: { authorization: "Bearer gw_live_wrong", cookie: "arc_session=ps_whatever", "x-arc-dashboard": "1" },
    });
    expect(res.statusCode).toBe(401);
  });
});
