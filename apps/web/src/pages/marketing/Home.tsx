import { Link } from "react-router-dom";

export function Home() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Drop-in cross-chain gateway to ARC for your business
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Accept assets from Ethereum, Base and BNB Chain, settle on ARC, and earn a fee on every transaction.
      </p>
      <Link
        to="/signup"
        className="mt-8 inline-block rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
      >
        Get your API key
      </Link>
    </section>
  );
}
