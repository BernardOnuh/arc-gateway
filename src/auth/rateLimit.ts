import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import type { Redis } from "ioredis";

// IP-level guard applied to every route. Per-partner limits live in
// auth/apiKey.ts and use api_keys.rate_limit_per_min.
export function globalRateLimitOptions(redis: Redis, maxPerMinute = 600): RateLimitPluginOptions {
  return {
    redis,
    nameSpace: "gateway-rl",
    keyGenerator: (req) => req.ip,
    max: maxPerMinute,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({ error: "rate_limited", statusCode: 429 }),
  };
}
