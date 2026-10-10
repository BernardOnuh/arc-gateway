import { useEffect, useState, type ReactNode } from "react";
import { CodeBlock } from "../../components/CodeBlock";
import { LogoMark, IconArrowRight, IconClose, IconMenu } from "../../components/art";
import { ThemeToggle } from "../../components/ThemeToggle";
import { API_REFERENCE_URL, DOCS_URL, GATEWAY_URL, IS_DOCS_HOST, OPENAPI_URL, SITE_URL, WIDGET_SCRIPT_URL, siteHref } from "../../lib/env";

/** Table of contents: group → sections (id = anchor). */
const toc: { group: string; items: { id: string; title: string }[] }[] = [
  {
    group: "Getting started",
    items: [
      { id: "overview", title: "Overview" },
      { id: "how-it-works", title: "How a payment works" },
      { id: "quickstart", title: "Quickstart" },
    ],
  },
  {
    group: "Building",
    items: [
      { id: "keys", title: "API keys" },
      { id: "payout", title: "Payout address" },
      { id: "payments", title: "Creating payments" },
      { id: "checkout", title: "Checkout" },
      { id: "lifecycle", title: "Payment lifecycle" },
      { id: "webhooks", title: "Webhooks" },
      { id: "branding", title: "Branding" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "networks", title: "Networks & tokens" },
      { id: "fees", title: "Fees & timing" },
      { id: "security", title: "Security" },
      { id: "sdk", title: "TypeScript SDK" },
      { id: "rest", title: "REST API" },
      { id: "errors", title: "Errors" },
      { id: "faq", title: "FAQ" },
    ],
  },
];
const allIds = toc.flatMap((g) => g.items.map((i) => i.id));

// ---------- snippets ----------

const installSnippet = `npm install stableflow-sdk`;

const clientSnippet = `import { GatewayClient } from "stableflow-sdk";

export const gateway = new GatewayClient({
  baseUrl: "${GATEWAY_URL}",
  apiKey: process.env.ARC_GATEWAY_KEY, // gw_live_… — server only
});`;

const payoutSnippet = `await gateway.setPayoutAddress("0xYourArcAddress");`;

const createSnippet = `// Your server, when the customer clicks "Pay"
app.post("/api/checkout", async (req, res) => {
  const order = await db.orders.find(req.body.orderId);
  const payment = await gateway.createPayment({
    amount: order.total,          // "25.00" — USD, up to 2 decimals
    description: "Pro plan, 1 month",
    reference: order.id,          // comes back on webhooks and the receipt
    expiresInMinutes: 30,         // optional, default 30
  });
  res.json({ paymentId: payment.paymentId });
});`;

const linkSnippet = `import { checkoutUrl } from "stableflow-sdk";

const url = checkoutUrl({
  checkoutBaseUrl: "${SITE_URL || "https://your-site"}",
  paymentId: payment.paymentId,
  publishableKey: process.env.ARC_PUBLISHABLE_KEY!, // pk_live_…
});
res.redirect(url);`;

const reactSnippet = `import { ArcCheckout } from "@arc/widget";

<ArcCheckout
  publishableKey="pk_live_…"
  baseUrl="${GATEWAY_URL}"
  paymentId={paymentId}
  onPaid={(payment) => router.push(\`/thanks?order=\${payment.reference}\`)}
/>`;

const scriptSnippet = `<script type="module" src="${WIDGET_SCRIPT_URL}"></script>

<arc-checkout
  publishable-key="pk_live_…"
  base-url="${GATEWAY_URL}"
  payment-id="PAYMENT_ID_FROM_YOUR_SERVER"
></arc-checkout>

<script>
  document.querySelector("arc-checkout").addEventListener("arc-paid", (e) => {
    location.assign("/thanks?order=" + e.detail.reference);
  });
</script>`;

const webhookCreateSnippet = `const endpoint = await gateway.createWebhook("https://shop.example.com/hooks/arc");
// endpoint.secret is whsec_… — store it now, it is shown only once.`;

