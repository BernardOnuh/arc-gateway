import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { CtaPanel, PageHeader, Section } from "../../components/Section";
import { Reveal } from "../../components/motion";
import {
  IconArrowRight,
  IconLayers,
  IconShield,
  IconSwap,
  IconTile,
  IconUsers,
  IconWallet,
} from "../../components/art";
import { DEFAULT_FEE_BPS, formatBps } from "../../lib/format";

const flow = [
  { icon: <IconUsers />, name: "Your customer", detail: "Picks a source chain and token in your app" },
  { icon: <IconLayers />, name: "Your business", detail: "Calls the gateway with your API key" },
  { icon: <IconSwap />, name: "Stableflowr", detail: "Prices the swap, applies your fee, routes the intent" },
  { icon: <IconWallet />, name: "ARC network", detail: "Funds settle to the customer's address" },
];

const lifecycle = [
  { status: "PENDING", detail: "Intent accepted, waiting for the origin transaction.", tone: "bg-mist-300" },
  { status: "ORIGIN_CONFIRMED", detail: "Funds confirmed on the source chain.", tone: "bg-blue-400" },
  { status: "FILLED", detail: "A solver filled the order.", tone: "bg-brand-500" },
  { status: "EXECUTED_ON_ARC", detail: "Settled on ARC. Done.", tone: "bg-emerald-500" },
  { status: "FAILED / REFUNDED", detail: "Something went wrong; the reason is on the intent.", tone: "bg-rose-400" },
];

const faqs = [
  {
    q: "Do my customers ever see an API key?",
    a: "No. Your secret key stays on your server. If you embed the swap widget, it uses a publishable key that only works from the websites you list and can't submit intents or read your data.",
  },
  {
    q: "How much does it cost?",
    a: `${formatBps(DEFAULT_FEE_BPS)} of the amount sent, taken in the source token. Every quote returns the fee, the net amount and the minimum the customer receives before they commit. No setup fee, no monthly minimum.`,
  },
  {
    q: "Which chains and tokens are supported?",
    a: "Ethereum, Base and BNB Chain as sources, settling on ARC. The live list (with token contracts) is on the home page and at GET /v1/chains and /v1/tokens.",
  },
  {
    q: "How do I know when a transaction is done?",
    a: "Poll GET /v1/intents/:id or watch the Transactions page in your dashboard. EXECUTED_ON_ARC means it settled, with the destination transaction hash attached.",
  },
  {
    q: "What happens if a swap fails?",
    a: "The intent moves to FAILED or REFUNDED with the reason recorded on it, and it shows up in your dashboard so you can follow up with the customer.",
  },
];

/** Animated row of the four parties with a packet travelling between them. */
function FlowDiagram() {
  return (
    <ol className="relative grid gap-4 md:grid-cols-4 md:gap-6">
      {flow.map((step, i) => (
        <Reveal as="li" key={step.name} delay={i * 110} className="relative">
          <div className="card h-full p-6">
            <div className="flex items-center justify-between">
              <IconTile tone={i === 2 ? "dark" : "light"}>{step.icon}</IconTile>
              <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
            </div>
            <p className="mt-5 font-display text-lg font-semibold">{step.name}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.detail}</p>
          </div>
          {i < flow.length - 1 && (
            <span aria-hidden className="absolute -right-6 top-1/2 hidden h-px w-6 overflow-visible md:block">
              <span className="absolute inset-0 border-t-2 border-dashed border-brand-300" />
              <span
                className="absolute -top-[5px] left-0 h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_12px_rgb(var(--brand-500))] motion-safe:animate-[packet_2.4s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.8}s` }}
              />
            </span>
          )}
        </Reveal>
      ))}
    </ol>
  );
}

