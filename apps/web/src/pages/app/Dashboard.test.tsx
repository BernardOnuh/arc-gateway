import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Ledger } from "@arc/gateway-sdk";
import { API_KEY_STORAGE } from "../../lib/auth";
import { chains, mockGateway, profile, renderApp, tokens } from "../../test/render";
import { ledgerToCsv } from "./Ledger";

const KEY = "gw_live_dash";
const CUSTOMER_ID = "0b6f3d1e-1111-4111-8111-111111111111";
const TX = `0x${"ab".repeat(32)}`;

const ledger: Ledger = {
  partnerId: "p-1",
  customerId: null,
  totals: { feeBps: 10, transactions: 3, amountInTotal: "1000000000005000000", feeTotal: "1000000000005000" },
  byToken: [
    { chainId: 8453, symbol: "WETH", address: tokens[0].address, decimals: 18, transactions: 2, amountInTotal: "1000000000000000000", feeTotal: "1000000000000000" },
    { chainId: 8453, symbol: "USDC", address: tokens[1].address, decimals: 6, transactions: 1, amountInTotal: "5000000", feeTotal: "5000" },
  ],
  byCustomer: [
    {
      customerId: CUSTOMER_ID,
      externalId: "=user_42",
      recipientAddress: "0x1111111111111111111111111111111111111111",
      transactions: 2,
      amountInTotal: "1000000000000000000",
      feeTotal: "1000000000000000",
      byToken: [
        { chainId: 8453, symbol: "WETH", address: tokens[0].address, decimals: 18, transactions: 2, amountInTotal: "1000000000000000000", feeTotal: "1000000000000000" },
      ],
    },
    {
      customerId: null,
      externalId: null,
      recipientAddress: null,
      transactions: 1,
      amountInTotal: "5000000",
      feeTotal: "5000",
      byToken: [
        { chainId: 8453, symbol: "USDC", address: tokens[1].address, decimals: 6, transactions: 1, amountInTotal: "5000000", feeTotal: "5000" },
      ],
    },
  ],
};

const customer = {
  customerId: CUSTOMER_ID,
  externalId: "=user_42",
  recipientAddress: "0x1111111111111111111111111111111111111111",
  createdAt: "2026-10-08T10:00:00.000Z",
};

const quote = {
  quoteId: "q-1",
  customerId: CUSTOMER_ID,
  originChainId: 8453,
  destChainId: 5042,
  tokenIn: "WETH",
  tokenOut: "USDC",
  recipient: customer.recipientAddress,
  amountIn: "500000000000000000",
  feeAmount: "500000000000000",
  feeBps: 10,
  netAmount: "499500000000000000",
  estimatedOut: "1250000000000000000000",
  minOut: "1240000000000000000000",
  expiresAt: 1893456000,
  createdAt: "2026-10-08T11:00:00.000Z",
  intent: { intentId: "i-1", status: "EXECUTED_ON_ARC" },
};

const intent = {
  id: "i-1",
  quoteId: "q-1",
  customerId: CUSTOMER_ID,
  originChainId: 8453,
  destChainId: 5042,
  amountIn: quote.amountIn,
  feeAmount: quote.feeAmount,
  status: "FAILED",
  originTx: TX,
  destTx: null,
  error: "solver rejected",
  createdAt: "2026-10-08T11:01:00.000Z",
  updatedAt: "2026-10-08T11:02:00.000Z",
};

function page<T>(items: T[], url: URL) {
  return {
    items,
    total: items.length,
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  };
}

const secretKeyRow = {
  id: "k-1",
  kind: "secret",
  keyPrefix: "gw_live_",
  last4: "dash",
  publishableKey: null,
  allowedOrigins: null,
  active: true,
  current: true,
  createdAt: "2026-10-08T00:00:00.000Z",
  revokedAt: null,
};

