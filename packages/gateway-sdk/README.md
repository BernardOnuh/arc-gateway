# stableflowr-sdk

TypeScript client for the Stableflowr API. Charge a price in dollars,
and your customer pays with any mix of tokens from their own wallet (USDC, USDT,
ETH on Ethereum or Base). It settles to you as USDC on ARC. The flow is
non-custodial: funds go straight from the customer's wallet to your payout address.

Full guides: **https://docs.stableflowr.xyz** · API reference: https://api.stableflowr.xyz/docs

- Works in Node 18+, Bun, Deno and browsers (uses `fetch` and Web Crypto)
- ESM and CommonJS, fully typed, no runtime dependencies

```sh
npm install stableflowr-sdk
```

## Quickstart

```ts
import { Stableflowr, checkoutUrl } from "stableflowr-sdk";

const gateway = new Stableflowr({
  apiKey: process.env.STABLEFLOWR_SECRET_KEY, // gw_live_… (server only)
});

// One-time setup: where your USDC lands on ARC.
await gateway.setPayoutAddress("0xYourArcAddress");

// Per order: create a payment and send the customer to checkout.
const payment = await gateway.createPayment({
  amount: "25.00",
  description: "Pro plan, 1 month",
  reference: "order_1042",
});

const url = checkoutUrl({
  paymentId: payment.paymentId,
  publishableKey: process.env.STABLEFLOWR_PUBLISHABLE_KEY!, // pk_live_…
});
// redirect the customer to `url`
```

The client talks to `https://api.stableflowr.xyz` and `checkoutUrl` links to
`https://stableflowr.xyz` by default. Running your own gateway? Pass
`baseUrl` to `new Stableflowr({ baseUrl, apiKey })` and `checkoutBaseUrl` to `checkoutUrl`.

Secret keys (`gw_live_…`) belong on your server only. The browser uses a
publishable key (`pk_live_…`), which only works from the origins you list:

```ts
const pk = await gateway.createPublishableKey({ allowedOrigins: ["https://shop.example.com"] });
```

## Know when you've been paid

### Webhooks (recommended)

```ts
const endpoint = await gateway.createWebhook("https://shop.example.com/hooks/stableflow");
// Store endpoint.secret (whsec_…). It is shown only here.
```

```ts
import express from "express";
import { verifyWebhook } from "stableflowr-sdk";

app.post("/hooks/stableflow", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await verifyWebhook(req.body.toString(), req.header("stableflowr-signature"), process.env.STABLEFLOWR_WEBHOOK_SECRET!);
    if (event.type === "payment.paid") await fulfil(event.data.reference as string);
    res.sendStatus(200);
  } catch {
    res.sendStatus(400); // bad signature or stale timestamp
  }
});
```

Pass the **raw** body. Re-serialized JSON won't match the signature. Events:
`payment.processing`, `payment.paid`, `payment.partially_paid`, `payment.expired`, `ping`.

### Polling (scripts and tests)

```ts
const final = await gateway.waitForPayment(payment.paymentId, {
  onUpdate: (p) => console.log(p.status, p.paidCents),
});
// final.status is "paid", "expired" or "canceled"
```

Settlement on ARC usually takes a few minutes after the customer's transaction
confirms (longer from some chains), so `waitForPayment` polls every 5s for up to
an hour by default.

## Payments

| Method | What it does |
| --- | --- |
| `createPayment({ amount, description?, reference?, customerId?, expiresInMinutes? })` | New checkout for a USD amount (0.50 – 100000.00). Expires after 30 min by default. |
| `getPayment(id)` | Current status, amounts (`paidCents`, `pendingCents`, `remainingCents`) and each part the customer paid (`legs`). |
| `listPayments({ limit?, offset? })` | Your payments, newest first. |
| `waitForPayment(id, options?)` | Polls until paid, expired or canceled. |
| `setPayoutAddress(address)` | ARC address that receives USDC, for payments created afterwards. |

Statuses: `open` → `processing` → `paid`. A payment can also be
`partially_paid`, `expired` or `canceled`. If a payment expires after only part
was paid, `refundOwedCents` and `refunds` tell you whom to refund.

## Errors

Every non-2xx response throws a `GatewayError`:

```ts
import { GatewayError } from "stableflowr-sdk";

try {
  await gateway.createPayment({ amount: "0.10" });
} catch (e) {
  if (e instanceof GatewayError) console.log(e.statusCode, e.body); // 400 { error: "amount must be at least 0.50" }
}
```

## Also included

- Keys: `listApiKeys`, `rotateApiKey`, `createPublishableKey`, `revokeApiKey`
- Webhooks: `createWebhook`, `listWebhooks`, `deleteWebhook`, `testWebhook`, `listWebhookEvents`
- Checkout branding: `getBranding`, `updateBranding`
- Customers and ledger: `createCustomer`, `listCustomers`, `createSetupLink`, `ledger`
- Discovery: `chains`, `tokens`
- `CustomerClient` for end-customer accounts

Every method takes an optional last `apiKey` argument that overrides the
client's key for that call.

## License

ISC
