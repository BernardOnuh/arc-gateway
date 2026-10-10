import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyRequest } from "fastify";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { apiKeys, partnerSessions, partners } from "../db/schema.js";
import { dummyPasswordHash, generateToken, sha256, verifyPassword } from "./customer.js";

export const SESSION_COOKIE = "arc_session";
/**
 * Cookie-authenticated requests must carry this header. A cross-site page
 * can't add a custom header without a CORS preflight, which only the
 * dashboard origins pass, so this blocks CSRF even where SameSite doesn't.
 */
export const DASHBOARD_HEADER = "x-arc-dashboard";
export const PARTNER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(maxAgeMs = PARTNER_SESSION_TTL_MS): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: config.sessionCookieSecure,
    sameSite: config.sessionCookieSameSite,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function createPartnerSession(apiKeyId: string): Promise<{ token: string; expiresAt: Date }> {
  const { raw, hash } = generateToken("ps_");
  const expiresAt = new Date(Date.now() + PARTNER_SESSION_TTL_MS);
  await db.insert(partnerSessions).values({ apiKeyId, tokenHash: hash, expiresAt });
  return { token: raw, expiresAt };
}

/** The live session for a cookie value and the still-active key it acts as. */
export async function findPartnerSession(token: string) {
  if (!token.startsWith("ps_")) return null;
  const [row] = await db
    .select({ sessionId: partnerSessions.id, key: apiKeys })
    .from(partnerSessions)
    .innerJoin(apiKeys, eq(apiKeys.id, partnerSessions.apiKeyId))
    .where(
      and(
        eq(partnerSessions.tokenHash, sha256(token)),
        gt(partnerSessions.expiresAt, new Date()),
        eq(apiKeys.active, true)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function deletePartnerSession(token: string): Promise<void> {
  await db.delete(partnerSessions).where(eq(partnerSessions.tokenHash, sha256(token)));
}

/**
 * Email + password sign-in. Returns the partner's newest active secret key
 * (the session acts as it), or null. Unknown emails still pay for a scrypt
 * verify so timing doesn't reveal which emails are registered.
 */
export async function authenticatePartnerPassword(email: string, password: string) {
  const [partner] = await db
    .select()
    .from(partners)
    .where(and(sql`lower(${partners.email}) = ${email}`, eq(partners.active, true)))
    .limit(1);
  const ok = await verifyPassword(password, partner?.passwordHash ?? (await dummyPasswordHash()));
  if (!partner?.passwordHash || !ok) return null;
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.partnerId, partner.id), eq(apiKeys.kind, "secret"), eq(apiKeys.active, true)))
    .orderBy(desc(apiKeys.createdAt))
    .limit(1);
  return key ?? null;
}

/** Same brute-force guard as customer login: 5 failures per email per 15 minutes, then 429. */
const LOGIN_WINDOW_S = 15 * 60;
const LOGIN_MAX_FAILURES = 5;
const failureKey = (email: string) => `gateway:partner-login:${sha256(email)}`;

export async function partnerLoginLocked(request: FastifyRequest, email: string): Promise<boolean> {
  return Number(await request.server.redis.get(failureKey(email))) >= LOGIN_MAX_FAILURES;
}

export async function recordPartnerLoginFailure(request: FastifyRequest, email: string) {
  const n = await request.server.redis.incr(failureKey(email));
  if (n === 1) await request.server.redis.expire(failureKey(email), LOGIN_WINDOW_S);
}

export async function clearPartnerLoginFailures(request: FastifyRequest, email: string) {
  await request.server.redis.del(failureKey(email));
}
