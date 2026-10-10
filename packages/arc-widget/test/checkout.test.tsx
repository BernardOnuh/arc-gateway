import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArcCheckout, type Eip1193Provider } from "../src/index.js";
import { defineArcCheckout } from "../src/element.js";

const PK = "pk_live_test";
const ACCOUNT = "0x00000000000000000000000000000000000000bb";
const PAYOUT = "0x00000000000000000000000000000000000000aa";
const TX = (n: number) => `0x${String(n).repeat(64).slice(0, 64)}`;

const chains = [
  { id: 1, name: "Ethereum", isArc: false, testnet: false, explorerUrl: "https://etherscan.io", rpcUrl: "https://rpc.eth.test" },
  { id: 8453, name: "Base", isArc: false, testnet: false, explorerUrl: "https://basescan.org", rpcUrl: "https://rpc.base.test" },
  { id: 5042, name: "Arc", isArc: true, testnet: false, explorerUrl: "https://explorer.arc.io", rpcUrl: "https://rpc.arc.test" },
];
const prices = [
  { chainId: 8453, symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, isNative: false, priceUsd: 1 },
  { chainId: 1, symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true, priceUsd: 2500 },
  { chainId: 1, symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6, isNative: false, priceUsd: 1 },
];
// Wallet: 6 USDC on Base, 0.002 ETH on Ethereum ($5, $4.25 usable after the gas reserve), no USDT.
const balances: Record<string, Record<string, bigint>> = {
  "https://rpc.base.test": { USDC: 6_000_000n },
  "https://rpc.eth.test": { ETH: 2_000_000_000_000_000n, USDT: 0n },
};

type Status = "open" | "processing" | "paid" | "partially_paid" | "expired";

/**
 * Fake gateway + RPC nodes. Legs are recorded as they're quoted/submitted;
 * `settle` decides each submitted leg's final status once the payment has been
 * read more than `settleAfter` times.
 */
function setup({
  amountCents = 1000,
  status = "open" as Status,
  settle = (_i: number) => "EXECUTED_ON_ARC" as "EXECUTED_ON_ARC" | "FAILED",
  settleAfter = 1,
} = {}) {
  const legs: any[] = [];
  let polls = 0;
  const payment = () => {
    const settled = legs.filter((l) => l.status === "EXECUTED_ON_ARC").reduce((s, l) => s + l.valueCents, 0);
    const pending = legs.filter((l) => l.status === "PENDING").reduce((s, l) => s + l.valueCents, 0);
    const st: Status =
      status === "expired" ? "expired" : settled >= amountCents ? "paid" : pending ? "processing" : settled ? "partially_paid" : "open";
    return {
      paymentId: "p-1",
      merchantName: "Acme Pay",
      amountCents,
      currency: "USD",
      description: "Pro plan",
      reference: "order_7",
      status: st,
      paidCents: settled,
      pendingCents: pending,
      remainingCents: Math.max(0, amountCents - settled - pending),
      destChainId: 5042,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      paidAt: st === "paid" ? new Date().toISOString() : null,
      legs,
    };
  };
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.startsWith("https://rpc.")) {
      const node = new URL(url).origin;
      const batch = JSON.parse(String(init.body)) as { id: number; method: string; params: any[] }[];
      return json(
        200,
        batch.map((r) => {
          const token = r.method === "eth_getBalance" ? "ETH" : prices.find((p) => p.address === r.params[0].to)!.symbol;
          return { jsonrpc: "2.0", id: r.id, result: `0x${(balances[node]?.[token] ?? 0n).toString(16)}` };
        })
      );
    }
    const path = new URL(url).pathname;
    if (path === "/v1/chains") return json(200, chains);
    if (path === "/v1/prices") return json(200, { source: "reference", items: prices });
    if (path === "/v1/payments/p-1" && (init.method ?? "GET") === "GET") {
      polls++;
      for (const [i, l] of legs.entries()) if (l.status === "PENDING" && polls > settleAfter) Object.assign(l, { status: settle(i), destTx: TX(i + 5) });
      return json(200, payment());
    }
    if (path === "/v1/payments/p-1/legs") {
      const body = JSON.parse(String(init.body));
      const p = prices.find((x) => x.chainId === body.originChainId && x.symbol === body.tokenIn)!;
      const valueCents = Math.floor((Number(body.amountIn) / 10 ** p.decimals) * p.priceUsd * 100 * 0.995);
      const leg = {
        legId: `leg-${legs.length + 1}`,
        quoteId: `q-${legs.length + 1}`,
        originChainId: body.originChainId,
        token: { symbol: p.symbol, address: p.address, decimals: p.decimals, isNative: p.isNative },
        amountIn: body.amountIn,
        valueCents,
        payer: body.payer,
        status: "QUOTED",
        originTx: null,
        destTx: null,
        execution: { fromChain: body.originChainId === 1 ? "Ethereum" : "Base", toChain: "Arc", tokenIn: p.isNative ? "NATIVE" : p.symbol, tokenOut: "USDC", amountIn: "x", recipientAddress: PAYOUT, slippageBps: 50 },
      };
      legs.push(leg);
      return json(201, leg);
    }
    const sub = path.match(/^\/v1\/payments\/p-1\/legs\/(leg-\d+)\/submitted$/);
    if (sub) {
      const leg = legs.find((l) => l.legId === sub[1]);
      Object.assign(leg, { status: "PENDING", originTx: JSON.parse(String(init.body)).txHash });
      return json(200, leg);
    }
    return json(404, { error: "not found" });
  });
  vi.stubGlobal("fetch", fetchMock);
  // A wallet that starts on Base and switches networks when asked.
  let walletChain = 8453;
  const provider: Eip1193Provider = {
    request: vi.fn(async ({ method, params }: { method: string; params?: any }) => {
      if (method === "eth_requestAccounts") return [ACCOUNT];
      if (method === "eth_chainId") return `0x${walletChain.toString(16)}`;
      if (method === "wallet_switchEthereumChain") walletChain = Number.parseInt(params[0].chainId, 16);
      return null;
    }),
  };
  return { fetchMock, provider, legs };
}

