import type { CookieSerializeOptions } from "@fastify/cookie";
import { and, eq, gt } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { apiKeys, partnerSessions } from "../db/schema.js";
import { generateToken, sha256 } from "./customer.js";

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