const webhookHandlerSnippet = `import express from "express";
import { verifyWebhook } from "stableflow-sdk";

app.post("/hooks/arc", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = await verifyWebhook(
      req.body.toString(),            // the RAW body, exactly as received
      req.header("arc-signature"),
      process.env.ARC_WEBHOOK_SECRET!,
    );
  } catch {
    return res.sendStatus(400);       // bad signature or stale timestamp
  }

  if (event.type === "payment.paid") {
    await fulfilOrder(event.data.reference); // make this idempotent
  }
  res.sendStatus(200);                // anything 2xx = delivered
});`;

const pollSnippet = `const final = await gateway.waitForPayment(paymentId, {
  onUpdate: (p) => console.log(p.status, p.paidCents),
});
// final.status: "paid" | "expired" | "canceled"`;

const curlCreateSnippet = `curl -X POST ${GATEWAY_URL}/v1/payments \\
  -H "Authorization: Bearer $ARC_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": "25.00", "description": "Pro plan", "reference": "order_1042" }'`;

const curlGetSnippet = `curl ${GATEWAY_URL}/v1/payments/PAYMENT_ID \\
  -H "Authorization: Bearer $ARC_GATEWAY_KEY"`;

const paymentJson = `{
  "paymentId": "50c66894-b772-4cc0-93e6-9f6864a1c130",
  "status": "paid",
  "amountCents": 100,
  "paidCents": 100,
  "pendingCents": 0,
  "remainingCents": 0,
  "currency": "USD",
  "description": "Pro plan",
  "reference": "order_1042",
  "payoutAddress": "0x3308…ee0d",
  "destChainId": 5042,
  "expiresAt": "2026-10-10T14:57:46.459Z",
  "paidAt": "2026-10-10T11:57:34.206Z",
  "refundOwedCents": 0,
  "refunds": [],
  "legs": [
    {
      "originChainId": 8453,
      "token": { "symbol": "ETH", "decimals": 18, "isNative": true },
      "amountIn": "407142605007000",
      "valueCents": 100,
      "payer": "0xc0d7…3014",
      "status": "EXECUTED_ON_ARC",
      "originTx": "0x758e…3d99",
      "destTx": "0xb3f2…e4e1"
    }
  ]
}`;

const webhookBodyJson = `{
  "type": "payment.paid",
  "created": "2026-10-10T11:57:34.206Z",
  "data": { /* the payment, same shape as GET /v1/payments/:id */ }
}`;

// ---------- small building blocks ----------

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-ink-900/5 py-10 first:border-t-0 first:pt-0 sm:py-14">
      <h2 className="text-2xl sm:text-3xl">
        <a href={`#${id}`} className="hover:underline hover:decoration-ink-900/20 hover:underline-offset-8">
          {title}
        </a>
      </h2>
      <div className="docs-prose mt-5">{children}</div>
    </section>
  );
}

function Callout({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={`my-5 rounded-2xl px-5 py-4 text-[15px] leading-relaxed ring-1 ${
        tone === "warn" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-brand-50 text-ink-800 ring-brand-200/60"
      }`}
    >
      {children}
    </div>
  );
}

