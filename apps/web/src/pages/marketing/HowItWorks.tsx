import { Link } from "react-router-dom";
import { PageHeader, Section } from "../../components/Section";

const flow = [
  { name: "Your customer", detail: "Picks a source chain and token in your app" },
  { name: "Your business", detail: "Calls the gateway with your API key" },
  { name: "ARC Gateway", detail: "Prices the swap, applies your fee, routes the intent" },
  { name: "ARC network", detail: "Funds settle to the customer's address" },
];

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
        title="How it works"
        intro="ARC Gateway sits between your product and the ARC network. You keep the customer relationship; we handle routing and settlement."
      />

      <Section title="The flow">
        <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
          {flow.map((step, i) => (
            <li key={step.name} className="flex flex-1 items-center gap-3 md:flex-col md:items-stretch">
              <div className="flex-1 rounded-lg border border-slate-200 p-4">
                <p className="font-medium">{step.name}</p>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
              {i < flow.length - 1 && (
                <span aria-hidden className="text-slate-400 md:hidden">
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Who's who">
        <dl className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-5">
            <dt className="font-medium">Partner (you)</dt>
            <dd className="mt-1 text-sm text-slate-600">
              A business integrating the gateway. You hold the secret API key, register customers, and earn
              revenue on every transaction your customers make.
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-5">
            <dt className="font-medium">Customer</dt>
            <dd className="mt-1 text-sm text-slate-600">
              Your end user. They never see an API key. Each customer has an address that receives funds on ARC,
              and their transactions show up in your ledger.
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Transaction lifecycle" intro="Every submitted intent moves through these statuses. Poll it, or watch it in your dashboard.">
        <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {lifecycle.map((s) => (
            <li key={s.status} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6">
              <code className="w-48 shrink-0 font-mono text-sm text-brand-700">{s.status}</code>
              <span className="text-sm text-slate-600">{s.detail}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ready to integrate?">
        <div className="flex flex-wrap gap-3">
          <Link to="/signup" className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
            Get your API key
          </Link>
          <Link
            to="/developers"
            className="rounded-md border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Developer docs
          </Link>
        </div>
      </Section>
    </>
  );
}
