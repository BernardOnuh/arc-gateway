import { useState } from "react";
import { Link } from "react-router-dom";
import { ArcCheckout, normalizeAccent, type WidgetTheme } from "@arc/widget";
import { CodeBlock } from "../../components/CodeBlock";
import { Card, ErrorState, inputClass, Loading, PageTitle } from "../../components/dashboard/ui";
import { Segmented } from "../../components/forms";
import { GATEWAY_URL } from "../../lib/env";
import { useApiKeys, usePartnerProfile } from "../../lib/queries";

interface Appearance {
  theme: WidgetTheme;
  accentColor: string;
  radius: number;
  title: string;
  showNetworkDetails: boolean;
}

const DEFAULTS: Appearance = { theme: "light", accentColor: "#1c1f3f", radius: 20, title: "Pay", showNetworkDetails: false };

const SWATCHES = [
  { name: "Navy", value: "#1c1f3f" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Sky", value: "#0284c7" },
  { name: "Emerald", value: "#059669" },
  { name: "Orange", value: "#ea580c" },
  { name: "Rose", value: "#e11d48" },
];

/** Only the props that differ from the widget's defaults, so snippets stay short. */
function changed(a: Appearance): Partial<Appearance> {
  return Object.fromEntries(
    (Object.keys(a) as (keyof Appearance)[]).filter((k) => a[k] !== DEFAULTS[k]).map((k) => [k, a[k]])
  ) as Partial<Appearance>;
}

const reactSnippet = (pk: string, a: Appearance) => {
  const extra = changed(a);
  const lines = [
    `  publishableKey="${pk}"`,
    `  baseUrl="${GATEWAY_URL}"`,
    `  paymentId={paymentId}   // from POST /v1/payments on your server`,
    ...(extra.theme ? [`  theme="${extra.theme}"`] : []),
    ...(extra.accentColor ? [`  accentColor="${extra.accentColor}"`] : []),
    ...(extra.radius !== undefined ? [`  radius={${extra.radius}}`] : []),
    ...(extra.title ? [`  title=${JSON.stringify(extra.title)}`] : []),
    ...(extra.showNetworkDetails ? [`  showNetworkDetails`] : []),
  ];
  return `import { ArcCheckout } from "@arc/widget";

<ArcCheckout
${lines.join("\n")}
  onPaid={(payment) => router.push(\`/thanks?order=\${payment.reference}\`)}
/>`;
};

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const scriptSnippet = (pk: string, a: Appearance) => {
  const extra = changed(a);
  const attrs = [
    `  publishable-key="${pk}"`,
    `  base-url="${GATEWAY_URL}"`,
    `  payment-id="PAYMENT_ID_FROM_YOUR_SERVER"`,
    ...(extra.theme ? [`  theme="${extra.theme}"`] : []),
    ...(extra.accentColor ? [`  accent-color="${extra.accentColor}"`] : []),
    ...(extra.radius !== undefined ? [`  radius="${extra.radius}"`] : []),
    ...(extra.title ? [`  title="${escapeAttr(extra.title)}"`] : []),
    ...(extra.showNetworkDetails ? [`  show-network-details`] : []),
  ];
  return `<!-- Module build: App Kit loads only when the customer pays -->
<script type="module" src="/arc-widget.js"></script>

<arc-checkout
${attrs.join("\n")}
></arc-checkout>

<script>
  document.querySelector("arc-checkout")
    .addEventListener("arc-paid", (e) => location.assign("/thanks?order=" + e.detail.reference));
</script>`;
};

const serverSnippet = `// Your server (Node). The secret key never reaches the browser.
import { GatewayClient } from "@arc/gateway-sdk";

const gateway = new GatewayClient({
  baseUrl: "${GATEWAY_URL}",
  apiKey: process.env.ARC_GATEWAY_KEY, // gw_live_…
});

// When the customer reaches checkout, create the payment for your price:
app.post("/api/checkout", async (req, res) => {
  const payment = await gateway.createPayment({
    amount: "10.00",
    description: "Pro plan, 1 month",
    reference: req.body.orderId,
  });
  res.json({ paymentId: payment.paymentId });
});

// Before fulfilling, confirm it's paid (never trust the browser alone):
const { status } = await gateway.getPayment(paymentId); // "paid"`;

type InstallTab = "react" | "script" | "server";
type Stage = "light" | "dark";
type Device = "desktop" | "mobile";

function Label({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink-800">
      {children}
    </label>
  );
}

function Controls({ value, onChange }: { value: Appearance; onChange: (a: Appearance) => void }) {
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => onChange({ ...value, [k]: v });
  const custom = !SWATCHES.some((s) => s.value === value.accentColor);
  return (
    <Card
      title="Appearance"
      actions={
        <button type="button" className="text-sm font-medium text-ink-600 hover:text-ink-900" onClick={() => onChange(DEFAULTS)}>
          Reset
        </button>
      }
    >
      <div className="space-y-6">
        <div>
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-mist-200/80 p-1 text-sm" role="radiogroup" aria-label="Theme">
            {(["light", "dark", "auto"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={value.theme === t}
                onClick={() => set("theme", t)}
                className={`rounded-full px-3 py-2 font-medium capitalize transition ${
                  value.theme === t ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-600">Auto follows each visitor's light or dark setting.</p>
        </div>

        <div>
          <Label>Brand color</Label>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Brand color">
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={value.accentColor === s.value}
                aria-label={s.name}
                title={s.name}
                onClick={() => set("accentColor", s.value)}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white transition ${
                  value.accentColor === s.value ? "ring-2 ring-ink-900" : "hover:scale-110"
                }`}
                style={{ background: s.value }}
              />
            ))}
            <label
              className={`relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full ring-offset-2 ring-offset-white ${
                custom ? "ring-2 ring-ink-900" : ""
              }`}
              style={{ background: "conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#8b5cf6,#f43f5e)" }}
              title="Custom color"
            >
              <span className="sr-only">Custom color</span>
              <input
                type="color"
                value={value.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <input
              aria-label="Hex color"
              value={value.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              onBlur={(e) => set("accentColor", normalizeAccent(e.target.value))}
              spellCheck={false}
              className={`${inputClass} ml-1 w-28 py-1.5 font-mono text-xs`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="w-radius">Corner radius</Label>
            <span className="font-mono text-xs text-ink-600">{value.radius}px</span>
          </div>
          <input
            id="w-radius"
            type="range"
            min={0}
            max={32}
            value={value.radius}
            onChange={(e) => set("radius", Number(e.target.value))}
            className="w-full accent-[rgb(var(--ink-900))]"
          />
        </div>

        <div>
          <Label htmlFor="w-title">Label above your name</Label>
          <input
            id="w-title"
            value={value.title}
            maxLength={40}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={value.showNetworkDetails}
            onChange={(e) => set("showNetworkDetails", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--ink-900))]"
          />
          <span>
            <span className="block font-medium text-ink-800">Show network details</span>
            <span className="text-xs text-ink-600">
              Off: customers just see "Payment complete". On: the receipt mentions USDC on ARC with explorer links.
            </span>
          </span>
        </label>
      </div>
    </Card>
  );
}

export function Widget() {
  const keys = useApiKeys();
  const profile = usePartnerProfile();
  const publishable = keys.data?.items.filter((k) => k.kind === "publishable" && k.active && k.publishableKey) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULTS);
  const [amount, setAmount] = useState("10.00");
  const [tab, setTab] = useState<InstallTab>("server");
  const [stage, setStage] = useState<Stage>("light");
  const [device, setDevice] = useState<Device>("desktop");
  const [run, setRun] = useState(0);
  const key = publishable.find((k) => k.id === selected) ?? publishable[0];
  const pk = key?.publishableKey ?? "pk_live_…";
  const preview = { ...appearance, title: appearance.title.trim() || DEFAULTS.title };
  const amountCents = Math.max(50, Math.round((Number(amount) || 0) * 100));

  return (
    <>
      <PageTitle
        title="Checkout"
        intro="Customers pay your price with any mix of tokens from their wallet. Style the checkout to match your brand; it never asks them to think about networks."
      />
      {keys.isPending ? (
        <Loading />
      ) : keys.error ? (
        <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
      ) : (
        <div className="space-y-6">
          {publishable.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
              Publishable key
              <select
                value={key?.id}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-full border border-ink-900/10 bg-white px-3 py-2 font-mono text-xs"
              >
                {publishable.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.keyPrefix}…{k.last4} ({(k.allowedOrigins ?? []).join(", ")})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
            <Controls value={appearance} onChange={setAppearance} />

            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-base">Live preview</h2>
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-600">
                    Price $
                    <span className="block w-20">
                      <input
                        aria-label="Preview price"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${inputClass} py-1.5 text-xs`}
                      />
                    </span>
                  </label>
                  <button type="button" className="text-xs font-medium text-ink-600 hover:text-ink-900" onClick={() => setRun((r) => r + 1)}>
                    Restart
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="w-32">
                    <Segmented
                      label="Page background"
                      value={stage}
                      onChange={setStage}
                      options={[
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                      ]}
                    />
                  </div>
                  <div className="w-40">
                    <Segmented
                      label="Device width"
                      value={device}
                      onChange={setDevice}
                      options={[
                        { value: "desktop", label: "Desktop" },
                        { value: "mobile", label: "Mobile" },
                      ]}
                    />
                  </div>
                </div>
              </div>
              <div
                className={`flex min-h-[40rem] items-start justify-center px-4 py-10 transition-colors ${
                  stage === "dark" ? "bg-[#0b0f24]" : "bg-[#f4f5fb]"
                }`}
                style={{
                  backgroundImage: `radial-gradient(${stage === "dark" ? "rgba(255,255,255,.07)" : "rgba(28,31,63,.08)"} 1px, transparent 1px)`,
                  backgroundSize: "18px 18px",
                }}
              >
                <div className="w-full transition-[max-width] duration-300" style={{ maxWidth: device === "mobile" ? 360 : 420 }}>
                  <ArcCheckout
                    key={`${run}-${amountCents}`}
                    publishableKey={pk}
                    demo={{ amountCents, merchantName: profile.data?.name ?? "Your business", description: "Pro plan, 1 month" }}
                    {...preview}
                  />
                  <p className={`mt-4 text-center text-xs ${stage === "dark" ? "text-[#9aa1cc]" : "text-[#555b88]"}`}>
                    Demo mode: a simulated wallet, nothing is charged. Try a real one from{" "}
                    <Link to="/app/payments" className="font-medium underline">
                      Payments
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </section>
          </div>

          <Card title="Install">
            {!key && (
              <p role="note" className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                Create a publishable key for your website in{" "}
                <Link to="/app/settings" className="font-semibold underline">
                  Settings
                </Link>{" "}
                and it will appear in these snippets.
              </p>
            )}
            <div className="max-w-md">
              <Segmented3 value={tab} onChange={setTab} />
            </div>
            <div className="mt-5">
              {tab === "server" && <CodeBlock title="1. Your server: create the payment" code={serverSnippet} />}
              {tab === "react" && <CodeBlock title="2. React: show the checkout" code={reactSnippet(pk, preview)} />}
              {tab === "script" && <CodeBlock title="2. Any site: show the checkout" code={scriptSnippet(pk, preview)} />}
            </div>
            <p className="mt-4 text-xs text-ink-600">
              Payments settle in USDC to your payout address. The checkout loads the wallet tooling only when the customer
              pays, and your secret key never reaches the browser.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

function Segmented3({ value, onChange }: { value: InstallTab; onChange: (v: InstallTab) => void }) {
  const opts: { value: InstallTab; label: string }[] = [
    { value: "server", label: "Server" },
    { value: "react", label: "React" },
    { value: "script", label: "Script tag" },
  ];
  return (
    <div role="tablist" aria-label="Install method" className="grid grid-cols-3 gap-1 rounded-full bg-mist-200/80 p-1 text-sm">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-2 font-medium transition ${
            value === o.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
