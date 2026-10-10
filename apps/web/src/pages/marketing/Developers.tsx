import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { CtaPanel, PageHeader, Section } from "../../components/Section";
import { IconArrowRight, IconBook, IconCode, IconShield, IconTile } from "../../components/art";
import { API_REFERENCE_URL, DOCS_URL, GATEWAY_URL, OPENAPI_URL, SITE_URL, WIDGET_SCRIPT_URL } from "../../lib/env";
import { DEFAULT_RATE_LIMIT_PER_MIN } from "../../lib/format";

const createSnippet = `// npm install stableflowr-sdk
import { Stableflowr } from "stableflowr-sdk";

const gateway = new Stableflowr({
  baseUrl: "${GATEWAY_URL}",
  apiKey: process.env.STABLEFLOWR_SECRET_KEY, // gw_live_… — server only
});

const payment = await gateway.createPayment({
  amount: "25.00",                 // USD
  description: "Pro plan, 1 month",
  reference: "order_1042",         // your order id
});`;

const checkoutSnippet = `import { checkoutUrl } from "stableflowr-sdk";

// Option A: redirect to the hosted checkout
res.redirect(checkoutUrl({
  checkoutBaseUrl: "${SITE_URL || "https://your-site"}",
  paymentId: payment.paymentId,
  publishableKey: process.env.STABLEFLOWR_PUBLISHABLE_KEY!, // pk_live_…
}));`;

const embedSnippet = `<!-- Option B: embed it in your page -->
<script type="module" src="${WIDGET_SCRIPT_URL}"></script>
<stableflowr-checkout
  publishable-key="pk_live_…"
  base-url="${GATEWAY_URL}"
  payment-id="PAYMENT_ID"
></stableflowr-checkout>`;

const webhookSnippet = `import { verifyWebhook } from "stableflowr-sdk";

app.post("/hooks/stableflowr", express.raw({ type: "application/json" }), async (req, res) => {
  const event = await verifyWebhook(
    req.body.toString(),
    req.header("stableflowr-signature"),
    process.env.STABLEFLOWR_WEBHOOK_SECRET!,
  );
  if (event.type === "payment.paid") await fulfilOrder(event.data.reference);
  res.sendStatus(200);
});`;

const curlSnippet = `curl -X POST ${GATEWAY_URL}/v1/payments \\
  -H "Authorization: Bearer $STABLEFLOWR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": "25.00", "reference": "order_1042" }'`;

const errors: [string, string][] = [
  ["400", "Invalid input: amount out of range, bad address, unsupported token, or no payout address set."],
  ["401", "Missing or wrong API key."],
  ["403", "A publishable key used where a secret key is needed, or from an origin not on the key."],
  ["404", "Not found, or it belongs to another account."],
  ["409", "The payment is already paid, expired or canceled."],
  ["429", `Rate limited. Default ${DEFAULT_RATE_LIMIT_PER_MIN} requests/min per key; wait and retry.`],
  ["502", "The upstream pricing or settlement provider failed. Safe to retry."],
];

const docsLink = (hash: string) => `${DOCS_URL}#${hash}`;

const resources: { href: string; title: string; body: string; icon: ReactNode }[] = [
  { href: DOCS_URL, title: "Documentation", body: "How payments work, end to end, with guides for every step.", icon: <IconBook /> },
  { href: API_REFERENCE_URL, title: "API reference", body: "Every endpoint with request and response schemas. Try calls live.", icon: <IconCode /> },
  { href: docsLink("security"), title: "Security model", body: "Non-custodial flow, key types, payer checks and signed webhooks.", icon: <IconShield /> },
];

function Step({ n, title, children, intro }: { n: number; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
      <div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">{n}</span>
        <h3 className="mt-4 text-xl sm:text-2xl">{title}</h3>
        <div className="mt-2 text-[15px] leading-relaxed text-ink-600">{intro}</div>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="font-medium text-ink-900 underline underline-offset-4">
    {children}
  </a>
);

export function Developers() {
  return (
    <>
      <PageHeader
        eyebrow="Developers"
        title="Build with Stableflowr"
        intro="A REST API and a typed SDK. Charge in dollars, let customers pay with any token, and receive USDC on ARC."
      />

      <section className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {resources.map((r) => (
            <a key={r.title} href={r.href} className="card group flex gap-4 p-5 transition hover:-translate-y-0.5 sm:flex-col sm:p-6">
              <IconTile>{r.icon}</IconTile>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                  {r.title}
                  <IconArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-600">{r.body}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <Section title="Accept a payment in three steps" intro="Server-side code in Node; any language works over REST.">
        <div className="space-y-14 sm:space-y-20">
          <Step
            n={1}
            title="Create a payment"
            intro={
              <>
                From your server, with your secret key, when the customer is ready to pay. You get back a{" "}
                <code className="font-mono text-ink-900">paymentId</code>.{" "}
                <A href={docsLink("payments")}>All options</A>
              </>
            }
          >
            <CodeBlock title="server.ts" code={createSnippet} />
          </Step>
          <Step
            n={2}
            title="Send the customer to checkout"
            intro={
              <>
                Redirect to the hosted page or embed the widget. Either way the customer connects their wallet, picks
                tokens and confirms. Your branding applies automatically. <A href={docsLink("checkout")}>Checkout guide</A>
              </>
            }
          >
            <CodeBlock title="server.ts" code={checkoutSnippet} />
            <CodeBlock title="checkout.html" code={embedSnippet} />
          </Step>
          <Step
            n={3}
            title="Fulfil on the webhook"
            intro={
              <>
                Settlement on ARC takes minutes. When it's done, a signed{" "}
                <code className="font-mono text-ink-900">payment.paid</code> webhook reaches your server.{" "}
                <A href={docsLink("webhooks")}>Webhooks guide</A>
              </>
            }
          >
            <CodeBlock title="webhooks.ts" code={webhookSnippet} />
          </Step>
        </div>
      </Section>

      <div className="bg-white">
        <Section title="REST API" intro={<>Base URL <code className="break-all font-mono text-[0.9em] text-ink-900">{GATEWAY_URL}</code>. Authenticate with a bearer token.</>}>
          <CodeBlock title="Create a payment" code={curlSnippet} />
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={API_REFERENCE_URL} className="btn-primary">
              Interactive API reference <IconArrowRight size={18} />
            </a>
            <a href={OPENAPI_URL} className="btn-secondary">
              OpenAPI spec
            </a>
          </div>
        </Section>
      </div>

      <Section title="Errors" intro={<>Every error is JSON <code className="font-mono text-[0.9em] text-ink-900">{"{ error: string }"}</code> with an HTTP status.</>}>
        <ul className="card divide-y divide-ink-900/5 overflow-hidden">
          {errors.map(([code, meaning]) => (
            <li key={code} className="flex items-start gap-4 px-5 py-4">
              <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-sm text-ink-900">{code}</span>
              <span className="text-[15px] leading-relaxed text-ink-600">{meaning}</span>
            </li>
          ))}
        </ul>
      </Section>

      <CtaPanel title="Ready when you are.">
        <Link to="/signup" className="btn-glass">
          Get your API keys <IconArrowRight size={18} />
        </Link>
        <a href={DOCS_URL} className="btn-outline-light">
          Read the docs
        </a>
      </CtaPanel>
    </>
  );
}
