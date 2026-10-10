import { useState } from "react";
import { Link } from "react-router-dom";
import { ArcSwapWidget, normalizeAccent, type WidgetTheme } from "@arc/widget";
import { CodeBlock } from "../../components/CodeBlock";
import { Card, Empty, ErrorState, inputClass, Loading, PageTitle } from "../../components/dashboard/ui";
import { Segmented } from "../../components/forms";
import { GATEWAY_URL } from "../../lib/env";
import { useApiKeys } from "../../lib/queries";

interface Appearance {
  theme: WidgetTheme;
  accentColor: string;
  radius: number;
  title: string;
  slippageBps: number;
}

const DEFAULTS: Appearance = { theme: "light", accentColor: "#1c1f3f", radius: 20, title: "Send to ARC", slippageBps: 50 };

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
    ...(extra.theme ? [`  theme="${extra.theme}"`] : []),
    ...(extra.accentColor ? [`  accentColor="${extra.accentColor}"`] : []),
    ...(extra.radius !== undefined ? [`  radius={${extra.radius}}`] : []),
    ...(extra.title ? [`  title=${JSON.stringify(extra.title)}`] : []),
    ...(extra.slippageBps !== undefined ? [`  slippageBps={${extra.slippageBps}}`] : []),
  ];
  return `import { ArcSwapWidget } from "@arc/widget";

<ArcSwapWidget
${lines.join("\n")}
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
};

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const scriptSnippet = (pk: string, a: Appearance) => {
  const extra = changed(a);
  const attrs = [
    `  publishable-key="${pk}"`,
    `  base-url="${GATEWAY_URL}"`,
    ...(extra.theme ? [`  theme="${extra.theme}"`] : []),
    ...(extra.accentColor ? [`  accent-color="${extra.accentColor}"`] : []),
    ...(extra.radius !== undefined ? [`  radius="${extra.radius}"`] : []),
    ...(extra.title ? [`  title="${escapeAttr(extra.title)}"`] : []),
    ...(extra.slippageBps !== undefined ? [`  slippage-bps="${extra.slippageBps}"`] : []),
  ];
  return `<!-- Serve dist/standalone/arc-widget.iife.js from @arc/widget -->
<script src="/arc-widget.iife.js"></script>

<arc-swap-widget
${attrs.join("\n")}
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
};

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
          <Label htmlFor="w-title">Heading</Label>
          <input
            id="w-title"
            value={value.title}
            maxLength={40}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <Label>Max slippage</Label>
          <Segmented
            label="Max slippage"
            value={String(value.slippageBps)}
            onChange={(v) => set("slippageBps", Number(v))}
            options={[
              { value: "10", label: "0.1%" },
              { value: "50", label: "0.5%" },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

export function Widget() {
  const keys = useApiKeys();
  const publishable = keys.data?.items.filter((k) => k.kind === "publishable" && k.active && k.publishableKey) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULTS);
  const [tab, setTab] = useState<InstallTab>("react");
  const [stage, setStage] = useState<Stage>("light");
  const [device, setDevice] = useState<Device>("desktop");
  const key = publishable.find((k) => k.id === selected) ?? publishable[0];
  const origin = window.location.origin;
  const previewAllowed = key?.allowedOrigins?.includes(origin) ?? false;
  const preview = { ...appearance, title: appearance.title.trim() || DEFAULTS.title };

  return (
    <>
      <PageTitle
        title="Widget"
        intro="Drop a swap form into your site. Style it to match your brand; customers get a live quote with your fee and your server submits it."
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
        <div className="space-y-6">
          {publishable.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
              Publishable key
              <select
                value={key.id}
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
                <h2 className="text-base">Live preview <span className="ml-1 text-xs font-normal text-ink-600">page background · device</span></h2>
                <div className="flex gap-2">
                  <div className="w-40">
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
                className={`flex min-h-[38rem] items-start justify-center px-4 py-10 transition-colors ${
                  stage === "dark" ? "bg-[#0b0f24]" : "bg-[#f4f5fb]"
                }`}
                style={{
                  backgroundImage: `radial-gradient(${stage === "dark" ? "rgba(255,255,255,.07)" : "rgba(28,31,63,.08)"} 1px, transparent 1px)`,
                  backgroundSize: "18px 18px",
                }}
              >
                {previewAllowed ? (
                  <div className="w-full transition-[max-width] duration-300" style={{ maxWidth: device === "mobile" ? 360 : 420 }}>
                    <ArcSwapWidget publishableKey={key.publishableKey!} baseUrl={GATEWAY_URL} {...preview} />
                    <p className={`mt-4 text-center text-xs ${stage === "dark" ? "text-[#9aa1cc]" : "text-[#555b88]"}`}>
                      Real quotes from the gateway. Submission is off in this preview.
                    </p>
                  </div>
                ) : (
                  <div className="max-w-sm rounded-3xl bg-white p-6 text-sm text-ink-600 shadow-soft">
                    This key isn't allowed on <span className="font-mono">{origin}</span>, so the preview can't run here.
                    Create a key that includes this origin in{" "}
                    <Link to="/app/settings" className="font-medium text-brand-600 hover:underline">
                      Settings
                    </Link>
                    .
                  </div>
                )}
              </div>
            </section>
          </div>

          <Card title="Install">
            <div className="max-w-md">
              <Segmented3 value={tab} onChange={setTab} />
            </div>
            <div className="mt-5">
              {tab === "react" && <CodeBlock title="React" code={reactSnippet(key.publishableKey!, preview)} />}
              {tab === "script" && <CodeBlock title="Any site (script tag)" code={scriptSnippet(key.publishableKey!, preview)} />}
              {tab === "server" && <CodeBlock title="Your server: submit endpoint" code={serverSnippet} />}
            </div>
            <p className="mt-4 text-xs text-ink-600">
              The snippets include the appearance you picked above. Publishable keys can quote and track, never submit:
              your server submits with your secret key.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

function Segmented3({ value, onChange }: { value: InstallTab; onChange: (v: InstallTab) => void }) {
  const opts: { value: InstallTab; label: string }[] = [
    { value: "react", label: "React" },
    { value: "script", label: "Script tag" },
    { value: "server", label: "Server" },
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
