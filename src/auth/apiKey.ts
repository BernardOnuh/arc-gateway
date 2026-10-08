import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { FastifyRequest, FastifyReply, onRequestHookHandler } from "fastify";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq, and, inArray, type AnyColumn, type SQL } from "drizzle-orm";

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type ApiKeyKind = "secret" | "publishable";

const KEY_PREFIX: Record<ApiKeyKind, string> = { secret: "gw_live_", publishable: "pk_live_" };

export function generateApiKey(kind: ApiKeyKind = "secret"): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
  last4: string;
} {
  const random = randomBytes(32).toString("base64url");
  const rawKey = `${KEY_PREFIX[kind]}${random}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);
  return { rawKey, keyHash, keyPrefix, last4: rawKey.slice(-4) };
}

/**
 * Rows created by any key of the caller's partner (secret or publishable,
 * current or rotated-out). Legacy keys without a partner see only their own rows.
 */
export function ownedByCaller(column: AnyColumn, key: ApiKeyRow): SQL {
  if (!key.partnerId) return eq(column, key.id);
  return inArray(
    column,
    db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.partnerId, key.partnerId))
  );
}

/**
 * Publishable keys run in browsers on partner sites, so they may only call
 * routes marked `config: { publishable: true }`, and only from an allowed Origin.
 */
function checkPublishable(request: FastifyRequest, reply: FastifyReply, key: ApiKeyRow): boolean {
  if (key.kind !== "publishable") return true;
  if (!request.routeOptions.config.publishable) {
    reply.code(403).send({ error: "publishable keys cannot access this endpoint; use your secret key server-side" });
    return false;
  }
  const origin = request.headers.origin;
  if (!origin || !(key.allowedOrigins ?? []).includes(origin)) {
    reply.code(403).send({ error: "origin not allowed for this publishable key" });
    return false;
  }
  return true;
}

async function enforcePartnerRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  key: ApiKeyRow
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60_000);
  const redisKey = `gateway:partner-rl:${key.id}:${bucket}`;
  const count = await request.server.redis.incr(redisKey);
  if (count === 1) {
    await request.server.redis.expire(redisKey, 120);
  }
  if (count > key.rateLimitPerMin) {
    reply.code(429).send({ error: "rate_limited", statusCode: 429 });
    return false;
  }
  return true;
}

export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const token = auth.substring("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const prefix = token.slice(0, 8);
  const results = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.active, true)));
  if (results.length === 0) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const computed = createHash("sha256").update(token).digest("hex");
  let matched: ApiKeyRow | null = null;
  for (const key of results) {
    const stored = Buffer.from(key.keyHash);
    const calc = Buffer.from(computed);
    if (stored.length === calc.length && timingSafeEqual(stored, calc)) {
      matched = key;
      break;
    }
  }
  if (!matched) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  if (!checkPublishable(request, reply, matched)) {
    return reply;
  }

  if (!(await enforcePartnerRateLimit(request, reply, matched))) {
    return reply;
  }

  request.apiKey = matched;
}

export const requireApiKey: onRequestHookHandler = authenticateApiKey;
