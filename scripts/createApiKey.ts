#!/usr/bin/env tsx
import { db } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { generateApiKey } from "../src/auth/apiKey.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      out[key] = args[i + 1] || "";
      i++;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const partner = args.partner || "test";
  const feeBps = parseInt(args["fee-bps"] || "0");
  const rateLimit = parseInt(args["rate-limit"] || "60");
  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await db.insert(apiKeys).values({
    partnerName: partner,
    keyPrefix,
    keyHash,
    feeBps,
    rateLimitPerMin: rateLimit,
    active: true,
  });
  console.log(rawKey);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
