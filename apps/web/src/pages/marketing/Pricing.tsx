import { Link } from "react-router-dom";
import { PageHeader, Section } from "../../components/Section";
import { DEFAULT_FEE_BPS, DEFAULT_RATE_LIMIT_PER_MIN, formatBps } from "../../lib/format";

const exampleAmount = 1000;
const exampleFee = (exampleAmount * DEFAULT_FEE_BPS) / 10_000;

export function Pricing() {
  return (
    <>
      <PageHeader
        title="Pricing"
        intro="One transparent fee per transaction. No setup cost, no monthly minimum."
      />

      <Section title="The fee">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Transaction fee</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{formatBps(DEFAULT_FEE_BPS)}</p>
            <p className="mt-2 text-sm text-slate-600">{DEFAULT_FEE_BPS} basis points of the amount sent.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">API rate limit</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{DEFAULT_RATE_LIMIT_PER_MIN}</p>
            <p className="mt-2 text-sm text-slate-600">requests per minute per key. Contact us for more.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-6">
            <p className="text-sm text-slate-500">Setup</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">$0</p>
            <p className="mt-2 text-sm text-slate-600">Self-serve signup, key issued instantly.</p>
          </div>
        </div>
      </Section>

      <Section title="Worked example" intro="The fee comes out of amountIn; the rest is swapped and delivered on ARC.">
        <table className="w-full max-w-lg text-sm">
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-2 text-slate-600">Customer sends (amountIn)</td>
              <td className="py-2 text-right font-mono">{exampleAmount.toFixed(2)} USDC</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">Fee at {formatBps(DEFAULT_FEE_BPS)} (feeAmount)</td>
              <td className="py-2 text-right font-mono">−{exampleFee.toFixed(2)} USDC</td>
            </tr>
            <tr className="font-medium">
              <td className="py-2">Swapped to ARC (netAmount)</td>
              <td className="py-2 text-right font-mono">{(exampleAmount - exampleFee).toFixed(2)} USDC</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 max-w-2xl text-sm text-slate-500">
          Formula: <code className="font-mono">feeAmount = amountIn × feeBps ÷ 10,000</code>. The quote response
          returns <code className="font-mono">feeAmount</code>, <code className="font-mono">netAmount</code> and{" "}
          <code className="font-mono">minOut</code>, so you can show your customer exactly what they get.
        </p>
      </Section>

      <Section title="Start now">
        <Link to="/signup" className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
          Get your API key
        </Link>
      </Section>
    </>
  );
}