const calls = (fetchMock: ReturnType<typeof vi.fn>, suffix: string) =>
  fetchMock.mock.calls.filter(([u]: any[]) => String(u).endsWith(suffix));

async function connect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Connect wallet" }));
  return screen.findByRole("list", { name: "Your balances" });
}

describe("ArcCheckout", () => {
  it("pays $10 by splitting across two tokens, without ever mentioning the network", async () => {
    const user = userEvent.setup();
    const { fetchMock, provider } = setup();
    const executeLeg = vi.fn(async ({ leg }: any) => (leg.legId === "leg-1" ? TX(1) : TX(2)));
    const onPaid = vi.fn();
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} executeLeg={executeLeg} onPaid={onPaid} pollIntervalMs={5} />);

    expect(await screen.findByText("Acme Pay")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("Pro plan")).toBeInTheDocument();

    const list = await connect(user);
    // Balances in dollars; empty tokens hidden.
    expect(within(list).getByText("$6.00")).toBeInTheDocument();
    expect(within(list).getByText("$5.00")).toBeInTheDocument();
    expect(within(list).queryByText("USDT")).not.toBeInTheDocument();

    const pay = screen.getByRole("button", { name: "Pay $10.00" });
    expect(pay).toBeDisabled();
    await user.click(within(list).getByLabelText(/USDC/));
    expect(screen.getByText("$4.00 left")).toBeInTheDocument();
    await user.click(within(list).getByLabelText(/ETH/));
    expect(screen.getByLabelText("Amount of ETH on Ethereum in dollars")).toHaveValue("4.00");
    expect(pay).toBeEnabled();
    await user.click(pay);

    expect(await screen.findByText("Payment complete")).toBeInTheDocument();
    expect(screen.getByText("$10.00 paid to Acme Pay")).toBeInTheDocument();
    expect(screen.getByText("order_7")).toBeInTheDocument();
    expect(onPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }));

    const legCalls = calls(fetchMock, "/v1/payments/p-1/legs");
    expect(legCalls.map(([, init]: any[]) => JSON.parse(init.body))).toEqual([
      expect.objectContaining({ originChainId: 8453, tokenIn: "USDC", amountIn: "6000000", payer: ACCOUNT }),
      expect.objectContaining({ originChainId: 1, tokenIn: "ETH", payer: ACCOUNT }),
    ]);
    expect(executeLeg).toHaveBeenCalledTimes(2);
    // Already on Base for the USDC leg; switched to Ethereum before the ETH leg was signed.
    const switches = (provider.request as ReturnType<typeof vi.fn>).mock.calls.filter(([r]: any[]) => r.method === "wallet_switchEthereumChain");
    expect(switches.map(([r]: any[]) => r.params[0].chainId)).toEqual(["0x1"]);
    expect(calls(fetchMock, "/legs/leg-1/submitted")).toHaveLength(1);
    // The publishable key authenticates checkout calls.
    expect(new Headers(legCalls[0][1].headers).get("authorization")).toBe(`Bearer ${PK}`);
    // ARC stays behind the scenes by default.
    expect(screen.queryByText(/USDC on ARC/)).not.toBeInTheDocument();
  });

  it("shows settlement details when the merchant opts in", async () => {
    const user = userEvent.setup();
    const { provider } = setup({ amountCents: 500 });
    render(
      <ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} executeLeg={async () => TX(1)} showNetworkDetails pollIntervalMs={5} />
    );
    const list = await connect(user);
    await user.click(within(list).getByLabelText(/USDC/));
    await user.click(screen.getByRole("button", { name: "Pay $5.00" }));
    expect(await screen.findByText("USDC on ARC")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `https://explorer.arc.io/tx/${TX(5)}`);
  });

  it("lets the customer cover the remainder after a short payment", async () => {
    const user = userEvent.setup();
    const { provider } = setup({ settle: (i) => (i === 0 ? "EXECUTED_ON_ARC" : "FAILED") });
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} executeLeg={async ({ leg }) => (leg.legId === "leg-1" ? TX(1) : TX(2))} pollIntervalMs={5} />);
    const list = await connect(user);
    await user.click(within(list).getByLabelText(/USDC/));
    await user.click(within(list).getByLabelText(/ETH/));
    await user.click(screen.getByRole("button", { name: "Pay $10.00" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/We received \$5\.97\. Choose how to pay the remaining \$4\.03/);
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay $4.03" })).toBeDisabled();
  });

  it("shows progress when the link is reopened mid-payment, then the receipt", async () => {
    const { legs, provider } = setup({ settleAfter: 3 });
    legs.push({
      legId: "leg-1",
      quoteId: "q-1",
      originChainId: 8453,
      token: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true },
      amountIn: "4000000000000000",
      valueCents: 1000,
      payer: ACCOUNT,
      status: "PENDING",
      originTx: TX(1),
      destTx: null,
      execution: { fromChain: "Base", toChain: "Arc", tokenIn: "NATIVE", tokenOut: "USDC", amountIn: "x", recipientAddress: PAYOUT, slippageBps: 50 },
    });
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} pollIntervalMs={20} />);

    expect(await screen.findByText("Payment processing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
    expect(await screen.findByText("Payment complete")).toBeInTheDocument();
  });

  it("handles a cancelled wallet prompt without charging", async () => {
    const user = userEvent.setup();
    const { fetchMock, provider } = setup();
    const executeLeg = vi.fn(async () => {
      throw Object.assign(new Error("User rejected the request."), { code: 4001 });
    });
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} executeLeg={executeLeg} pollIntervalMs={5} />);
    const list = await connect(user);
    await user.click(within(list).getByLabelText(/USDC/));
    await user.click(within(list).getByLabelText(/ETH/));
    await user.click(screen.getByRole("button", { name: "Pay $10.00" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("didn't go through");
    expect(alert).toHaveTextContent("Cancelled in your wallet");
    expect(alert).toHaveTextContent("Nothing was charged");
    expect(executeLeg).toHaveBeenCalledTimes(1);
    expect(calls(fetchMock, "/submitted")).toHaveLength(0);
  });

  it("explains when there's no browser wallet", async () => {
    const user = userEvent.setup();
    setup();
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" />);
    await user.click(await screen.findByRole("button", { name: "Connect wallet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No browser wallet found");
  });

  it("says when the payment expired", async () => {
    setup({ status: "expired" });
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This payment expired");
  });

  it("runs a full simulated checkout in demo mode with no network calls", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ArcCheckout publishableKey={PK} demo={{ amountCents: 1000, merchantName: "Demo Store", description: "Preview" }} />);
    const list = await connect(user);
    for (const box of within(list).getAllByRole("checkbox").slice(0, 2)) await user.click(box);
    await user.click(screen.getByRole("button", { name: "Pay $10.00" }));
    expect(await screen.findByText("Payment complete", undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  }, 10000);
});

describe("branding", () => {
  const LOGO = "data:image/png;base64,iVBORw0KGgo=";

  it("uses the business's saved branding from the payment: logo, name, colors and every text", async () => {
    const user = userEvent.setup();
    const { provider } = setup({ amountCents: 500 });
    const realFetch = (globalThis.fetch as any).getMockImplementation();
    (globalThis.fetch as any).mockImplementation(async (input: any, init: any) => {
      const res: Response = await realFetch(input, init);
      if (!String(input).endsWith("/v1/payments/p-1")) return res;
      const body = await res.json();
      return new Response(
        JSON.stringify({
          ...body,
          merchantName: "Acme Store",
          branding: {
            logo: LOGO,
            accentColor: "#e11d48",
            theme: "dark",
            radius: 6,
            texts: { title: "Checkout for", connectButton: "Link my wallet", payButton: "Buy now for {amount}", successTitle: "Thanks!", successMessage: "{merchant} got {amount}", footer: "" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    render(<ArcCheckout publishableKey={PK} baseUrl="http://gw.test" paymentId="p-1" provider={provider} executeLeg={async () => TX(1)} pollIntervalMs={5} />);

    expect(await screen.findByText("Acme Store")).toBeInTheDocument();
    expect(screen.getByText("Checkout for")).toBeInTheDocument();
    const root = screen.getByTestId("arc-checkout");
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(root.style.getPropertyValue("--arcw-accent")).toBe("#e11d48");
    expect(root.querySelector("img.arcc-logo")).toHaveAttribute("src", LOGO);
    expect(screen.queryByText(/Secured by/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Link my wallet" }));
    const list = await screen.findByRole("list", { name: "Your balances" });
    await user.click(within(list).getByLabelText(/USDC/));
    await user.click(screen.getByRole("button", { name: "Buy now for $5.00" }));
    expect(await screen.findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByText("Acme Store got $5.00")).toBeInTheDocument();
  });

  it("lets props override saved branding and refuses unsafe logo URLs", async () => {
    setup();
    render(
      <ArcCheckout
        publishableKey={PK}
        demo={{ amountCents: 1000, merchantName: "Demo Store" }}
        accentColor="#059669"
        branding={{ logo: "javascript:alert(1)", displayName: "Renamed", texts: { connectButton: "" } }}
      />
    );
    expect(await screen.findByText("Renamed")).toBeInTheDocument();
    expect(screen.getByTestId("arc-checkout").querySelector("img")).toBeNull();
    // Empty text falls back to the default.
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.getByTestId("arc-checkout").style.getPropertyValue("--arcw-accent")).toBe("#059669");
  });

  it("pins the demo to any screen for previews", async () => {
    const demo = { amountCents: 1000, merchantName: "Demo Store" };
    const { rerender } = render(<ArcCheckout publishableKey={PK} demo={demo} previewState="select" />);
    expect(await screen.findByRole("button", { name: "Pay $10.00" })).toBeEnabled();
    rerender(<ArcCheckout publishableKey={PK} demo={demo} previewState="paying" />);
    expect(await screen.findByText("Confirm in your wallet")).toBeInTheDocument();
    rerender(<ArcCheckout publishableKey={PK} demo={demo} previewState="partial" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We received $6.00");
    rerender(<ArcCheckout publishableKey={PK} demo={demo} previewState="done" showNetworkDetails />);
    expect(await screen.findByText("Payment complete")).toBeInTheDocument();
    expect(screen.getByText("USDC on ARC")).toBeInTheDocument();
    rerender(<ArcCheckout publishableKey={PK} demo={demo} previewState="expired" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");
    rerender(<ArcCheckout publishableKey={PK} demo={demo} previewState="invalid" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't valid");
  });
});

describe("<stableflowr-checkout>", () => {
  it("renders into a shadow root from attributes", async () => {
    setup();
    defineArcCheckout();
    const el = document.createElement("stableflowr-checkout");
    el.setAttribute("publishable-key", PK);
    el.setAttribute("base-url", "http://gw.test");
    el.setAttribute("payment-id", "p-1");
    el.setAttribute("theme", "dark");
    document.body.appendChild(el);
    await waitFor(() => expect(el.shadowRoot?.textContent).toContain("Acme Pay"));
    expect((el.shadowRoot!.querySelector(".arcw") as HTMLElement).dataset.theme).toBe("dark");
    el.remove();
  });
});
