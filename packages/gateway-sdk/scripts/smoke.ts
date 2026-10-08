#!/usr/bin/env tsx
import { GatewayClient } from "../src/index.js";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const suffix = Date.now();

async function main() {
  const client = new GatewayClient({ baseUrl });

  const partner = await client.registerPartner({
    partnerName: `SDK Smoke Co ${suffix}`,
    email: `sdk-smoke-${suffix}@test.local`,
  });
  console.log(`registered partner ${partner.partnerId} feeBps=${partner.feeBps}`);

  const keyed = new GatewayClient({ baseUrl, apiKey: partner.apiKey });

  const customer = await keyed.createCustomer({
    externalId: `sdk-user-${suffix}`,
    recipientAddress: "0x4444444444444444444444444444444444444444",
  });
  console.log(`created customer ${customer.customerId}`);

  const quote = await keyed.quote({
    originChainId: 1,
    destChainId: 5042002,
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: "1000000000000000000",
    recipient: "0xRecipient00000000000000000000000000000000",
    slippageBps: 5,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    customerId: customer.customerId,
  });
  console.log(`quote ${quote.quoteId} fee=${quote.feeAmount} feeBps=${quote.feeBps}`);

  const ledger = await keyed.ledger();
  console.log(`ledger tx=${ledger.totals.transactions} feeTotal=${ledger.totals.feeTotal} customers=${ledger.byCustomer.length}`);

  const chains = await client.chains();
  console.log(`chains=${chains.length} tokens(5042)=${(await client.tokens(5042)).length}`);

  console.log("SDK smoke OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});