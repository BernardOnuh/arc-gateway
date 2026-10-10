import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArcSwapWidget, accentForeground, normalizeAccent } from "../src/index.js";
import { defineArcSwapWidget } from "../src/element.js";
import { formatUnits, parseUnits } from "../src/units.js";

const PK = "pk_live_test";
const RECIPIENT = "0x1111111111111111111111111111111111111111";
const chains = [
  { id: 8453, name: "Base", isArc: false, testnet: false, explorerUrl: "https://basescan.org" },
  { id: 5042, name: "Arc", isArc: true, testnet: false, explorerUrl: "https://explorer.arc.io" },
  { id: 5042002, name: "Arc Testnet", isArc: true, testnet: true, explorerUrl: "https://explorer.testnet.arc.io" },
];
const tokens = [
  { chainId: 8453, symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { chainId: 8453, symbol: "USDC", name: "USD Coin", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
  { chainId: 5042, symbol: "EURC", name: "Euro Coin", address: "0x89b50855aa3be2f677cd6303cec089b5f319d72a", decimals: 6 },
  { chainId: 5042, symbol: "USDC", name: "USD Coin", address: "0x3600000000000000000000000000000000000000", decimals: 18 },
];
const quote = {
  quoteId: "q-1",
  amountIn: "1500000000000000000",
  feeAmount: "1500000000000000",
  feeBps: 10,
  netAmount: "1498500000000000000",
  estimatedOut: "3746250000000000000000",
  minOut: "3727518750000000000000",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  unsignedTx: null,
};
const TX = `0x${"cd".repeat(32)}`;

function gateway(statuses: string[] = ["PENDING", "EXECUTED_ON_ARC"], quoteStatus = 200, quoteBody: unknown = quote) {
  let poll = 0;
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.pathname === "/v1/chains") return json(200, chains);
    if (url.pathname === "/v1/tokens") return json(200, tokens);
    if (url.pathname === "/v1/quotes") return json(quoteStatus, quoteBody);
    if (url.pathname === "/v1/intents/i-1") {
      const status = statuses[Math.min(poll++, statuses.length - 1)];
      return json(200, {
        id: "i-1",
        status,
        originTx: TX,
        destTx: status === "EXECUTED_ON_ARC" ? TX : null,
        upstreamId: "u",
        error: status === "FAILED" ? "solver rejected" : null,
        createdAt: "t",
        updatedAt: "t",
      });
    }
    void init;
    return json(404, { error: "not found" });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function fillAndQuote(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText("From network");
  await user.type(screen.getByLabelText(/Amount/), "1.5");
  await user.click(screen.getByRole("button", { name: "Get quote" }));
}

describe("units", () => {
  it("parses and formats exactly", () => {
    expect(parseUnits("1.5", 18)).toBe("1500000000000000000");
    expect(parseUnits(".25", 6)).toBe("250000");
    expect(parseUnits("1.1234567", 6)).toBeNull();
    expect(parseUnits("abc", 6)).toBeNull();
    expect(parseUnits("", 6)).toBeNull();
    expect(formatUnits("3746250000000000000000", 18)).toBe("3,746.25");
    expect(formatUnits("1", 18)).toBe("<0.000001");
  });
});

describe("ArcSwapWidget", () => {
  it("quotes with the publishable key, shows the fee, submits via the host, and tracks to completion", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway();
    const onQuote = vi.fn();
    const onStatus = vi.fn();
    const onIntent = vi.fn();
    const submitIntent = vi.fn(async () => ({ intentId: "i-1" }));
    render(
      <ArcSwapWidget
        publishableKey={PK}
        baseUrl="http://gw.test/"
        recipient={RECIPIENT}
        customerId="c-1"
        submitIntent={submitIntent}
        onQuote={onQuote}
        onStatus={onStatus}
        onIntent={onIntent}
        pollIntervalMs={5}
      />
    );

    // Defaults: first source chain, mainnet ARC, USDC out; recipient locked.
    expect(await screen.findByLabelText("From network")).toHaveValue("8453");
    expect(screen.getByLabelText("To network")).toHaveValue("5042");
    expect(screen.getByLabelText("Receive")).toHaveValue("USDC");
    expect(screen.getByLabelText("Receiving address")).toHaveAttribute("readonly");

    await fillAndQuote(user);
    expect(await screen.findByText("0.0015 WETH")).toBeInTheDocument();
    expect(screen.getByText("Fee (0.10%)")).toBeInTheDocument();
    expect(screen.getByText("3,746.25 USDC on Arc")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/quotes"))!;
    expect(new Headers(init!.headers).get("authorization")).toBe(`Bearer ${PK}`);
    expect(JSON.parse(String(init!.body))).toMatchObject({
      originChainId: 8453,
      destChainId: 5042,
      tokenIn: "WETH",
      tokenOut: "USDC",
      amountIn: "1500000000000000000",
      recipient: RECIPIENT,
      slippageBps: 50,
      customerId: "c-1",
    });
    expect(onQuote).toHaveBeenCalledWith(expect.objectContaining({ quoteId: "q-1", tokenIn: expect.objectContaining({ decimals: 18 }) }));

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(submitIntent).toHaveBeenCalledWith(expect.objectContaining({ quoteId: "q-1" }));
    expect(await screen.findByRole("button", { name: "Send another" })).toBeInTheDocument();
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ status: "EXECUTED_ON_ARC" }));
    expect(onStatus.mock.calls.map(([i]) => i.status)).toEqual(["PENDING", "EXECUTED_ON_ARC"]);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", `https://basescan.org/tx/${TX}`);
    expect(links[1]).toHaveAttribute("href", `https://explorer.arc.io/tx/${TX}`);

    // Status polls use the publishable key too.
    const poll = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/intents/i-1"))!;
    expect(new Headers(poll[1]!.headers).get("authorization")).toBe(`Bearer ${PK}`);
    // Chains/tokens are public; no key sent.
    const chainsCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/chains"))!;
    expect(new Headers(chainsCall[1]!.headers).get("authorization")).toBeNull();
  });

  it("shows failures with the reason", async () => {
    const user = userEvent.setup();
    gateway(["FAILED"]);
    const onIntent = vi.fn();
    render(
      <ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" recipient={RECIPIENT} pollIntervalMs={5} onIntent={onIntent} submitIntent={async () => ({ intentId: "i-1" })} />
    );
    await fillAndQuote(user);
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Failed: solver rejected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
  });

  it("validates input before quoting", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway();
    render(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" />);
    await screen.findByLabelText("From network");
    await user.click(screen.getByRole("button", { name: "Get quote" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount");
    await user.type(screen.getByLabelText(/Amount/), "1");
    await user.type(screen.getByLabelText("Receiving address"), "0x12");
    await user.click(screen.getByRole("button", { name: "Get quote" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid receiving address");
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/v1/quotes"))).toBe(false);
  });

  it("runs quote-only in preview mode without submitIntent", async () => {
    const user = userEvent.setup();
    gateway();
    render(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" recipient={RECIPIENT} />);
    await fillAndQuote(user);
    expect(await screen.findByRole("note")).toHaveTextContent("Preview mode");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("explains a disallowed origin", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    gateway(undefined, 403, { error: "origin not allowed for this publishable key" });
    render(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" recipient={RECIPIENT} onError={onError} />);
    await fillAndQuote(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't enabled for this website");
    expect(onError).toHaveBeenCalled();
  });

  it("reports an unreachable gateway", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    render(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the payment service");
  });
});

describe("appearance", () => {
  it("applies theme, accent and radius, and refuses anything that isn't a hex color", async () => {
    gateway();
    const { rerender } = render(
      <ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" theme="dark" accentColor="#4F46E5" radius={8} title="Top up" />
    );
    const root = screen.getByTestId("arc-swap-widget");
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(root.style.getPropertyValue("--arcw-accent")).toBe("#4f46e5");
    expect(root.style.getPropertyValue("--arcw-accent-fg")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--arcw-r")).toBe("8px");
    expect(screen.getByRole("heading", { name: "Top up" })).toBeInTheDocument();

    rerender(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" accentColor="red;background:url(x)" radius={99} />);
    expect(root.style.getPropertyValue("--arcw-accent")).toBe("#1c1f3f");
    expect(root.style.getPropertyValue("--arcw-r")).toBe("32px");
    expect(root).toHaveAttribute("data-theme", "light");
  });

  it("picks readable button text for light and dark accents", () => {
    expect(normalizeAccent("#fc0")).toBe("#ffcc00");
    expect(accentForeground("#ffcc00")).toBe("#12142b");
    expect(accentForeground("#1c1f3f")).toBe("#ffffff");
  });

  it("offers a refresh once the quote expires", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway(undefined, 200, { ...quote, expiresAt: Math.floor(Date.now() / 1000) - 1 });
    render(<ArcSwapWidget publishableKey={PK} baseUrl="http://gw.test" recipient={RECIPIENT} submitIntent={async () => ({ intentId: "i-1" })} />);
    await fillAndQuote(user);
    expect(await screen.findByText("Quote expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refresh quote/ }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/v1/quotes"))).toHaveLength(2));
  });
});

describe("<arc-swap-widget>", () => {
  it("renders into a shadow root and emits DOM events", async () => {
    gateway();
    defineArcSwapWidget();
    defineArcSwapWidget(); // idempotent
    const el = document.createElement("arc-swap-widget") as HTMLElement & { submitIntent?: unknown };
    el.setAttribute("publishable-key", PK);
    el.setAttribute("base-url", "http://gw.test");
    el.setAttribute("dest-chain-id", "5042002");
    el.setAttribute("theme", "auto");
    el.setAttribute("accent-color", "#0ea5e9");
    document.body.appendChild(el);
    await waitFor(() => expect(el.shadowRoot?.querySelector("#arcw-dest")).not.toBeNull());
    expect((el.shadowRoot!.querySelector("#arcw-dest") as HTMLSelectElement).value).toBe("5042002");
    const root = el.shadowRoot!.querySelector(".arcw") as HTMLElement;
    expect(root.dataset.theme).toBe("auto");
    expect(root.style.getPropertyValue("--arcw-accent")).toBe("#0ea5e9");
    el.remove();
  });
});
