import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgres://gateway:gateway@localhost:5432/gateway",
      REDIS_URL: "redis://localhost:6379",
      PORT: "3000",
      ARC_RPC_URL: "https://rpc.testnet.arc.network",
      ARC_CHAIN_ID: "5042002",
      // Tests never hit Circle: pin the simulated provider whatever .env says.
      QUOTE_PROVIDER: "mock",
      LOG_LEVEL: "info",
    },
  },
});