/** A quote, as your customer would see it. */
function QuotePreview() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink-600">Quote</span>
        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-ink-800">expires in 60s</span>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-2xl bg-mist-100 p-4">
          <p className="text-xs text-ink-600">You send · Base</p>
          <p className="mt-1 font-display text-2xl font-semibold">1.00 WETH</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-white">
          <IconArrowRight size={16} />
        </span>
        <div className="rounded-2xl bg-card-sheen p-4">
          <p className="text-xs text-ink-700">You receive · ARC</p>
          <p className="mt-1 font-display text-2xl font-semibold">≈ 2,478 USDC</p>
        </div>
      </div>
      <dl className="mt-5 space-y-2 text-sm">
        {[
          ["Partner fee (feeAmount)", `0.001 WETH · ${formatBps(DEFAULT_FEE_BPS)}`],
          ["Swapped (netAmount)", "0.999 WETH"],
          ["Minimum received (minOut)", "2,465.6 USDC"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-t border-mist-200 pt-2">
            <dt className="text-ink-600">{k}</dt>
            <dd className="font-mono text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const statuses = ["PENDING", "ORIGIN_CONFIRMED", "FILLED", "EXECUTED_ON_ARC"];

/** Status tracker that steps through the lifecycle on a loop. */
function LiveStatus() {
  const [step, setStep] = useState(statuses.length - 1);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % (statuses.length + 1)), 1500);
    return () => clearInterval(id);
  }, []);
  const current = Math.min(step, statuses.length - 1);
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono text-xs text-ink-600">intent · 7f3c…e21a</span>
        <span
          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
            current === statuses.length - 1 ? "bg-emerald-50 text-emerald-700" : "bg-brand-100 text-brand-700"
          }`}
        >
          {statuses[current]}
        </span>
      </div>
      <ol className="mt-6 space-y-0">
        {statuses.map((s, i) => {
          const done = i <= current;
          return (
            <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
              {i < statuses.length - 1 && (
                <span aria-hidden className="absolute left-[11px] top-6 h-full w-0.5 bg-mist-200">
                  <span
                    className="block w-full bg-ink-900 transition-all duration-700"
                    style={{ height: i < current ? "100%" : "0%" }}
                  />
                </span>
              )}
              <span
                className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-500 ${
                  done ? "border-ink-900 bg-ink-900 text-white" : "border-mist-300 bg-white"
                }`}
              >
                {done && (
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <div className={`transition-opacity duration-500 ${done ? "opacity-100" : "opacity-45"}`}>
                <p className="font-mono text-sm text-ink-900">{s}</p>
                <p className="text-xs text-ink-600">
                  {["Accepted by the gateway", "Seen on Base", "Solver filled the order", "Delivered to 0x11…1111 on ARC"][i]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Revenue preview: what you earn, per customer. */
function EarningsPreview() {
  const rows = [
    ["user_42", "4 swaps", "0.0041 WETH"],
    ["user_77", "9 swaps", "12.40 USDC"],
    ["user_105", "2 swaps", "3.10 USDC"],
  ];
  return (
    <div className="card p-6">
      <p className="text-sm font-medium text-ink-600">Fees earned this month</p>
      <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">1,284.20 USDC</p>
      <ul className="mt-5 divide-y divide-mist-200 text-sm">
        {rows.map(([who, n, fee]) => (
          <li key={who} className="flex items-center justify-between py-2.5">
            <span className="font-mono text-ink-900">{who}</span>
            <span className="text-ink-600">{n}</span>
            <span className="font-mono text-ink-900">{fee}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const submitSnippet = `// Your server, after the customer signs the quote in your app
const { intentId } = await gateway.submitIntent({
  quoteId: quote.quoteId,
  signedPayload,
});

const intent = await gateway.getIntent(intentId);
console.log(intent.status); // "PENDING" → … → "EXECUTED_ON_ARC"`;

function StepRow({
  n,
  title,
  body,
  visual,
  flip = false,
}: {
  n: number;
  title: string;
  body: ReactNode;
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={flip ? "lg:order-2" : ""}>
        <span className="font-mono text-sm text-brand-600">Step {n}</span>
        <h3 className="mt-2 text-2xl sm:text-3xl">{title}</h3>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-600">{body}</div>
      </Reveal>
      <Reveal delay={150} className={flip ? "lg:order-1" : ""}>
        {visual}
      </Reveal>
    </div>
  );
}

export function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow="The flow"
        title="How it works"
        intro="Stableflowr sits between your product and the ARC network. You keep the customer relationship; we handle pricing, routing and settlement."
      />

      <Section title="One request, four parties" intro="Your customer never leaves your product; the gateway does the cross-chain work behind it.">
        <FlowDiagram />
      </Section>

      <div className="bg-white">
        <Section eyebrow="Step by step" title="From quote to settlement">
          <div className="space-y-20 sm:space-y-28">
            <StepRow
              n={1}
              title="Request a quote"
              body={
                <>
                  <p>
                    Your server asks for a quote with the source chain, token and amount. The gateway prices the swap
                    and takes your fee off the top, so the customer sees exactly what arrives on ARC.
                  </p>
                  <p>Attach a customerId and every quote is attributed to that customer in your ledger.</p>
                </>
              }
              visual={<QuotePreview />}
            />
            <StepRow
              n={2}
              flip
              title="Submit the signed intent"
              body={
                <>
                  <p>
                    When the customer accepts, submit the quote from your server with your secret key. Submitting is
                    idempotent per quote, so retries never double-spend.
                  </p>
                  <p>Publishable keys can quote from the browser but can never submit.</p>
                </>
              }
              visual={<CodeBlock title="server.ts" code={submitSnippet} />}
            />
            <StepRow
              n={3}
              title="Track it until it settles"
              body={
                <p>
                  Each intent moves through a small set of statuses. Poll it, or watch it update live on the
                  Transactions page of your dashboard.
                </p>
              }
              visual={<LiveStatus />}
            />
            <StepRow
              n={4}
              flip
              title="Earn on every transaction"
              body={
                <p>
                  Fees land in your ledger per customer and per token. Export to CSV whenever you reconcile.
                </p>
              }
              visual={<EarningsPreview />}
            />
          </div>
        </Section>
      </div>

      <Section title="Who's who">
        <dl className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <IconLayers />,
              t: "Partner (you)",
              d: "A business integrating the gateway. You hold the secret API key, register customers, and earn revenue on every transaction your customers make.",
            },
            {
              icon: <IconUsers />,
              t: "Customer",
              d: "Your end user. They never see an API key. Each customer has an address that receives funds on ARC, and their transactions show up in your ledger.",
            },
            {
              icon: <IconShield />,
              t: "Stableflowr",
              d: "Prices and routes every swap, enforces your keys' permissions and rate limits, and records each intent until it settles.",
            },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 100} className={`rounded-3xl p-7 ${i === 0 ? "bg-card-sheen" : "card"}`}>
              <IconTile tone={i === 0 ? "dark" : "light"}>{c.icon}</IconTile>
              <dt className="mt-5 font-display text-lg font-semibold">{c.t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-600">{c.d}</dd>
            </Reveal>
          ))}
        </dl>
      </Section>

      <div className="bg-white">
        <Section
          title="Transaction lifecycle"
          intro="Every submitted intent moves through these statuses. Poll it, or watch it in your dashboard."
        >
          <ol className="card divide-y divide-mist-200 overflow-hidden">
            {lifecycle.map((s) => (
              <li key={s.status} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-7">
                <code className="flex w-60 shrink-0 items-center gap-3 font-mono text-sm text-ink-900">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${s.tone}`} />
                  {s.status}
                </code>
                <span className="text-sm text-ink-600">{s.detail}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <Section title="Questions" intro="The short answers. The API reference has the long ones.">
        <div className="grid gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-medium">
                {f.q}
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist-100 text-ink-700 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <CtaPanel title="Ready to integrate?">
        <Link to="/signup" className="btn-glass">
          Get your API key <IconArrowRight size={18} />
        </Link>
        <Link to="/developers" className="btn-outline-light">
          Developer docs
        </Link>
      </CtaPanel>
    </>
  );
}
