import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";
import { FastifyPluginAsync } from "fastify";

export const rateLimitPlugin: FastifyPluginAsync<{ redisUrl: string; rateLimitPerMin?: number }> = async (
  fastify,
  opts
) => {
  const redis = new (Redis as any)(opts.redisUrl);
  await fastify.register(rateLimit, {
    redis,
    nameSpace: "gateway-rl",
    keyGenerator: (req: any) => String(req.apiKey?.id || req.ip || "anon"),
    max: 1,
    timeWindow: "1 minute",
    ban: 0,
    errorResponseBuilder: () => ({ error: "rate_limited", statusCode: 429 }),
  });
};
