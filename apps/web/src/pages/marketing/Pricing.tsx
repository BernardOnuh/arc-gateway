import { Link } from "react-router-dom";
import { CtaPanel, PageHeader, Section } from "../../components/Section";
import { IconArrowRight } from "../../components/art";
import { DEFAULT_FEE_BPS, DEFAULT_RATE_LIMIT_PER_MIN, formatBps } from "../../lib/format";

const exampleAmount = 1000;
const exampleFee = (exampleAmount * DEFAULT_FEE_BPS) / 10_000;

export function Pricing() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Pricing"
        intro="One transparent fee per transaction. No setup cost, no monthly minimum."
      />

      <Section title="The fee">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="card p-7">
            <p className="text-sm font-medium uppercase tracking-wider text-ink-600">Transaction fee</p>
            <p className="mt-2 text-6xl font-extrabold tracking-[-0.04em]">{formatBps(DEFAULT_FEE_BPS)}</p>
            <p className="mt-2 text-sm text-ink-600">{DEFAULT_FEE_BPS} basis points of the amount sent.</p>
          </div>
          <div className="card p-7">
            <p className="text-sm font-medium uppercase tracking-wider text-ink-600">API rate limit</p>
            <p className="mt-2 text-6xl font-extrabold tracking-[-0.04em]">{DEFAULT_RATE_LIMIT_PER_MIN}</p>
            <p className="mt-2 text-sm text-ink-600">requests per minute per key. Contact us for more.</p>
          </div>
          <div className="card p-7">
            <p className="text-sm font-medium uppercase tracking-wider text-ink-600">Setup</p>
            <p className="mt-2 text-6xl font-extrabold tracking-[-0.04em]">$0</p>
            <p className="mt-2 text-sm text-ink-600">Self-serve signup, key issued instantly.</p>
          </div>
        </div>
      </Section>

      <Section title="Worked example" intro="The fee comes out of amountIn; the rest is swapped and delivered on ARC.">
        <div className="card max-w-xl p-6">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-mist-100">
            <tr>
              <td className="py-2 text-ink-600">Customer sends (amountIn)</td>
              <td className="py-2 text-right font-mono">{exampleAmount.toFixed(2)} USDC</td>
            </tr>
            <tr>
              <td className="py-2 text-ink-600">Fee at {formatBps(DEFAULT_FEE_BPS)} (feeAmount)</td>
              <td className="py-2 text-right font-mono">−{exampleFee.toFixed(2)} USDC</td>
            </tr>
            <tr className="font-medium">
              <td className="py-3">Swapped to ARC (netAmount)</td>
              <td className="py-3 text-right font-mono text-ink-900">{(exampleAmount - exampleFee).toFixed(2)} USDC</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p className="mt-5 max-w-2xl text-sm text-ink-600">
          Formula: <code className="font-mono">feeAmount = amountIn × feeBps ÷ 10,000</code>. The quote response
          returns <code className="font-mono">feeAmount</code>, <code className="font-mono">netAmount</code> and{" "}
          <code className="font-mono">minOut</code>, so you can show your customer exactly what they get.
        </p>
      </Section>

      <CtaPanel title="Start now">
        <Link to="/signup" className="btn-glass">
          Get your API key <IconArrowRight size={18} />
        </Link>
      </CtaPanel>
    </>
  );
}
