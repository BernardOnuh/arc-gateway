import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArcCheckout,
  DEFAULT_CHECKOUT_TEXTS,
  normalizeAccent,
  type CheckoutBranding,
  type CheckoutPreviewState,
  type CheckoutTextKey,
} from "@arc/widget";
import { CodeBlock } from "../../components/CodeBlock";
import { buttonClass, Card, ErrorState, inputClass, Loading, PageTitle, secondaryButtonClass } from "../../components/dashboard/ui";
import { Segmented } from "../../components/forms";
import { describeError } from "../../lib/gateway";
import { GATEWAY_URL, WIDGET_SCRIPT_URL } from "../../lib/env";
import { logoToDataUrl } from "../../lib/logo";
import { useApiKeys, useBranding, usePartnerProfile, useSaveBranding } from "../../lib/queries";

const SWATCHES = [
  { name: "Navy", value: "#1c1f3f" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Sky", value: "#0284c7" },
  { name: "Emerald", value: "#059669" },
  { name: "Orange", value: "#ea580c" },
  { name: "Rose", value: "#e11d48" },
];

const DEFAULT_LOOK = { accentColor: "#1c1f3f", theme: "light" as const, radius: 20, showNetworkDetails: false };

/** The texts in the order the customer meets them. */
const TEXT_FIELDS: { key: CheckoutTextKey; label: string; screen: string; hint?: string }[] = [
  { key: "title", label: "Label above your name", screen: "Every screen" },
  { key: "totalLabel", label: "Total label", screen: "Every screen" },
  { key: "footer", label: "Footer", screen: "Every screen", hint: "Leave empty to hide the footer." },
  { key: "connectButton", label: "Connect button", screen: "Connect" },
  { key: "connectHint", label: "Connect hint", screen: "Connect", hint: "Leave empty to hide." },
  { key: "payWithLabel", label: "Balances heading", screen: "Choose tokens" },
  { key: "payButton", label: "Pay button", screen: "Choose tokens", hint: "{amount} is the amount due." },
  { key: "emptyBalances", label: "No balances message", screen: "Choose tokens" },
  { key: "keepOpen", label: "While paying", screen: "Paying", hint: "Leave empty to hide." },
  { key: "remainingLabel", label: "Remaining label", screen: "Partly paid" },
  { key: "successTitle", label: "Success title", screen: "Complete" },
  { key: "successMessage", label: "Success message", screen: "Complete", hint: "{amount} and {merchant} are filled in." },
];

const SCREENS: { value: CheckoutPreviewState | "live"; label: string }[] = [
  { value: "live", label: "Try it" },
  { value: "connect", label: "Connect" },
  { value: "select", label: "Choose tokens" },
  { value: "paying", label: "Paying" },
  { value: "partial", label: "Partly paid" },
  { value: "done", label: "Complete" },
  { value: "expired", label: "Expired" },
  { value: "invalid", label: "Invalid link" },
];

type EditorTab = "brand" | "look" | "text";
type InstallTab = "server" | "react" | "script";

/** Comparable form of a branding object (key order and empty values don't matter). */
function canonical(b: CheckoutBranding): string {
  const texts = Object.fromEntries(Object.entries(b.texts ?? {}).filter(([, v]) => v !== undefined).sort());
  return JSON.stringify({
    displayName: b.displayName || null,
    logo: b.logo || null,
    accentColor: b.accentColor ?? DEFAULT_LOOK.accentColor,
    theme: b.theme ?? DEFAULT_LOOK.theme,
    radius: b.radius ?? DEFAULT_LOOK.radius,
    showNetworkDetails: b.showNetworkDetails ?? DEFAULT_LOOK.showNetworkDetails,
    texts,
  });
}

function Label({ children, htmlFor, aside }: { children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-800">
        {children}
      </label>
      {aside}
    </div>
  );
}

function BrandTab({
  value,
  onChange,
  fallbackName,
}: {
  value: CheckoutBranding;
  onChange: (b: CheckoutBranding) => void;
  fallbackName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    try {
      onChange({ ...value, logo: await logoToDataUrl(file) });
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Couldn't use that image.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Logo</Label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void take(e.dataTransfer.files[0]);
          }}
          className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition ${
            dragging ? "border-brand-500 bg-brand-50" : "border-mist-300"
          }`}
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-mist-100">
            {value.logo ? (
              <img src={value.logo} alt="Your logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xl font-semibold text-ink-400">
                {(value.displayName || fallbackName).slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink-900">{value.logo ? "Logo uploaded" : "Drop your logo here"}</p>
            <p className="text-xs text-ink-600">PNG, JPG, WebP or SVG. Square works best; we resize to 256px.</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                className="text-sm font-medium text-brand-600 hover:underline"
                onClick={() => fileRef.current?.click()}
              >
                {value.logo ? "Replace" : "Upload"}
              </button>
              {value.logo && (
                <button
                  type="button"
                  className="text-sm font-medium text-ink-600 hover:text-ink-900"
                  onClick={() => onChange({ ...value, logo: null })}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            aria-label="Upload logo"
            className="sr-only"
            onChange={(e) => {
              void take(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {logoError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {logoError}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="b-name">Display name</Label>
        <input
          id="b-name"
          value={value.displayName ?? ""}
          maxLength={60}
          placeholder={fallbackName}
          onChange={(e) => onChange({ ...value, displayName: e.target.value })}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-ink-600">What customers see. Empty uses your business name.</p>
      </div>
    </div>
  );
}

function LookTab({ value, onChange }: { value: CheckoutBranding; onChange: (b: CheckoutBranding) => void }) {
  const accent = value.accentColor ?? DEFAULT_LOOK.accentColor;
  const custom = !SWATCHES.some((s) => s.value === accent);
  const set = <K extends keyof CheckoutBranding>(k: K, v: CheckoutBranding[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-6">
      <div>
        <Label>Theme</Label>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-mist-200/80 p-1 text-sm" role="radiogroup" aria-label="Theme">
          {(["light", "dark", "auto"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={(value.theme ?? "light") === t}
              onClick={() => set("theme", t)}
              className={`rounded-full px-3 py-2 font-medium capitalize transition ${
                (value.theme ?? "light") === t ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-600">Auto follows each customer's light or dark setting.</p>
      </div>

      <div>
        <Label>Brand color</Label>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Brand color">
          {SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={accent === s.value}
              aria-label={s.name}
              title={s.name}
              onClick={() => set("accentColor", s.value)}
              className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white transition ${
                accent === s.value ? "ring-2 ring-ink-900" : "hover:scale-110"
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
              value={accent}
              onChange={(e) => set("accentColor", e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <span className="w-28">
            <input
              aria-label="Hex color"
              defaultValue={accent}
              key={accent}
              onBlur={(e) => set("accentColor", normalizeAccent(e.target.value))}
              spellCheck={false}
              className={`${inputClass} py-1.5 font-mono text-xs`}
            />
          </span>
        </div>
      </div>

      <div>
        <Label
          htmlFor="b-radius"
          aside={<span className="font-mono text-xs text-ink-600">{value.radius ?? DEFAULT_LOOK.radius}px</span>}
        >
          Corner radius
        </Label>
        <input
          id="b-radius"
          type="range"
          min={0}
          max={32}
          value={value.radius ?? DEFAULT_LOOK.radius}
          onChange={(e) => set("radius", Number(e.target.value))}
          className="w-full accent-[rgb(var(--ink-900))]"
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.showNetworkDetails ?? false}
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
  );
}

function TextTab({ value, onChange }: { value: CheckoutBranding; onChange: (b: CheckoutBranding) => void }) {
  const texts = value.texts ?? {};
  const setText = (k: CheckoutTextKey, v: string | undefined) => {
    const next = { ...texts, [k]: v };
    if (v === undefined) delete next[k];
    onChange({ ...value, texts: next });
  };
  let lastScreen = "";
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-600">
        Every word your customers see. Empty fields use the default shown in grey.{" "}
        <span className="font-mono">{"{amount}"}</span> and <span className="font-mono">{"{merchant}"}</span> are filled
        in for you.
      </p>
      {TEXT_FIELDS.map((f) => {
        const header = f.screen !== lastScreen ? f.screen : null;
        lastScreen = f.screen;
        const custom = texts[f.key] !== undefined;
        const hideable = f.key === "footer" || f.key === "connectHint" || f.key === "keepOpen";
        return (
          <div key={f.key}>
            {header && (
              <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">{header}</p>
            )}
            <Label
              htmlFor={`t-${f.key}`}
              aside={
                custom && (
                  <button
                    type="button"
                    className="text-xs font-medium text-ink-600 hover:text-ink-900"
                    onClick={() => setText(f.key, undefined)}
                  >
                    Reset
                  </button>
                )
              }
            >
              {f.label}
            </Label>
            <input
              id={`t-${f.key}`}
              value={texts[f.key] ?? ""}
              maxLength={140}
              placeholder={DEFAULT_CHECKOUT_TEXTS[f.key]}
              onChange={(e) => setText(f.key, e.target.value === "" && !hideable ? undefined : e.target.value)}
              className={inputClass}
            />
            {f.hint && <p className="mt-1 text-xs text-ink-600">{f.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

const serverSnippet = `// Your server (Node). The secret key never reaches the browser.
import { GatewayClient } from "stableflow-sdk";

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

const reactSnippet = (pk: string) => `import { ArcCheckout } from "@arc/widget";

// Your saved branding (logo, colors, texts) applies automatically.
<ArcCheckout
  publishableKey="${pk}"
  baseUrl="${GATEWAY_URL}"
  paymentId={paymentId}   // from POST /v1/payments on your server
  onPaid={(payment) => router.push(\`/thanks?order=\${payment.reference}\`)}
/>`;

const scriptSnippet = (pk: string) => `<!-- Module build: wallet tooling loads only when the customer pays -->
<script type="module" src="${WIDGET_SCRIPT_URL}"></script>

<!-- Your saved branding (logo, colors, texts) applies automatically. -->
<arc-checkout
  publishable-key="${pk}"
  base-url="${GATEWAY_URL}"
  payment-id="PAYMENT_ID_FROM_YOUR_SERVER"
></arc-checkout>

<script>
  document.querySelector("arc-checkout")
    .addEventListener("arc-paid", (e) => location.assign("/thanks?order=" + e.detail.reference));
</script>`;

function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-mist-200/80 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-3 py-2 font-medium transition ${
            value === o.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Widget() {
  const keys = useApiKeys();
  const profile = usePartnerProfile();
  const saved = useBranding();
  const save = useSaveBranding();
  const [draft, setDraft] = useState<CheckoutBranding | null>(null);
  const [editor, setEditor] = useState<EditorTab>("brand");
  const [screen, setScreen] = useState<CheckoutPreviewState | "live">("select");
  const [amount, setAmount] = useState("10.00");
  const [stage, setStage] = useState<"light" | "dark">("light");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [install, setInstall] = useState<InstallTab>("server");
  const [run, setRun] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Start editing from what's saved on the gateway.
  useEffect(() => {
    if (saved.data && draft === null) setDraft(saved.data);
  }, [saved.data, draft]);

  const publishable = keys.data?.items.filter((k) => k.kind === "publishable" && k.active && k.publishableKey) ?? [];
  const pk = publishable[0]?.publishableKey ?? "pk_live_…";
  const amountCents = Math.max(50, Math.round((Number(amount) || 0) * 100));
  const dirty = draft !== null && saved.data !== undefined && canonical(draft) !== canonical(saved.data);
  const fallbackName = profile.data?.name ?? "Your business";

  async function onSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      await save.mutateAsync({
        ...draft,
        displayName: draft.displayName?.trim() || null,
        logo: draft.logo || null,
        texts: Object.fromEntries(Object.entries(draft.texts ?? {}).filter(([, v]) => v !== undefined)),
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e) {
      setSaveError(describeError(e));
    }
  }

  return (
    <>
      <PageTitle
        title="Checkout"
        intro="Make the checkout yours: logo, colors and every word. Customers pay your price with any mix of tokens; it never asks them to think about networks."
        actions={
          draft && (
            <div className="flex flex-wrap items-center gap-3">
              {justSaved && (
                <span role="status" className="text-sm text-green-700">
                  Saved. Live on every checkout.
                </span>
              )}
              {dirty && !justSaved && <span className="text-sm text-ink-600">Unsaved changes</span>}
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={!dirty || save.isPending}
                onClick={() => saved.data && setDraft(saved.data)}
              >
                Discard
              </button>
              <button type="button" className={buttonClass} disabled={!dirty || save.isPending} onClick={onSave}>
                {save.isPending ? "Saving…" : "Save branding"}
              </button>
            </div>
          )
        }
      />
      {saveError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {saveError}
        </p>
      )}
      {saved.error ? (
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
      ) : saved.isPending || keys.isPending || !draft ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
            <section className="card self-start overflow-hidden">
              <div className="border-b border-mist-100 p-4">
                <Tabs
                  label="Editor section"
                  value={editor}
                  onChange={setEditor}
                  options={[
                    { value: "brand", label: "Brand" },
                    { value: "look", label: "Look" },
                    { value: "text", label: "Text" },
                  ]}
                />
              </div>
              <div className="max-h-[46rem] overflow-y-auto p-6">
                {editor === "brand" && <BrandTab value={draft} onChange={setDraft} fallbackName={fallbackName} />}
                {editor === "look" && <LookTab value={draft} onChange={setDraft} />}
                {editor === "text" && <TextTab value={draft} onChange={setDraft} />}
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="space-y-3 border-b border-mist-100 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base">Live preview</h2>
                  <div className="flex flex-wrap items-center gap-2">
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
                <div role="tablist" aria-label="Preview screen" className="flex flex-wrap gap-1.5">
                  {SCREENS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      role="tab"
                      aria-selected={screen === s.value}
                      onClick={() => {
                        setScreen(s.value);
                        setRun((r) => r + 1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        screen === s.value ? "bg-ink-900 text-white" : "bg-mist-100 text-ink-700 hover:bg-mist-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={`flex min-h-[44rem] items-start justify-center px-4 py-10 transition-colors ${
                  stage === "dark" ? "bg-[#0b0f24]" : "bg-[#f4f5fb]"
                }`}
                style={{
                  backgroundImage: `radial-gradient(${stage === "dark" ? "rgba(255,255,255,.07)" : "rgba(28,31,63,.08)"} 1px, transparent 1px)`,
                  backgroundSize: "18px 18px",
                }}
              >
                <div className="w-full transition-[max-width] duration-300" style={{ maxWidth: device === "mobile" ? 360 : 420 }}>
                  <ArcCheckout
                    key={`${run}-${amountCents}-${screen}`}
                    publishableKey={pk}
                    demo={{
                      amountCents,
                      merchantName: draft.displayName?.trim() || fallbackName,
                      description: "Pro plan, 1 month",
                    }}
                    previewState={screen === "live" ? undefined : screen}
                    branding={draft}
                  />
                  <p className={`mt-4 text-center text-xs ${stage === "dark" ? "text-[#9aa1cc]" : "text-[#555b88]"}`}>
                    {screen === "live"
                      ? "Click through it: a simulated wallet, nothing is charged."
                      : "Pick any screen above to check it."}{" "}
                    Try a real one from{" "}
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
            {publishable.length === 0 && (
              <p role="note" className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                Create a publishable key for your website in{" "}
                <Link to="/app/settings" className="font-semibold underline">
                  Settings
                </Link>{" "}
                and it will appear in these snippets.
              </p>
            )}
            <div className="max-w-md">
              <Tabs
                label="Install method"
                value={install}
                onChange={setInstall}
                options={[
                  { value: "server", label: "Server" },
                  { value: "react", label: "React" },
                  { value: "script", label: "Script tag" },
                ]}
              />
            </div>
            <div className="mt-5">
              {install === "server" && <CodeBlock title="1. Your server: create the payment" code={serverSnippet} />}
              {install === "react" && <CodeBlock title="2. React: show the checkout" code={reactSnippet(pk)} />}
              {install === "script" && <CodeBlock title="2. Any site: show the checkout" code={scriptSnippet(pk)} />}
            </div>
            <p className="mt-4 text-xs text-ink-600">
              Saved branding is stored on the gateway and travels with every payment, so the hosted checkout and every
              embedded checkout update the moment you save.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
