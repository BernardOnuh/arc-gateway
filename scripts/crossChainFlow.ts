#!/usr/bin/env tsx
import { db } from "../src/db/index.js";
import { apiKeys } from "../src/db/schema.js";
import { generateApiKey } from "../src/auth/apiKey.js";
import { eq } from "drizzle-orm";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ARC_ID = 5042002;

// token symbols per source chain -> destination token on Arc
const ROUTES = [
  { originChainId: 1, tokenIn: "WETH", tokenOut: "USDC", label: "Ethereum (WETH) -> Arc (USDC)" },
  { originChainId: 56, tokenIn: "WBNB", tokenOut: "USDC", label: "BNB Chain (WBNB) -> Arc (USDC)" },
  { originChainId: 8453, tokenIn: "WETH", tokenOut: "USDC", label: "Base (WETH) -> Arc (USDC)" },
  { originChainId: 4663, tokenIn: "WETH", tokenOut: "USDC", label: "Robinhood (WETH) -> Arc (USDC)" },
];

async function createDemoKey(partner: string): Promise<string> {
  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await db.insert(apiKeys).values({
    partnerName: partner,
    keyPrefix,
    keyHash,
    feeBps: 10,
    rateLimitPerMin: 100,
    active: true,
  });
  return rawKey;
}

async function main() {
  const chains = (await (await fetch(`${BASE}/v1/chains`)).json()) as any[];
  console.log("Active chains:");
  for (const c of chains) {
    console.log(`  ${c.name} (${c.id})  rpc=${c.rpcUrl}`);
  }
  console.log();

  const key = await createDemoKey("crosschain-demo");
  const auth = { authorization: `Bearer ${key}` };

  for (const route of ROUTES) {
    const quoteBody = {
      originChainId: route.originChainId,
      destChainId: ARC_ID,
      tokenIn: route.tokenIn,
      tokenOut: route.tokenOut,
      amountIn: "1000000000000000000", // 1 unit (WETH/WBNB are 18-decimals)
      recipient: "0xrecipient",
      slippageBps: 50,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const res = await fetch(`${BASE}/v1/quotes`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify(quoteBody),
    });
    const quote = (await res.json()) as any;
    if (!res.ok) {
      console.log(`${route.label}\n  FAILED: ${JSON.stringify(quote)}`);
      continue;
    }
    console.log(
      `${route.label}\n  amountIn=${quote.amountIn} fee=${quote.feeAmount} (${quote.feeBps} bps) ` +
        `net=${quote.netAmount}\n  estimatedOut=${quote.estimatedOut} minOut=${quote.minOut}\n`
    );
  }

  // Take the ETH route end-to-end: submit + poll through the full lifecycle
  const quoteBody = {
    originChainId: 1,
    destChainId: ARC_ID,
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: "1000000000000000000",
    recipient: "0xrecipient",
    slippageBps: 50,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const q = (await (await fetch(`${BASE}/v1/quotes`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(quoteBody),
  })).json()) as any;

  const s = (await (await fetch(`${BASE}/v1/intents/submit`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ quoteId: q.quoteId, signedPayload: "0x" + "ab".repeat(64) }),
  })).json()) as any;
  console.log(`Submitted intent ${s.intentId}`);

  for (let i = 1; i <= 3; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const intent = (await (await fetch(`${BASE}/v1/intents/${s.intentId}`, { headers: auth })).json()) as any;
    console.log(
      `poll ${i}: status=${intent.status} originTx=${intent.originTx} destTx=${intent.destTx}`
    );
  }

  await db.delete(apiKeys).where(eq(apiKeys.partnerName, "crosschain-demo"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});