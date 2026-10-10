import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  PORT: z.coerce.number().int().positive().default(3000),
  ARC_RPC_URL: z.string().url("ARC_RPC_URL must be a valid URL"),
  ARC_CHAIN_ID: z.coerce.number().int().positive().default(5042002),
  /** Liquidity source: "mock" (simulated prices) or "arc" (Circle AppKit live pricing). */
  QUOTE_PROVIDER: z.enum(["mock", "arc"]).default("mock"),
  /** Optional Circle API key for AppKit (shared rate limits apply without one). */
  CIRCLE_API_KEY: z.string().optional(),
  /** Wallet key for the AppKit server-side adapter. Quote estimation needs an "from" account. */
  ARC_SDK_PRIVATE_KEY: z
    .string()
    .optional(),
  /** Default fee applied to new self-serve partners (basis points, 10 = 0.1%). */
  PARTNER_DEFAULT_FEE_BPS: z.coerce.number().int().min(1).max(100).default(10),
  /** Default per-minute rate limit for new self-serve partners. */
  PARTNER_DEFAULT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  /**
   * Comma-separated browser origins allowed to call the API (dashboard, landing).
   * These origins may send the dashboard session cookie. "*" allows any origin
   * for bearer-key calls but turns off cookie sessions (credentials are never
   * allowed for a wildcard).
   */
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** Mark the dashboard session cookie Secure. Defaults to on when NODE_ENV=production. */
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  /** "lax" works when the dashboard and API share a site; "none" (needs Secure) for different sites. */
  SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  LOG_LEVEL: z.string().default("info"),
});

const env = envSchema.parse(process.env);

const sessionCookieSecure =
  env.SESSION_COOKIE_SECURE !== undefined ? env.SESSION_COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
if (env.SESSION_COOKIE_SAMESITE === "none" && !sessionCookieSecure) {
  throw new Error("SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true");
}

export const config = {
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  port: env.PORT,
  arcRpcUrl: env.ARC_RPC_URL,
  arcChainId: env.ARC_CHAIN_ID,
  quoteProvider: env.QUOTE_PROVIDER,
  arcApiKey: env.CIRCLE_API_KEY,
  arcSdkPrivateKey: env.ARC_SDK_PRIVATE_KEY,
  partnerDefaultFeeBps: env.PARTNER_DEFAULT_FEE_BPS,
  partnerDefaultRateLimitPerMin: env.PARTNER_DEFAULT_RATE_LIMIT_PER_MIN,
  corsOrigins: env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  sessionCookieSecure,
  sessionCookieSameSite: env.SESSION_COOKIE_SAMESITE,
  logLevel: env.LOG_LEVEL,
  isTest: process.env.NODE_ENV === "test",
};
