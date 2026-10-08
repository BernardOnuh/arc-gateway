# @arc/widget

Embeddable ARC Gateway swap form. Your customer picks a network, token and amount, and sees a live quote with your fee. Your **server** then submits it with your secret key. The widget tracks the intent until it settles on ARC.

## Security model

- The widget uses a **publishable key** (`pk_live_…`, created in the dashboard under Settings). It can only create quotes and read intent status, and only from the websites you list on the key.
- It **cannot submit intents**. Submitting spends funds, so it must come from your server with your secret `gw_live_` key. You pass a `submitIntent` callback that calls your server.
- Never put your secret key in a browser.

## React

```tsx
import { ArcSwapWidget } from "@arc/widget";

<ArcSwapWidget
  publishableKey="pk_live_…"
  baseUrl="https://gateway.example.com"
  recipient={customer.wallet}        // optional, locks the receiving address
  customerId={customer.arcCustomerId} // optional, attributes revenue
  submitIntent={(quote) =>
    fetch("/api/arc/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteId: quote.quoteId }),
    }).then((r) => r.json()) // must resolve to { intentId }
  }
  onIntent={(intent) => console.log(intent.status)} // EXECUTED_ON_ARC | FAILED | REFUNDED
/>
```

Without `submitIntent`, the widget runs in quote-only preview mode.

Props: `publishableKey`, `baseUrl`, `originChainId`, `destChainId`, `recipient`, `customerId`, `slippageBps` (default 50), `submitIntent`, `onQuote`, `onStatus`, `onIntent`, `onError`, `pollIntervalMs` (default 3000).

## Any website (web component)

`pnpm --filter @arc/widget build` writes `dist/standalone/arc-widget.iife.js` (React bundled, about 50 kB gzipped). Serve it from your site:

```html
<script src="/arc-widget.iife.js"></script>
<arc-swap-widget publishable-key="pk_live_…" base-url="https://gateway.example.com"></arc-swap-widget>
<script>
  const w = document.querySelector("arc-swap-widget");
  w.submitIntent = (quote) => fetch("/api/arc/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: quote.quoteId }) }).then((r) => r.json());
  w.addEventListener("arc-intent", (e) => console.log(e.detail.status));
</script>
```

Attributes: `publishable-key`, `base-url`, `origin-chain-id`, `dest-chain-id`, `recipient`, `customer-id`, `slippage-bps`. Events (`detail` = payload): `arc-quote`, `arc-status`, `arc-intent`, `arc-error`. The widget renders in a shadow root, so page CSS doesn't leak in.

In a bundler, `import { defineArcSwapWidget } from "@arc/widget/element"` registers the element with your app's React.

## Server side (submit)

```ts
import { GatewayClient } from "@arc/gateway-sdk";
const gateway = new GatewayClient({ baseUrl, apiKey: process.env.ARC_GATEWAY_KEY });

app.post("/api/arc/submit", async (req, res) => {
  // Check your user is allowed to do this first.
  const { intentId } = await gateway.submitIntent({ quoteId: req.body.quoteId, signedPayload: "0x" });
  res.json({ intentId });
});
```

Quotes created with the publishable key belong to your partner account, so your secret key can submit them, and they show up in your dashboard and ledger.

## Development

```
pnpm --filter @arc/widget test
pnpm --filter @arc/widget build
```
