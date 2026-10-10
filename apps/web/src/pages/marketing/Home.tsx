import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CtaPanel, Section } from "../../components/Section";
import { SupportedNetworks } from "../../components/SupportedNetworks";
import {
  IconArrowRight,
  IconBolt,
  IconChart,
  IconCode,
  IconKey,
  IconShield,
  IconTile,
  IconUsers,
  ProductPreview,
  SkyBackdrop,
} from "../../components/art";
import { Reveal, useScrollProgress } from "../../components/motion";
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
  {
    icon: <IconShield />,
    title: "Keys that stay secret",
    body: "Server keys never touch a browser. The widget uses origin-locked publishable keys.",
  },
  { icon: <IconChart />, title: "Revenue per customer", body: "Every fee is attributed. Export the ledger as CSV any time." },
];

/** Business-name pill: carries the name into signup so the form starts filled in. */
function StartForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate("/signup", { state: { partnerName: name.trim() } });
  }
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-9 flex max-w-lg items-center gap-2 rounded-full bg-snow/15 p-1.5 pl-6 ring-1 ring-snow/50 backdrop-blur-md"
    >
      <label htmlFor="hero-business" className="sr-only">
        Business name
      </label>
      <input
        id="hero-business"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your business name"
        className="min-w-0 flex-1 bg-transparent text-snow placeholder:text-snow/75 focus:outline-none"
      />
      <button type="submit" className="btn-glass shrink-0 px-5 py-2.5">
        Start free
      </button>
    </form>
  );
}

export function Home() {
  // Hero preview starts high and leaning back, then comes down into place and swings upright as you scroll.
  const heroPreview = useScrollProgress<HTMLDivElement>(0.98, 0.32);
  // The second preview floats down from above, like a cloud settling, as it scrolls into view.
  const sidePreview = useScrollProgress<HTMLDivElement>(1.05, 0.45);
  return (
    <>
      <section className="relative overflow-hidden">
        <SkyBackdrop fade parallax />
        <div className="relative mx-auto max-w-6xl px-4 pt-36 text-center text-snow sm:pt-44">
          <h1 className="mx-auto max-w-5xl animate-rise text-[2.9rem] leading-[1.02] sm:text-[4.6rem]">
            Drop-in cross-chain gateway to ARC for your business
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-lg leading-relaxed text-snow/90 [animation-delay:120ms]">
            Accept assets from Ethereum, Base and BNB Chain, settle on ARC, and earn a fee on every transaction.
          </p>
          <div className="animate-rise [animation-delay:220ms]">
            <StartForm />
          </div>
          <p className="mt-4 animate-rise text-sm text-snow/80 [animation-delay:300ms]">
            Or{" "}
            <Link to="/developers" className="font-semibold text-snow underline-offset-4 hover:underline">
              read the docs
            </Link>{" "}
            · {formatBps(DEFAULT_FEE_BPS)} per transaction · no monthly minimum
          </p>
          <div className="mt-14 animate-rise [animation-delay:380ms] sm:mt-16">
            <div
              ref={heroPreview}
              className="glass mx-auto max-w-5xl origin-bottom rounded-t-[34px] p-2 pb-0 will-change-transform sm:p-3 sm:pb-0"
              style={{
                transform:
                  "perspective(1400px) translateY(calc((1 - var(--p, 0)) * -110px)) rotateX(calc((1 - var(--p, 0)) * 40deg)) scale(calc(0.86 + var(--p, 0) * 0.14))",
              }}
            >
              <ProductPreview className="rounded-b-none text-left" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Three steps</p>
            <h2 className="text-4xl leading-[1.08] sm:text-5xl">How it works</h2>
            <hr className="my-6 border-ink-900/10" />
            <p className="text-lg leading-relaxed tracking-wide text-ink-600">
              Three steps from signup to your first settled transaction.
            </p>
            <ol className="mt-8 space-y-5">
              {steps.map((step) => (
                <li key={step.title} className="flex gap-4">
                  <IconTile>{step.icon}</IconTile>
                  <div>
                    <h3 className="text-lg">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/how-it-works" className="btn-secondary mt-9">
              See the full flow <IconArrowRight size={18} />
            </Link>
          </Reveal>
          <div className="relative -mr-4 sm:-mr-40 lg:-mr-72">
            <div aria-hidden className="absolute -inset-10 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
            <div className="animate-float [animation-duration:9s]">
              <div
                ref={sidePreview}
                className="origin-left will-change-transform"
                style={{
                  transform:
                    "perspective(2200px) translateY(calc((1 - var(--p, 0)) * -180px)) rotateY(-16deg) rotateX(calc(16deg - var(--p, 0) * 11deg)) rotateZ(1deg)",
                  opacity: "calc(0.1 + var(--p, 0) * 0.9)",
                }}
              >
                <ProductPreview className="shadow-float" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-white">
        <Section eyebrow="Pricing" title="Simple fee model">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.2fr]">
            <div className="rounded-3xl bg-card-sheen p-8">
              <p className="font-display text-6xl font-semibold tracking-[-0.045em]">{formatBps(DEFAULT_FEE_BPS)}</p>
              <p className="mt-4 leading-relaxed text-ink-700">
                per transaction, taken from the amount sent. Every quote shows the fee before your customer commits.
              </p>
            </div>
            <div className="rounded-3xl bg-mist-100 p-8">
              <p className="font-display text-6xl font-semibold tracking-[-0.045em]">$0</p>
              <p className="mt-4 leading-relaxed text-ink-700">
                to sign up. No monthly minimum. Revenue per customer is in your dashboard.
              </p>
            </div>
            <ul className="space-y-5 lg:pl-4">
              {features.map((f) => (
                <li key={f.title} className="flex gap-4">
                  <IconTile tone="dark">{f.icon}</IconTile>
                  <div>
                    <p className="font-bold">{f.title}</p>
                    <p className="text-[15px] leading-relaxed text-ink-600">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/pricing"
            className="mt-10 inline-flex items-center gap-1.5 font-semibold text-ink-900 underline-offset-4 hover:underline"
          >
            Pricing details <IconArrowRight size={16} />
          </Link>
        </Section>
      </div>

      <Section
        eyebrow="Networks"
        title="Supported networks"
        intro="Live from the gateway. Assets move from these source chains to ARC."
      >
        <SupportedNetworks />
      </Section>

      <CtaPanel title="Ship cross-chain deposits to ARC this week.">
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
