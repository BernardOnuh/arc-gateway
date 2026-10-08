import { Link } from "react-router-dom";
import { Section } from "../../components/Section";
import { SupportedNetworks } from "../../components/SupportedNetworks";
import { DEFAULT_FEE_BPS, formatBps } from "../../lib/format";

const steps = [
  {
    title: "Get an API key",
    body: "Sign up with your business name. You get a secret key instantly. No sales call, no waiting.",
  },
  {
    title: "Register your customers",
    body: "Add each end customer once with their receiving address, so every transaction is attributed to them.",
  },
  {
    title: "Quote, submit, settle on ARC",
    body: "Request a fee-adjusted quote, submit the signed intent, and track it until it executes on ARC.",
  },
];

export function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Drop-in cross-chain gateway to ARC for your business
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Accept assets from Ethereum, Base and BNB Chain, settle on ARC, and earn a fee on every transaction.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="inline-block rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
          >
            Get your API key
          </Link>
          <Link
            to="/developers"
            className="inline-block rounded-md border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Read the docs
          </Link>
        </div>
      </section>

      <div className="border-y border-slate-200 bg-slate-50">
        <Section title="How it works" intro="Three steps from signup to your first settled transaction.">
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-slate-200 bg-white p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
          <Link to="/how-it-works" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
            See the full flow →
          </Link>
        </Section>
      </div>

      <Section title="Simple fee model">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-6">
            <p className="text-4xl font-semibold tracking-tight">{formatBps(DEFAULT_FEE_BPS)}</p>
            <p className="mt-2 text-slate-600">
              per transaction, taken from the amount sent. Every quote shows the fee before your customer commits.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-6">
            <p className="text-4xl font-semibold tracking-tight">$0</p>
            <p className="mt-2 text-slate-600">to sign up. No monthly minimum. Revenue per customer is in your dashboard.</p>
          </div>
        </div>
        <Link to="/pricing" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
          Pricing details →
        </Link>
      </Section>

      <div className="border-t border-slate-200">
        <Section title="Supported networks" intro="Live from the gateway. Assets move from these source chains to ARC.">
          <SupportedNetworks />
        </Section>
      </div>
    </>
  );
}
