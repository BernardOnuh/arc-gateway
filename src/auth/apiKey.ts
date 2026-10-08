import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { FastifyRequest, FastifyReply, onRequestHookHandler } from "fastify";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const random = randomBytes(32).toString("base64url");
  const rawKey = `gw_live_${random}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);
  return { rawKey, keyHash, keyPrefix };
}

async function enforcePartnerRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  key: typeof apiKeys.$inferSelect
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
  let matched: typeof apiKeys.$inferSelect | null = null;
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

  if (!(await enforcePartnerRateLimit(request, reply, matched))) {
    return reply;
  }

  request.apiKey = matched;
}

export const requireApiKey: onRequestHookHandler = authenticateApiKey;
