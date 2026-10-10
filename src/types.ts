import type { Redis } from "ioredis";
import type { apiKeys, customers } from "./db/schema.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
  interface FastifyContextConfig {
    /** Route accepts publishable (pk_live_) keys from their allowed origins. */
    publishable?: boolean;
  }
  interface FastifyRequest {
    apiKey?: typeof apiKeys.$inferSelect;
    /** Set when requireApiKey authenticated via the dashboard session cookie. */
    partnerSessionId?: string;
    /** Set by requireCustomerSession. */
    customer?: typeof customers.$inferSelect;
    customerSessionId?: string;
  }
}
