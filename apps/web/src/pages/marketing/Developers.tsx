import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { CtaPanel, PageHeader, Section } from "../../components/Section";
import { IconArrowRight } from "../../components/art";
import { GATEWAY_URL } from "../../lib/env";
import { DEFAULT_RATE_LIMIT_PER_MIN } from "../../lib/format";

const sdkSnippet = `import { GatewayClient } from "stableflow-sdk";

const gateway = new GatewayClient({
  baseUrl: "${GATEWAY_URL}",
  apiKey: process.env.ARC_GATEWAY_KEY, // gw_live_… (server-side only)
});

// 1. Register an end customer once
const customer = await gateway.createCustomer({
  externalId: "user_42",
  recipientAddress: "0x1111111111111111111111111111111111111111",
});

// 2. Get a fee-adjusted quote: 1 WETH on Base → USDC on ARC
const quote = await gateway.quote({
  originChainId: 8453,
  destChainId: 5042,
  tokenIn: "WETH",
  tokenOut: "USDC",
  amountIn: "1000000000000000000",
  recipient: customer.recipientAddress,
  slippageBps: 50,
  deadline: Math.floor(Date.now() / 1000) + 600,
  customerId: customer.customerId,
});
console.log(quote.feeAmount, quote.estimatedOut, quote.minOut);

// 3. Have the customer sign the intent, submit it, and wait for settlement
const signedPayload = await signWithCustomerWallet(quote); // your wallet integration
const intent = await gateway.submitAndPoll(
  { quoteId: quote.quoteId, signedPayload },
  { onUpdate: (i) => console.log(i.status) },
);`;

const curlSnippet = `curl -X POST ${GATEWAY_URL}/v1/quotes \\
  -H "Authorization: Bearer $ARC_GATEWAY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "originChainId": 8453,
    "destChainId": 5042,
    "tokenIn": "WETH",
    "tokenOut": "USDC",
    "amountIn": "1000000000000000000",
    "recipient": "0x1111111111111111111111111111111111111111",
    "slippageBps": 50,
    "deadline": 1893456000
  }'`;

const errors = [
  ["400", "Invalid input: unknown chain or token, bad amount, past deadline, or a customerId you don't own."],
  ["401", "Missing or wrong API key."],
  ["409", "Signup email is already registered."],
  ["429", `Rate limited. Default ${DEFAULT_RATE_LIMIT_PER_MIN} requests/min per key; wait and retry.`],
  ["502", "The upstream pricing or settlement provider failed. Safe to retry."],
];

export function Developers() {
  return (
    <>
      <PageHeader
        eyebrow="Docs"
        title="Developers"
        intro="A typed TypeScript SDK and a plain REST API. Every response is JSON; every error is { error: string }."
      />

      <Section title="TypeScript SDK" intro="stableflow-sdk wraps every endpoint with typed requests and responses.">
        <CodeBlock title="server.ts" code={sdkSnippet} />
        <p className="mt-4 text-sm text-ink-600">
          Keep your <code className="font-mono">gw_live_</code> key on your server. Never ship it to a browser or mobile
          app.
        </p>
      </Section>

      <Section title="REST API" intro="Prefer raw HTTP? Authenticate with a bearer token.">
        <CodeBlock title="Request a quote" code={curlSnippet} />
        <p className="mt-4 text-sm text-ink-600">
          Full reference with request and response schemas:{" "}
          <a href={`${GATEWAY_URL}/docs`} className="font-medium text-ink-900 underline underline-offset-4">
            interactive API docs
          </a>{" "}
          ·{" "}
          <a href={`${GATEWAY_URL}/openapi.json`} className="font-medium text-ink-900 underline underline-offset-4">
            OpenAPI spec
          </a>
        </p>
      </Section>

      <Section title="Errors">
        <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mist-200 bg-mist-50 text-left text-ink-600">
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-100">
            {errors.map(([code, meaning]) => (
              <tr key={code}>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-ink-900">{code}</span>
                </td>
                <td className="px-5 py-3 text-ink-600">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Section>

      <CtaPanel title="Get started">
        <Link to="/signup" className="btn-glass">
          Get your API key <IconArrowRight size={18} />
        </Link>
      </CtaPanel>
    </>
  );
}
