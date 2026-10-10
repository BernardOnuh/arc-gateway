import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { chains, gatewayAccounts, gatewaySession, mockGateway, profile, renderApp, tokens } from "../../test/render";

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
    expect(screen.getByText(/import \{ Stableflowr \} from "stableflowr-sdk"/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Interactive API reference/ })).toHaveAttribute("href", "http://localhost:3000/docs");
    expect(screen.getByRole("link", { name: /Documentation/ })).toHaveAttribute("href", "/docs");
  });

  it("serves the documentation at /docs with its contents", async () => {
    renderApp("/docs");
    expect(await screen.findByRole("heading", { level: 1, name: "Accept any token. Get USDC on ARC." })).toBeInTheDocument();
    for (const section of ["How a payment works", "Webhooks", "Payment lifecycle", "REST API"]) {
      expect(screen.getByRole("heading", { level: 2, name: section })).toBeInTheDocument();
    }
  });
});

const signupCall = (fetchMock: ReturnType<typeof mockGateway>) =>
  fetchMock.mock.calls.find(([u, init]) => String(u).endsWith("/v1/partners") && init?.method === "POST")!;

describe("signup", () => {
  const EMAIL = "billing@acme.example";
  const PASSWORD = "correct horse battery";

  function gateway(signup: (body: Record<string, unknown>) => { status: number; body: unknown }) {
    return mockGateway((url, init) => {
      if (url.pathname === "/v1/partners" && init.method === "POST") {
        const body = JSON.parse(String(init.body));
        const res = signup(body);
        if (res.status === 201) gatewayAccounts.set(body.email, { password: body.password, apiKey: NEW_KEY });
        return res;
      }
      if (url.pathname === "/v1/partners/me") {
        const auth = new Headers(init.headers).get("authorization");
        return auth === `Bearer ${NEW_KEY}`
          ? { status: 200, body: profile }
          : { status: 401, body: { error: "unauthorized" } };
      }
      return { status: 404, body: { error: "not found" } };
    });
  }

  const created = () => ({
    status: 201,
    body: { partnerId: "p-1", apiKey: NEW_KEY, keyPrefix: "gw_live_", feeBps: 10, rateLimitPerMin: 30 },
  });

  async function fillForm(user: ReturnType<typeof userEvent.setup>, { confirm = PASSWORD } = {}) {
    await user.type(screen.getByLabelText("Business name"), "  Acme Pay ");
    await user.type(screen.getByLabelText(/Work email/), EMAIL);
    await user.type(screen.getByLabelText("Password"), PASSWORD);
    await user.type(screen.getByLabelText("Confirm password"), confirm);
  }

  it("creates the account with email + password, signs in, and shows the key once in the dashboard", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway(created);
    renderApp("/signup");
    expect(screen.queryByTestId("api-key")).not.toBeInTheDocument();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const dialog = await screen.findByRole("dialog", { name: "Your secret key" });
    expect(within(dialog).getByTestId("api-key")).toHaveTextContent(NEW_KEY);
    expect(within(dialog).getByRole("note")).toHaveTextContent("only time it's shown");
    expect(JSON.parse(String(signupCall(fetchMock)[1]!.body))).toEqual({
      partnerName: "Acme Pay",
      email: EMAIL,
      password: PASSWORD,
    });
    expect(gatewaySession.key).toBe(NEW_KEY);
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();

    const proceed = within(dialog).getByRole("button", { name: "Continue to dashboard" });
    expect(proceed).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Copy key" }));
    expect(await navigator.clipboard.readText()).toBe(NEW_KEY);
    expect(proceed).toBeEnabled();
    await user.click(proceed);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(NEW_KEY)).not.toBeInTheDocument();
  });

  it("requires an email, a long enough password, and a matching confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = gateway(created);
    renderApp("/signup");
    await user.type(screen.getByLabelText("Business name"), "Acme Pay");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your work email");

    await user.type(screen.getByLabelText(/Work email/), EMAIL);
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 10 characters");

    await user.type(screen.getByLabelText("Password"), " but now long");
    await user.type(screen.getByLabelText("Confirm password"), "something else");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");
    expect(signupCall(fetchMock)).toBeUndefined();
  });

  it("shows and hides the password", async () => {
    const user = userEvent.setup();
    renderApp("/signup");
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(input).toHaveAttribute("type", "text");
  });

  it("explains a duplicate email (409)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 409, body: { error: "email already registered" } }));
    renderApp("/signup");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.queryByTestId("api-key")).not.toBeInTheDocument();
  });

  it("shows the gateway's reason for invalid input (400)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 400, body: { error: "email must match format \"email\"" } }));
    renderApp("/signup");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent('must match format "email"');
  });

  it("asks for too many signups to slow down (429)", async () => {
    const user = userEvent.setup();
    gateway(() => ({ status: 429, body: { error: "rate_limited" } }));
    renderApp("/signup");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });
});
