import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  PORT: z.coerce.number().int().positive().default(3000),
  ARC_RPC_URL: z.string().url("ARC_RPC_URL must be a valid URL"),
  ARC_CHAIN_ID: z.coerce.number().int().positive().default(5042002),
  LOG_LEVEL: z.string().default("info"),
});

const env = envSchema.parse(process.env);

export const config = {
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  port: env.PORT,
  arcRpcUrl: env.ARC_RPC_URL,
  arcChainId: env.ARC_CHAIN_ID,
  logLevel: env.LOG_LEVEL,
};