function signedIn(overrides: Record<string, (url: URL, init: RequestInit) => { status: number; body: unknown }> = {}) {
  window.localStorage.setItem(API_KEY_STORAGE, KEY);
  const customers = [customer];
  const keys: Record<string, unknown>[] = [secretKeyRow];
  return mockGateway((url, init) => {
    const route = `${init.method ?? "GET"} ${url.pathname}`;
    if (overrides[route]) return overrides[route](url, init);
    switch (route) {
      case "GET /v1/partners/me":
        return { status: 200, body: profile };
      case "GET /v1/chains":
        return { status: 200, body: chains };
      case "GET /v1/tokens":
        return { status: 200, body: tokens };
      case "GET /v1/ledger":
        return { status: 200, body: ledger };
      case "GET /v1/customers":
        return { status: 200, body: page(customers, url) };
      case "POST /v1/customers": {
        const body = JSON.parse(String(init.body));
        const created = { customerId: "c-new", createdAt: "2026-10-08T12:00:00.000Z", ...body };
        customers.unshift(created);
        return { status: 201, body: created };
      }
      case "GET /v1/quotes":
        return { status: 200, body: page([quote], url) };
      case "GET /v1/intents":
        return { status: 200, body: page([intent], url) };
      case "GET /v1/partners/me/api-keys":
        return { status: 200, body: { items: keys } };
      case "POST /v1/partners/me/api-keys/publishable": {
        const { allowedOrigins } = JSON.parse(String(init.body));
        const row = {
          ...secretKeyRow,
          id: `pk-${keys.length}`,
          kind: "publishable",
          keyPrefix: "pk_live_",
          last4: "pub1",
          publishableKey: "pk_live_abcpub1",
          allowedOrigins,
          current: false,
        };
        keys.unshift(row);
        return { status: 201, body: row };
      }
      case "POST /v1/partners/me/api-keys/revoke": {
        const { keyId } = JSON.parse(String(init.body));
        const row = keys.find((k) => k.id === keyId)!;
        Object.assign(row, { active: false, revokedAt: "2026-10-08T13:00:00.000Z" });
        return { status: 200, body: row };
      }
      default:
        return { status: 404, body: { error: "not found" } };
    }
  });
}

describe("overview", () => {
  it("shows totals, per-token fees and recent transactions", async () => {
    signedIn();
    renderApp("/app");
    expect(await screen.findByText("0.001 WETH · 0.005 USDC")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(await screen.findByText("0.5 WETH")).toBeInTheDocument();
    expect(screen.getByText("EXECUTED_ON_ARC")).toBeInTheDocument();
  });
});

describe("customers", () => {
  it("lists customers with their revenue and links to their transactions", async () => {
    signedIn();
    renderApp("/app/customers");
    const link = await screen.findByRole("link", { name: "=user_42" });
    expect(link).toHaveAttribute("href", `/app/transactions?customerId=${CUSTOMER_ID}`);
    const row = link.closest("tr")!;
    expect(await within(row).findByText("0.001 WETH")).toBeInTheDocument();
  });

  it("validates and creates a customer, then refreshes the list", async () => {
    const user = userEvent.setup();
    const fetchMock = signedIn();
    renderApp("/app/customers");
    await screen.findByRole("link", { name: "=user_42" });

    await user.type(screen.getByLabelText("External ID"), "user_99");
    await user.type(screen.getByLabelText("Receiving address"), "0x123");
    await user.click(screen.getByRole("button", { name: "Add customer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid 0x address");

    await user.clear(screen.getByLabelText("Receiving address"));
    await user.type(screen.getByLabelText("Receiving address"), "0x2222222222222222222222222222222222222222");
    await user.click(screen.getByRole("button", { name: "Add customer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved user_99");
    expect(await screen.findByRole("link", { name: "user_99" })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      externalId: "user_99",
      recipientAddress: "0x2222222222222222222222222222222222222222",
    });
  });
});

describe("transactions", () => {
  it("shows quotes with amounts, fee and status, filtered by customer from the URL", async () => {
    const fetchMock = signedIn();
    renderApp(`/app/transactions?customerId=${CUSTOMER_ID}`);
    expect(await screen.findByText("0.5 WETH")).toBeInTheDocument();
    expect(screen.getByText("0.0005 WETH")).toBeInTheDocument();
    expect(screen.getByText("1,250 USDC")).toBeInTheDocument();
    const call = fetchMock.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === "/v1/quotes")!;
    expect(call.searchParams.get("customerId")).toBe(CUSTOMER_ID);
  });

  it("switches to intents, filters by status and links explorers", async () => {
    const user = userEvent.setup();
    const fetchMock = signedIn();
    renderApp("/app/transactions");
    await user.click(await screen.findByRole("tab", { name: "Intents" }));
    expect(await screen.findByText("solver rejected")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /^0xabab/ })).toHaveAttribute("href", `https://basescan.org/tx/${TX}`);

    await user.selectOptions(screen.getByLabelText("Status"), "FAILED");
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => new URL(String(u)));
      expect(urls.some((u) => u.pathname === "/v1/intents" && u.searchParams.get("status") === "FAILED")).toBe(true);
    });
  });
});

