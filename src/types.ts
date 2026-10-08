import type { Redis } from "ioredis";
import type { apiKeys } from "./db/schema.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
  interface FastifyRequest {
    apiKey?: typeof apiKeys.$inferSelect;
  }
}
