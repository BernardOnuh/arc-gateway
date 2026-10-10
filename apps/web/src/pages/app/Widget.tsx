import { useState } from "react";
import { Link } from "react-router-dom";
import { ArcSwapWidget } from "@arc/widget";
import { CodeBlock } from "../../components/CodeBlock";
import { Card, Empty, ErrorState, Loading, PageTitle } from "../../components/dashboard/ui";
import { GATEWAY_URL } from "../../lib/env";
import { useApiKeys } from "../../lib/queries";

const reactSnippet = (pk: string) => `import { ArcSwapWidget } from "@arc/widget";

<ArcSwapWidget
  publishableKey="${pk}"
  baseUrl="${GATEWAY_URL}"
  recipient={customer.walletAddress}   // optional: lock the receiving address
  customerId={customer.arcCustomerId}   // optional: attribute revenue
  submitIntent={(quote) =>
    // Your server submits with your SECRET key (see below)
    fetch("/api/arc/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteId: quote.quoteId }),
    }).then((r) => r.json())
  }
  onIntent={(intent) => console.log("finished", intent.status)}
/>`;

const scriptSnippet = (pk: string) => `<!-- Serve dist/standalone/arc-widget.iife.js from @arc/widget -->
<script src="/arc-widget.iife.js"></script>

<arc-swap-widget
  publishable-key="${pk}"
  base-url="${GATEWAY_URL}"
></arc-swap-widget>

<script>
  const widget = document.querySelector("arc-swap-widget");
  widget.submitIntent = (quote) =>
    fetch("/api/arc/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteId: quote.quoteId }),
    }).then((r) => r.json());
  widget.addEventListener("arc-intent", (e) => console.log(e.detail.status));
</script>`;

const serverSnippet = `// Your server (Node). The secret key never reaches the browser.
import { GatewayClient } from "@arc/gateway-sdk";

const gateway = new GatewayClient({
  baseUrl: "${GATEWAY_URL}",
  apiKey: process.env.ARC_GATEWAY_KEY, // gw_live_…
});

app.post("/api/arc/submit", async (req, res) => {
  // Authorize your signed-in user here before spending anything.
  const { intentId } = await gateway.submitIntent({
    quoteId: req.body.quoteId,
    signedPayload: req.body.signedPayload ?? "0x",
  });
  res.json({ intentId });
});`;

export function Widget() {
  const keys = useApiKeys();
  const publishable = keys.data?.items.filter((k) => k.kind === "publishable" && k.active && k.publishableKey) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const key = publishable.find((k) => k.id === selected) ?? publishable[0];
  const origin = window.location.origin;
  const previewAllowed = key?.allowedOrigins?.includes(origin) ?? false;

  return (
    <>
      <PageTitle
        title="Widget"
        intro="Drop a swap form into your site. Customers get a live quote with your fee; your server submits it."
      />
      {keys.isPending ? (
        <Loading />
      ) : keys.error ? (
        <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
      ) : !key ? (
        <Card>
          <Empty>
            The widget needs a publishable key.{" "}
            <Link to="/app/settings" className="font-medium text-brand-600 hover:underline">
              Create one in Settings
            </Link>
            .
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
          <div className="min-w-0 space-y-6">
            {publishable.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Publishable key
                <select
                  value={key.id}
                  onChange={(e) => setSelected(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs shadow-sm"
                >
                  {publishable.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.keyPrefix}…{k.last4} ({(k.allowedOrigins ?? []).join(", ")})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <CodeBlock title="React" code={reactSnippet(key.publishableKey!)} />
            <CodeBlock title="Any site (script tag)" code={scriptSnippet(key.publishableKey!)} />
            <CodeBlock title="Your server: submit endpoint" code={serverSnippet} />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Live preview</h2>
            {previewAllowed ? (
              <>
                <ArcSwapWidget publishableKey={key.publishableKey!} baseUrl={GATEWAY_URL} />
                <p className="mt-2 text-xs text-slate-500">
                  Real quotes from the gateway. Submission is off in this preview.
                </p>
              </>
            ) : (
              <Card>
                <p className="text-sm text-slate-600">
                  This key isn't allowed on <span className="font-mono">{origin}</span>, so the preview can't run here.
                  Create a key that includes this origin in{" "}
                  <Link to="/app/settings" className="font-medium text-brand-600 hover:underline">
                    Settings
                  </Link>
                  .
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
