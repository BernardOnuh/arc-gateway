import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { chains, gatewaySession, mockGateway, profile, renderApp, tokens } from "../../test/render";

const NEW_KEY = "gw_live_brand_new_key";

function catalog(url: URL) {
  if (url.pathname === "/v1/chains") return { status: 200, body: chains };
  if (url.pathname === "/v1/tokens") return { status: 200, body: tokens };
  return null;
}

describe("marketing pages", () => {
  it("shows live supported networks on the home page", async () => {
    mockGateway((url) => catalog(url) ?? { status: 404, body: { error: "not found" } });
    renderApp("/");
    const list = await screen.findByRole("list", { name: "Supported networks" });
    const base = within(list).getByText("Base").closest("li")!;
    expect(within(base).getByText("WETH")).toBeInTheDocument();
    expect(within(base).getByText("USDC")).toBeInTheDocument();
    expect(within(base).getByText("Source")).toBeInTheDocument();
    const arc = within(list).getByText("Arc").closest("li")!;
    expect(within(arc).getByText("Destination")).toBeInTheDocument();
  });

  it("degrades gracefully when the gateway is down", async () => {
    renderApp("/");
    expect(await screen.findByText(/Couldn't load the live network list/)).toBeInTheDocument();
  });

  it("shows the default fee and rate limit on pricing", () => {
    renderApp("/pricing");
    expect(screen.getByText("0.10%")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("−1.00 USDC")).toBeInTheDocument();
  });

  it("shows a real SDK snippet on developers", () => {
    renderApp("/developers");
    expect(screen.getByText(/import \{ GatewayClient \} from "@arc\/gateway-sdk"/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "interactive API docs" })).toHaveAttribute("href", "http://localhost:3000/docs");
  });
});

const signupCall = (fetchMock: ReturnType<typeof mockGateway>) =>
  fetchMock.mock.calls.find(([u, init]) => String(u).endsWith("/v1/partners") && init?.method === "POST")!;

describe("signup", () => {
  function gateway(signup: (body: Record<string, unknown>) => { status: number; body: unknown }) {
    return mockGateway((url, init) => {
      if (url.pathname === "/v1/partners" && init.method === "POST") return signup(JSON.parse(String(init.body)));
      if (url.pathname === "/v1/partners/me") {
        const auth = new Headers(init.headers).get("authorization");
        return auth === `Bearer ${NEW_KEY}`
          ? { status: 200, body: profile }
          : { status: 401, body: { error: "unauthorized" } };
      }
      return { status: 404, body: { error: "not found" } };
    });
  }

  it("creates a partner, reveals the key once, and signs straight into the dashboard", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway(() => ({
      status: 201,
      body: { partnerId: "p-1", apiKey: NEW_KEY, keyPrefix: "gw_live_", feeBps: 10, rateLimitPerMin: 30 },
    }));
    renderApp("/signup");

    await user.type(screen.getByLabelText("Business name"), "  Acme Pay ");
    await user.type(screen.getByLabelText(/Contact email/), "billing@acme.example");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByTestId("api-key")).toHaveTextContent(NEW_KEY);
    expect(screen.getByRole("note")).toHaveTextContent("shown only once");
    expect(JSON.parse(String(signupCall(fetchMock)[1]!.body))).toEqual({
      partnerName: "Acme Pay",
      email: "billing@acme.example",
    });

    const proceed = screen.getByRole("button", { name: "Continue to dashboard" });
    expect(proceed).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Copy key" }));
    expect(await navigator.clipboard.readText()).toBe(NEW_KEY);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(proceed).toBeEnabled();

    await user.click(proceed);
    expect(await screen.findByText(/Signed in as/)).toBeInTheDocument();
    expect(gatewaySession.key).toBe(NEW_KEY);
  });

  it("omits an empty email", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway(() => ({
      status: 201,
      body: { partnerId: "p-1", apiKey: NEW_KEY, keyPrefix: "gw_live_", feeBps: 10, rateLimitPerMin: 30 },
    }));
    renderApp("/signup");
    await user.type(screen.getByLabelText("Business name"), "Acme Pay");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByTestId("api-key");
    expect(JSON.parse(String(signupCall(fetchMock)[1]!.body))).toEqual({ partnerName: "Acme Pay" });
  });

  it("explains a duplicate email (409)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 409, body: { error: "email already registered" } }));
    renderApp("/signup");
    await user.type(screen.getByLabelText("Business name"), "Acme Pay");
    await user.type(screen.getByLabelText(/Contact email/), "billing@acme.example");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.queryByTestId("api-key")).not.toBeInTheDocument();
  });

  it("shows the gateway's reason for invalid input (400)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 400, body: { error: "body/email must match format \"email\"" } }));
    renderApp("/signup");
    await user.type(screen.getByLabelText("Business name"), "Acme Pay");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent('must match format "email"');
  });

  it("asks for too many signups to slow down (429)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 429, body: { error: "rate_limited" } }));
    renderApp("/signup");
    await user.type(screen.getByLabelText("Business name"), "Acme Pay");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });
});
