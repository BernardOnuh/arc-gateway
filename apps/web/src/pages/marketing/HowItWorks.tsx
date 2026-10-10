import { Link } from "react-router-dom";
import { CtaPanel, PageHeader, Section } from "../../components/Section";
import { IconArrowRight, IconLayers, IconSwap, IconTile, IconUsers, IconWallet } from "../../components/art";

const flow = [
  { icon: <IconUsers />, name: "Your customer", detail: "Picks a source chain and token in your app" },
  { icon: <IconLayers />, name: "Your business", detail: "Calls the gateway with your API key" },
  { icon: <IconSwap />, name: "ARC Gateway", detail: "Prices the swap, applies your fee, routes the intent" },
  { icon: <IconWallet />, name: "ARC network", detail: "Funds settle to the customer's address" },
];

const lifecycleTone: Record<string, string> = {
  PENDING: "bg-slate-300",
  ORIGIN_CONFIRMED: "bg-blue-400",
  FILLED: "bg-brand-400",
  EXECUTED_ON_ARC: "bg-emerald-400",
  "FAILED / REFUNDED": "bg-rose-400",
};

const lifecycle = [
  { status: "PENDING", detail: "Intent accepted, waiting for the origin transaction." },
  { status: "ORIGIN_CONFIRMED", detail: "Funds confirmed on the source chain." },
  { status: "FILLED", detail: "A solver filled the order." },
  { status: "EXECUTED_ON_ARC", detail: "Settled on ARC. Done." },
  { status: "FAILED / REFUNDED", detail: "Something went wrong; the reason is on the intent." },
];

export function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow="The flow"
        title="How it works"
        intro="ARC Gateway sits between your product and the ARC network. You keep the customer relationship; we handle routing and settlement."
      />

      <Section title="The flow">
        <ol className="relative grid gap-4 md:grid-cols-4">
          {/* connector line behind the cards on desktop */}
          <span
            aria-hidden
            className="absolute left-[12%] right-[12%] top-[46px] hidden h-px bg-gradient-to-r from-brand-400 via-[#7aa2ff] to-accent-400 md:block"
          />
          {flow.map((step, i) => (
            <li key={step.name} className="card relative p-5">
              <div className="flex items-center gap-3">
                <IconTile>{step.icon}</IconTile>
                <span className="font-mono text-xs text-slate-400">step {i + 1}</span>
              </div>
              <p className="mt-4 font-display text-lg font-semibold">{step.name}</p>
              <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <div className="bg-slate-50">
      <Section title="Who's who">
        <dl className="grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <dt className="font-display text-lg font-semibold">Partner (you)</dt>
            <dd className="mt-1 text-sm text-slate-600">
              A business integrating the gateway. You hold the secret API key, register customers, and earn
              revenue on every transaction your customers make.
            </dd>
          </div>
          <div className="card p-6">
            <dt className="font-display text-lg font-semibold">Customer</dt>
            <dd className="mt-1 text-sm text-slate-600">
              Your end user. They never see an API key. Each customer has an address that receives funds on ARC,
              and their transactions show up in your ledger.
            </dd>
          </div>
        </dl>
      </Section>
      </div>

      <Section title="Transaction lifecycle" intro="Every submitted intent moves through these statuses. Poll it, or watch it in your dashboard.">
        <ol className="card divide-y divide-slate-100 overflow-hidden">
          {lifecycle.map((s) => (
            <li key={s.status} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
              <code className="flex w-56 shrink-0 items-center gap-2.5 font-mono text-sm text-brand-700">
                <span aria-hidden className={`h-2 w-2 rounded-full ${lifecycleTone[s.status]}`} />
                {s.status}
              </code>
              <span className="text-sm text-slate-600">{s.detail}</span>
            </li>
          ))}
        </ol>
      </Section>

      <CtaPanel title="Ready to integrate?">
        <Link to="/signup" className="btn-primary">
          Get your API key <IconArrowRight size={18} />
        </Link>
        <Link to="/developers" className="btn-ghost-dark">
          Developer docs
        </Link>
      </CtaPanel>
    </>
  );
}
