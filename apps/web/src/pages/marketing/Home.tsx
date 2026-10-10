import { Link } from "react-router-dom";
import { CtaPanel, Section } from "../../components/Section";
import { SupportedNetworks } from "../../components/SupportedNetworks";
import {
  GlowBackdrop,
  HeroNetwork,
  IconArrowRight,
  IconBolt,
  IconChart,
  IconCheck,
  IconCode,
  IconKey,
  IconShield,
  IconTile,
  IconUsers,
} from "../../components/art";
import { DEFAULT_FEE_BPS, formatBps } from "../../lib/format";

const steps = [
  {
    icon: <IconKey />,
    title: "Get an API key",
    body: "Sign up with your business name. You get a secret key instantly. No sales call, no waiting.",
  },
  {
    icon: <IconUsers />,
    title: "Register your customers",
    body: "Add each end customer once with their receiving address, so every transaction is attributed to them.",
  },
  {
    icon: <IconBolt />,
    title: "Quote, submit, settle on ARC",
    body: "Request a fee-adjusted quote, submit the signed intent, and track it until it executes on ARC.",
  },
];

const features = [
  { icon: <IconCode />, title: "Typed SDK + REST", body: "One client for quotes, intents, customers and your ledger." },
  { icon: <IconShield />, title: "Keys that stay secret", body: "Server keys never touch a browser. The widget uses origin-locked publishable keys." },
  { icon: <IconChart />, title: "Revenue per customer", body: "Every fee is attributed. Export the ledger as CSV any time." },
];

export function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <GlowBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
          <div>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" /> Live on ARC
            </span>
            <h1 className="mt-5 max-w-2xl text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl">
              Drop-in <span className="text-gradient">cross-chain gateway to ARC</span> for your business
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-300">
              Accept assets from Ethereum, Base and BNB Chain, settle on ARC, and earn a fee on every transaction.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">
                Get your API key <IconArrowRight size={18} />
              </Link>
              <Link to="/developers" className="btn-ghost-dark">
                Read the docs
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
              {["Self-serve in a minute", `${formatBps(DEFAULT_FEE_BPS)} per transaction`, "No monthly minimum"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <IconCheck size={16} className="text-accent-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroNetwork className="mx-auto w-full max-w-[520px]" />
        </div>
      </section>

      <div className="bg-slate-50">
        <Section eyebrow="Three steps" title="How it works" intro="Three steps from signup to your first settled transaction.">
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="card relative p-6">
                <div className="flex items-center justify-between">
                  <IconTile>{step.icon}</IconTile>
                  <span className="font-display text-4xl font-semibold text-slate-100">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/how-it-works"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            See the full flow <IconArrowRight size={16} />
          </Link>
        </Section>
      </div>

      <Section eyebrow="Pricing" title="Simple fee model">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.2fr]">
          <div className="card p-7">
            <p className="font-display text-5xl font-semibold text-gradient-dark">{formatBps(DEFAULT_FEE_BPS)}</p>
            <p className="mt-3 text-slate-600">
              per transaction, taken from the amount sent. Every quote shows the fee before your customer commits.
            </p>
          </div>
          <div className="card p-7">
            <p className="font-display text-5xl font-semibold text-gradient-dark">$0</p>
            <p className="mt-3 text-slate-600">to sign up. No monthly minimum. Revenue per customer is in your dashboard.</p>
          </div>
          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <IconTile>{f.icon}</IconTile>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-slate-600">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Link
          to="/pricing"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Pricing details <IconArrowRight size={16} />
        </Link>
      </Section>

      <div className="border-t border-slate-200 bg-slate-50">
        <Section
          eyebrow="Networks"
          title="Supported networks"
          intro="Live from the gateway. Assets move from these source chains to ARC."
        >
          <SupportedNetworks />
        </Section>
      </div>

      <div className="bg-slate-50">
        <CtaPanel title="Ship cross-chain deposits to ARC this week.">
          <Link to="/signup" className="btn-primary">
            Get your API key <IconArrowRight size={18} />
          </Link>
          <Link to="/developers" className="btn-ghost-dark">
            Developer docs
          </Link>
        </CtaPanel>
      </div>
    </>
  );
}