/** Two-column definition list; stacks on phones. */
function Defs({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="my-5 divide-y divide-ink-900/5 overflow-hidden rounded-2xl ring-1 ring-ink-900/10">
      {rows.map(([term, desc], i) => (
        <div key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-4 sm:px-5">
          <dt className="font-mono text-[13px] font-semibold text-ink-900">{term}</dt>
          <dd className="text-[15px] leading-relaxed text-ink-600">{desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="my-6 space-y-5">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 pt-1">
            <p className="font-semibold text-ink-900">{s.title}</p>
            <div className="mt-1 text-[15px] leading-relaxed text-ink-600">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-mist-200/70 px-1.5 py-0.5 font-mono text-[0.86em] text-ink-900">{children}</code>
);

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="font-medium text-brand-600 underline decoration-brand-600/30 underline-offset-4 hover:decoration-brand-600">
    {children}
  </a>
);

/** Flow diagram: customer wallet → bridge → merchant, with the gateway coordinating. */
function FlowDiagram() {
  const box = "rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-ink-900/10 shadow-soft";
  const arrow = (label: string) => (
    <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-ink-600 sm:flex-col sm:px-1 sm:py-0">
      <span aria-hidden className="text-lg leading-none text-brand-500 sm:rotate-0">
        <span className="sm:hidden">↓</span>
        <span className="hidden sm:inline">→</span>
      </span>
      <span className="sm:max-w-[7rem] sm:text-center">{label}</span>
    </div>
  );
  return (
    <figure className="my-6 rounded-3xl bg-mist-50 p-4 ring-1 ring-ink-900/5 sm:p-6">
      <div className="flex flex-col items-stretch sm:flex-row sm:items-center">
        <div className={`${box} sm:flex-1`}>
          <p className="text-sm font-semibold">Customer wallet</p>
          <p className="text-xs text-ink-600">ETH, USDC, USDT… on Ethereum or Base</p>
        </div>
        {arrow("signs a swap")}
        <div className={`${box} sm:flex-1`}>
          <p className="text-sm font-semibold">Circle swap + bridge</p>
          <p className="text-xs text-ink-600">converts and moves value to ARC</p>
        </div>
        {arrow("delivers USDC")}
        <div className={`${box} sm:flex-1`}>
          <p className="text-sm font-semibold">Your payout address</p>
          <p className="text-xs text-ink-600">USDC on ARC</p>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs leading-relaxed text-ink-600">
        The gateway prices each part, tracks it, and tells you when the payment is complete. It never holds the funds.
      </figcaption>
    </figure>
  );
}

// ---------- layout ----------

function useActiveSection() {
  const [active, setActive] = useState(allIds[0]);
  useEffect(() => {
    let frame = 0;
    // The current section is the last one whose top has scrolled into the top quarter of the screen.
    const update = () => {
      frame = 0;
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const line = Math.max(headerBottom + 24, window.innerHeight * 0.25);
      let current = allIds[0];
      for (const id of allIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // At the very bottom, the last section wins even if its heading can't reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = allIds[allIds.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return active;
}

function TocList({ active, onPick }: { active: string; onPick?: () => void }) {
  return (
    <nav aria-label="Documentation" className="space-y-7 text-[14px]">
      {toc.map((g) => (
        <div key={g.group}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.id}>
                <a
                  href={`#${i.id}`}
                  onClick={onPick}
                  aria-current={active === i.id ? "location" : undefined}
                  className={`block rounded-xl px-3 py-1.5 transition ${
                    active === i.id ? "bg-white font-semibold text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {i.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Docs() {
  const active = useActiveSection();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTitle = toc.flatMap((g) => g.items).find((i) => i.id === active)?.title;

  useEffect(() => {
    document.title = "Docs · ARC Gateway";
    // Opening a deep link (#webhooks) after the page renders.
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  const home = IS_DOCS_HOST ? DOCS_URL || "/" : "/docs";

  return (
    <div className="min-h-screen bg-mist-100">
      <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-mist-100/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href={home} className="flex items-center gap-2.5 font-display text-[18px] font-semibold tracking-[-0.02em] text-ink-900">
            <LogoMark />
            <span>ARC Gateway</span>
            <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">Docs</span>
          </a>
          <div className="flex items-center gap-2">
            <a href={API_REFERENCE_URL} className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-700 hover:text-ink-900 md:inline">
              API reference
            </a>
            <a href={siteHref("/app")} className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-700 hover:text-ink-900 md:inline">
              Dashboard
            </a>
            <a href={siteHref("/signup")} className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
              Get API keys
            </a>
            <ThemeToggle />
          </div>
        </div>
        {/* Phones: a bar showing where you are; tap for the full contents. */}
        <div className="border-t border-ink-900/5 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="docs-toc-mobile"
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-ink-600">On this page:</span>
              <span className="truncate font-semibold text-ink-900">{activeTitle}</span>
            </span>
            {menuOpen ? <IconClose size={18} /> : <IconMenu size={18} />}
          </button>
          {menuOpen && (
            <div id="docs-toc-mobile" className="max-h-[70vh] overflow-y-auto border-t border-ink-900/5 px-2 py-4">
              <TocList active={active} onPick={() => setMenuOpen(false)} />
              <div className="mt-6 flex flex-wrap gap-2 px-3 pb-2">
                <a href={API_REFERENCE_URL} className="btn-secondary px-4 py-2 text-sm">
                  API reference
                </a>
                <a href={siteHref("/app")} className="btn-secondary px-4 py-2 text-sm">
                  Dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-60 shrink-0 overflow-y-auto py-10 lg:block">
          <TocList active={active} />
        </aside>

        <main className="min-w-0 flex-1 py-8 sm:py-12 lg:max-w-3xl">
          <div className="mb-10 sm:mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Documentation</p>
            <h1 className="mt-2 text-4xl leading-[1.05] sm:text-5xl">Accept any token. Get USDC on ARC.</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">
              Everything you need to take payments with ARC Gateway: how it works, how to integrate it, and how to know
              when you've been paid.
            </p>
          </div>

          <DocSection id="overview" title="Overview">
            <p>
              ARC Gateway is a checkout. You charge a price in US dollars; your customer pays with tokens they already
              hold (ETH, USDC, USDT or EURC on Ethereum or Base), split across as many as they like; and you receive{" "}
              <strong>USDC on the ARC network</strong> at an address you control.
            </p>
            <ul>
              <li>
                <strong>Non-custodial.</strong> Funds go from the customer's wallet, through Circle's swap and bridge,
                straight to your payout address. The gateway never holds money.
              </li>
              <li>
                <strong>No chain talk for customers.</strong> They see dollar amounts and their own balances; the
                network details stay behind the scenes unless you choose to show them.
              </li>
              <li>
                <strong>Built for developers.</strong> A REST API, a typed TypeScript SDK (<C>stableflow-sdk</C>), a
                hosted checkout page and an embeddable widget, plus signed webhooks.
              </li>
            </ul>
            <p>The pieces:</p>
            <Defs
              rows={[
                ["API", <>The gateway at <C>{GATEWAY_URL}</C>. Your server talks to it with a secret key.</>],
                ["Dashboard", <>Where you manage keys, payout address, branding, webhooks and see payments: <Ext href={siteHref("/app")}>{SITE_URL ? `${SITE_URL.replace(/^https?:\/\//, "")}/app` : "/app"}</Ext>.</>],
                ["Checkout", "The page or widget your customer pays on. It connects their browser wallet and walks them through paying."],
                ["Webhooks", "Signed HTTP calls to your server when a payment changes state."],
              ]}
            />
          </DocSection>

          <DocSection id="how-it-works" title="How a payment works">
            <FlowDiagram />
            <Steps
              items={[
                { title: "You create a payment", body: <>Your server calls <C>POST /v1/payments</C> with a USD amount. You get a <C>paymentId</C>.</> },
                { title: "The customer opens checkout", body: "Via the hosted link or the widget on your page. They connect a browser wallet (MetaMask, Rabby, Coinbase Wallet…)." },
                { title: "They choose what to pay with", body: "The checkout reads their balances on each supported network and shows them in dollars. They can cover the total with one token or split it across several." },
                { title: "Each part is priced and signed", body: "For every token they pick, the gateway gets a live quote from Circle for that token → USDC on ARC, delivered to your payout address. The customer's wallet switches to the right network and signs the swap. Nothing is signed by the gateway." },
                { title: "The gateway tracks settlement", body: "It records each transaction, checks it came from the paying wallet, and follows it until the USDC lands on ARC. The payment moves open → processing → paid." },
                { title: "You're notified", body: <>A <C>payment.paid</C> webhook hits your server, the customer sees a receipt, and the payment shows as paid in your dashboard.</> },
              ]}
            />
            <Callout>
              If a customer only manages to pay part of the total (say one token settles and another fails), what
              settled is kept and the checkout asks them to cover the rest. See <Ext href="#lifecycle">Payment lifecycle</Ext>.
            </Callout>
          </DocSection>

          <DocSection id="quickstart" title="Quickstart">
            <Steps
              items={[
                { title: "Create an account", body: <>Sign up at <Ext href={siteHref("/signup")}>{SITE_URL ? `${SITE_URL.replace(/^https?:\/\//, "")}/signup` : "/signup"}</Ext>. You get a secret key (<C>gw_live_…</C>) once; store it in your server's environment.</> },
                { title: "Set your payout address", body: "Dashboard → Settings → Payout. Any address you control works on ARC (it's EVM-compatible), e.g. your MetaMask address." },
                { title: "Create a publishable key", body: "Dashboard → Settings → Keys. List the website origins that will show checkout (e.g. https://shop.example.com)." },
                { title: "Install the SDK and create a payment", body: "Below." },
                { title: "Send the customer to checkout and listen for the webhook", body: <>See <Ext href="#checkout">Checkout</Ext> and <Ext href="#webhooks">Webhooks</Ext>.</> },
              ]}
            />
            <CodeBlock title="Terminal" code={installSnippet} />
            <div className="mt-4" />
            <CodeBlock title="gateway.ts" code={clientSnippet} />
            <div className="mt-4" />
            <CodeBlock title="server.ts" code={createSnippet} />
          </DocSection>

          <DocSection id="keys" title="API keys">
            <Defs
              rows={[
                [<>gw_live_…</>, <>Secret key. Full access to your account. <strong>Server only</strong>: never put it in a browser, mobile app or public repo. Shown once at signup and on rotation.</>],
                [<>pk_live_…</>, "Publishable key. Safe in a web page. It can only read a payment and drive the checkout, and only from the origins you list on it. It cannot create payments, change settings or read your data."],
              ]}
            />
            <p>
              Send keys as a bearer token: <C>Authorization: Bearer gw_live_…</C>. Rotate a leaked secret key from the
              dashboard (Settings → Keys → Rotate); the old one stops working immediately. Revoke publishable keys you no
              longer use.
            </p>
            <Callout tone="warn">
              A publishable key only works on the exact origins it lists (scheme + host + port). If checkout says the key
              isn't allowed, add your site's origin to the key, e.g. <C>https://shop.example.com</C>.
            </Callout>
          </DocSection>

          <DocSection id="payout" title="Payout address">
            <p>
              The ARC address that receives USDC. Set it once in the dashboard (Settings) or with the API. It applies to
              payments created afterwards; existing payments keep the address they were created with.
            </p>
            <CodeBlock title="server.ts" code={payoutSnippet} />
            <p>
              ARC is EVM-compatible, so the same <C>0x…</C> address you use on Ethereum works there. Make sure you
              control its private key: payments go straight to it and can't be redirected afterwards.
            </p>
          </DocSection>

          <DocSection id="payments" title="Creating payments">
            <p>Create one payment per order, from your server, when the customer is ready to pay.</p>
            <Defs
              rows={[
                ["amount", <>Required. USD as a string with up to 2 decimals, between <C>0.50</C> and <C>100000.00</C>.</>],
                ["description", "Optional. Shown to the customer on checkout and the receipt."],
                ["reference", "Optional. Your order id. Returned on the payment, receipts and webhooks."],
                ["customerId", "Optional. Attribute the payment to a customer you registered."],
                ["expiresInMinutes", "Optional, default 30. After this the checkout stops accepting new payments."],
              ]}
            />
            <CodeBlock title="curl" code={curlCreateSnippet} />
            <p className="mt-4">
              Read it back any time with <C>GET /v1/payments/:id</C> (or <C>gateway.getPayment(id)</C>):
            </p>
            <CodeBlock title="Response" code={paymentJson} />
          </DocSection>

          <DocSection id="checkout" title="Checkout">
            <p>Three ways to put checkout in front of the customer. All of them use your publishable key and your saved branding.</p>
            <h3>1. Hosted link (simplest)</h3>
            <p>
              Redirect to <C>{SITE_URL || "https://your-site"}/checkout/PAYMENT_ID?key=pk_live_…</C>. The page also works as
              a status page: reopening it shows progress and then the receipt.
            </p>
            <CodeBlock title="server.ts" code={linkSnippet} />
            <h3>2. React component</h3>
            <CodeBlock title="Checkout.tsx" code={reactSnippet} />
            <h3>3. Any website (web component)</h3>
            <CodeBlock title="checkout.html" code={scriptSnippet} />
            <Defs
              rows={[
                ["publishable-key", "Your pk_live_ key (required)."],
                ["payment-id", "From your server (required)."],
                ["base-url", <>The API: <C>{GATEWAY_URL}</C>.</>],
                ["theme", "light, dark or auto. Overrides your saved branding."],
                ["accent-color, radius, title", "Visual overrides."],
                ["show-network-details", "Show ARC settlement details on the receipt."],
                ["Events", <><C>arc-paid</C>, <C>arc-status</C> (detail = payment), <C>arc-error</C>.</>],
              ]}
            />
            <Callout tone="warn">
              Never fulfil an order just because the browser said it's paid. Confirm on your server with the{" "}
              <C>payment.paid</C> webhook or <C>GET /v1/payments/:id</C>.
            </Callout>
            <p>
              The customer needs a browser wallet extension (MetaMask, Rabby, Coinbase Wallet…). On a phone, they can
              open the checkout link inside their wallet app's built-in browser.
            </p>
          </DocSection>

          <DocSection id="lifecycle" title="Payment lifecycle">
            <Defs
              rows={[
                ["open", "Created; nothing paid yet."],
                ["processing", "At least one part has been sent and is on its way to ARC."],
                ["paid", "Settled parts cover the full amount. Final."],
                ["partially_paid", "Some value settled, but less than the total, and nothing is in flight. The customer can still pay the rest until it expires."],
                ["expired", "Time ran out before it was fully paid. Final."],
                ["canceled", "Canceled. Final."],
              ]}
            />
            <p>
              Amounts are in cents: <C>paidCents</C> (settled), <C>pendingCents</C> (in flight) and{" "}
              <C>remainingCents</C>. Each token the customer used is a <strong>leg</strong> with its own status:{" "}
              <C>QUOTED</C> → <C>PENDING</C> → <C>ORIGIN_CONFIRMED</C> → <C>EXECUTED_ON_ARC</C> (or <C>FAILED</C>).
            </p>
            <h3>Partial payments and refunds</h3>
            <p>
              If a payment expires after only part was paid, that USDC is already in your payout address. The payment
              shows <C>refundOwedCents</C> and a <C>refunds</C> list (each paying wallet and amount) so you can return it.
              Refunds are sent by you, from your payout address.
            </p>
          </DocSection>

          <DocSection id="webhooks" title="Webhooks">
            <p>Register an https endpoint (dashboard → Settings → Webhooks, or the API):</p>
            <CodeBlock title="setup.ts" code={webhookCreateSnippet} />
            <Defs
              rows={[
                ["payment.processing", "The first part was sent."],
                ["payment.paid", "Fully paid. Fulfil the order here."],
                ["payment.partially_paid", "Some value settled, the rest didn't (yet)."],
                ["payment.expired", "Expired unpaid or partly paid (check refundOwedCents)."],
                ["ping", "Sent by the dashboard's Test button."],
              ]}
            />
            <p>Every delivery is a <C>POST</C> with a JSON body and these headers:</p>
            <Defs
              rows={[
                ["arc-signature", <><C>t=TIMESTAMP,v1=HEX</C>: HMAC-SHA256 of <C>TIMESTAMP.RAW_BODY</C> with your <C>whsec_</C> secret.</>],
                ["arc-event", "The event type."],
                ["arc-delivery-id", "Unique per event. Use it to ignore duplicates."],
              ]}
            />
            <CodeBlock title="Body" code={webhookBodyJson} />
            <div className="mt-4" />
            <CodeBlock title="server.ts" code={webhookHandlerSnippet} />
            <ul>
              <li>Respond with any <strong>2xx</strong> within 10 seconds. Anything else is retried.</li>
              <li>
                Retries back off: 30s, 2m, 10m, 30m, 2h, 6h, 12h, 24h (8 attempts). Events for the same payment arrive in
                order.
              </li>
              <li>Signatures older than 5 minutes are rejected by <C>verifyWebhook</C>, which blocks replays.</li>
              <li>Each delivery is visible in the dashboard with its status code, for debugging.</li>
            </ul>
            <p>Prefer polling for scripts or tests?</p>
            <CodeBlock title="poll.ts" code={pollSnippet} />
          </DocSection>

          <DocSection id="branding" title="Branding">
            <p>
              Dashboard → Checkout lets you upload a logo, set colors, corner radius, light or dark theme, and rewrite
              every piece of text the customer sees, with a live preview. Saved branding applies to the hosted page and
              the widget automatically; attributes on the widget override it per page.
            </p>
          </DocSection>

          <DocSection id="networks" title="Networks & tokens">
            <Defs
              rows={[
                ["Customers pay from", "Ethereum and Base."],
                ["With", "The network's native ETH, plus USDC, USDT and EURC."],
                ["You receive", "USDC on ARC mainnet (chain id 5042)."],
              ]}
            />
            <p>
              The checkout only shows tokens it can actually route, and keeps a little ETH aside for gas. More source
              networks are planned. The live list is at <Ext href={`${GATEWAY_URL}/v1/chains`}>/v1/chains</Ext>.
            </p>
          </DocSection>

          <DocSection id="fees" title="Fees & timing">
            <ul>
              <li>
                <strong>You receive the full price.</strong> Each part is quoted with a small slippage buffer (0.5% by
                default), so what lands is at least the amount you charged.
              </li>
              <li>
                <strong>The customer pays network gas</strong> on the chain they pay from, plus the swap's spread. Gas on
                Base is a few cents; on Ethereum it varies.
              </li>
              <li>
                <strong>Settlement takes minutes, not seconds.</strong> The bridge waits for the source chain to finalise
                before releasing USDC on ARC: typically 15–45 minutes. The payment shows <C>processing</C> meanwhile; use
                the webhook rather than keeping the customer waiting on the page.
              </li>
            </ul>
          </DocSection>

          <DocSection id="security" title="Security">
            <ul>
              <li><strong>Non-custodial:</strong> the gateway never holds or moves your funds; customers sign every transaction in their own wallet.</li>
              <li><strong>Payer check:</strong> a transaction only counts toward a payment if it was sent by the wallet that requested the quote.</li>
              <li><strong>Keys:</strong> secret keys are hashed at rest and shown once; publishable keys are locked to your origins.</li>
              <li><strong>Webhooks:</strong> signed with a per-endpoint secret and a timestamp; https only.</li>
              <li><strong>Dashboard:</strong> httpOnly, Secure session cookies; passwords stored as salted scrypt hashes.</li>
            </ul>
          </DocSection>

          <DocSection id="sdk" title="TypeScript SDK">
            <p>
              <C>stableflow-sdk</C> works in Node 18+, Bun, Deno and browsers, as ESM or CommonJS, with full types and no
              runtime dependencies.
            </p>
            <CodeBlock title="Terminal" code={installSnippet} />
            <Defs
              rows={[
                ["createPayment(params)", "Create a checkout payment."],
                ["getPayment(id) / listPayments()", "Read payments."],
                ["waitForPayment(id, opts)", "Poll until paid, expired or canceled."],
                ["checkoutUrl({…})", "Build the hosted checkout link."],
                ["setPayoutAddress(addr)", "Where USDC lands."],
                ["createPublishableKey / rotateApiKey / revokeApiKey", "Key management."],
                ["createWebhook / listWebhooks / testWebhook", "Webhook endpoints and deliveries."],
                ["verifyWebhook(body, header, secret)", "Check a webhook's signature and parse it."],
                ["getBranding / updateBranding", "Checkout appearance."],
                ["GatewayError", <>Thrown on any non-2xx: <C>statusCode</C> and <C>body</C>.</>],
              ]}
            />
          </DocSection>

          <DocSection id="rest" title="REST API">
            <p>
              Base URL <C>{GATEWAY_URL}</C>. JSON in and out. Authenticate with <C>Authorization: Bearer KEY</C>.
            </p>
            <div className="my-5 overflow-hidden rounded-2xl ring-1 ring-ink-900/10">
              {[
                ["POST", "/v1/payments", "secret", "Create a payment"],
                ["GET", "/v1/payments", "secret", "List payments"],
                ["GET", "/v1/payments/:id", "secret or pk", "Get a payment"],
                ["POST", "/v1/partners/me/payout", "secret", "Set payout address"],
                ["POST", "/v1/partners/me/api-keys/publishable", "secret", "Create a publishable key"],
                ["POST", "/v1/partners/me/api-keys/rotate", "secret", "Rotate the secret key"],
                ["GET/POST", "/v1/webhooks", "secret", "List / create webhook endpoints"],
                ["POST", "/v1/webhooks/:id/test", "secret", "Send a ping"],
                ["GET/PUT", "/v1/partners/me/branding", "secret", "Checkout branding"],
                ["GET", "/v1/chains, /v1/tokens", "none", "Supported networks and tokens"],
              ].map(([method, path, auth, what]) => (
                <div key={method + path} className="grid gap-1 border-b border-ink-900/5 px-4 py-3 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)_6.5rem] sm:items-center sm:gap-3 sm:px-5">
                  <span className="font-mono text-xs font-bold text-brand-600">{method}</span>
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-[13px] text-ink-900">{path}</span>
                    <span className="text-sm text-ink-600">{what}</span>
                  </span>
                  <span className="text-xs text-ink-600 sm:text-right">{auth}</span>
                </div>
              ))}
            </div>
            <CodeBlock title="curl" code={curlGetSnippet} />
            <p className="mt-4">
              Every endpoint with full request and response schemas: <Ext href={API_REFERENCE_URL}>interactive API reference</Ext>{" "}
              · <Ext href={OPENAPI_URL}>OpenAPI spec</Ext>.
            </p>
          </DocSection>

          <DocSection id="errors" title="Errors">
            <p>
              Errors are JSON <C>{"{ \"error\": \"message\" }"}</C> with an HTTP status. The SDK throws a{" "}
              <C>GatewayError</C> with <C>statusCode</C> and <C>body</C>.
            </p>
            <Defs
              rows={[
                ["400", "Invalid input: amount out of range, bad address, unsupported token, payout address not set…"],
                ["401", "Missing or wrong API key."],
                ["403", "Key not allowed here (a publishable key on a secret-only endpoint, or from an origin not on the key)."],
                ["404", "Not found, or not yours."],
                ["409", "Conflict: payment already paid, expired or canceled; email already registered."],
                ["429", "Rate limited. Wait and retry."],
                ["502", "Upstream pricing or settlement provider failed. Safe to retry."],
              ]}
            />
          </DocSection>

          <DocSection id="faq" title="FAQ">
            <h3>Do customers need anything on ARC?</h3>
            <p>No. They pay from Ethereum or Base with tokens they already have. Only you receive on ARC.</p>
            <h3>What if the customer closes the page mid-payment?</h3>
            <p>Nothing is lost. Once their transaction is sent, settlement continues without the page; reopening the link shows progress, and you still get the webhook.</p>
            <h3>Why did the wallet ask to switch network?</h3>
            <p>Wallets sign on one network at a time. If the customer pays with USDC on Ethereum while their wallet is on Base, checkout asks to switch first.</p>
            <h3>Can I test without real money?</h3>
            <p>Use a small real amount (the minimum is $0.50). Payments on mainnet are real; Base keeps gas to cents.</p>
            <h3>How do I move USDC off ARC?</h3>
            <p>It's standard USDC in a wallet you control, so you can bridge it back with Circle's tools or send it to an exchange that supports ARC.</p>
          </DocSection>

          <footer className="mt-6 flex flex-col gap-4 border-t border-ink-900/5 py-10 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Questions? Start from the dashboard or the API reference.</span>
            <a href={siteHref("/signup")} className="btn-primary px-5 py-2.5 text-sm">
              Get your API keys <IconArrowRight size={16} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