describe("ledger", () => {
  it("shows per-token and per-customer revenue", async () => {
    signedIn();
    renderApp("/app/ledger");
    expect(await screen.findByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByText("Unattributed")).toBeInTheDocument();
    expect(screen.getAllByText("0.005").length).toBeGreaterThan(0);
  });

  it("exports one CSV row per customer and token, guarding against formula injection", () => {
    const csv = ledgerToCsv(ledger).trim().split("\r\n");
    expect(csv[0]).toBe(
      '"customer_id","external_id","recipient_address","chain_id","token","token_address","transactions","volume","fees","volume_base_units","fees_base_units"'
    );
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain(`"'=user_42"`);
    expect(csv[1]).toContain('"1","0.001","1000000000000000000","1000000000000000"');
    expect(csv[2]).toContain('"","","","8453","USDC"');
  });
});

describe("settings", () => {
  it("shows the plan and a masked key", async () => {
    signedIn();
    renderApp("/app/settings");
    expect(await screen.findByText("0.10% (10 bps)")).toBeInTheDocument();
    expect(await screen.findByText("gw_live_••••dash")).toBeInTheDocument();
    expect(screen.queryByText(KEY)).not.toBeInTheDocument();
  });

  it("rotates the secret key after confirmation and switches the session to the new key", async () => {
    const user = userEvent.setup();
    const NEW = "gw_live_rotated_new";
    const fetchMock = signedIn({
      "POST /v1/partners/me/api-keys/rotate": () => ({
        status: 201,
        body: { apiKey: NEW, key: { ...secretKeyRow, id: "k-2", last4: "_new" } },
      }),
    });
    renderApp("/app/settings");
    await user.click(await screen.findByRole("button", { name: "Rotate secret key" }));
    expect(screen.getByText(/stops working immediately/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rotate now" }));

    expect(await screen.findByTestId("new-api-key")).toHaveTextContent(NEW);
    expect(window.localStorage.getItem(API_KEY_STORAGE)).toBe(NEW);
    // Later requests use the new key.
    await waitFor(() => {
      const last = fetchMock.mock.calls.at(-1)!;
      expect(new Headers(last[1]!.headers).get("authorization")).toBe(`Bearer ${NEW}`);
    });
    await user.click(screen.getByRole("button", { name: "I've stored it" }));
    expect(screen.queryByTestId("new-api-key")).not.toBeInTheDocument();
  });

  it("creates and revokes a publishable key", async () => {
    const user = userEvent.setup();
    const fetchMock = signedIn();
    renderApp("/app/settings");
    await user.type(await screen.findByLabelText("Allowed websites"), "https://shop.example.com/\nhttp://localhost:3000");
    await user.click(screen.getByRole("button", { name: "Create publishable key" }));
    expect(await screen.findByText("pk_live_abcpub1")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/api-keys/publishable"))!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      allowedOrigins: ["https://shop.example.com", "http://localhost:3000"],
    });

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Confirm revoke" }));
    await waitFor(() => expect(screen.queryByText("pk_live_abcpub1")).not.toBeInTheDocument());
    expect(screen.getByText("Revoked (1)")).toBeInTheDocument();
  });
});

describe("widget page", () => {
  it("asks for a publishable key first", async () => {
    signedIn();
    renderApp("/app/widget");
    expect(await screen.findByRole("link", { name: "Create one in Settings" })).toHaveAttribute("href", "/app/settings");
  });

  it("shows embed code and a live preview when the key allows this origin", async () => {
    const pkRow = {
      ...secretKeyRow,
      id: "pk-1",
      kind: "publishable",
      keyPrefix: "pk_live_",
      last4: "wdgt",
      publishableKey: "pk_live_widgetwdgt",
      allowedOrigins: [window.location.origin],
      current: false,
    };
    signedIn({ "GET /v1/partners/me/api-keys": () => ({ status: 200, body: { items: [secretKeyRow, pkRow] } }) });
    renderApp("/app/widget");
    expect((await screen.findAllByText(/publishableKey="pk_live_widgetwdgt"/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/publishable-key="pk_live_widgetwdgt"/)).toBeInTheDocument();
    expect(await screen.findByTestId("arc-swap-widget")).toBeInTheDocument();
    expect(await screen.findByLabelText("From network")).toBeInTheDocument();
  });
});
