import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CUSTOMER_PARTNER_STORAGE, CUSTOMER_SESSION_STORAGE } from "../../lib/customerAuth";
import { chains, mockGateway, renderApp } from "../../test/render";

const SESSION = "cs_session";
const account = {
  customerId: "c-1",
  partnerId: "p-1",
  partnerName: "Acme Pay",
  externalId: "user_42",
  email: "ada@example.com",
  recipientAddress: "0x1111111111111111111111111111111111111111",
  payoutWallet: null as string | null,
  payoutChainId: null as number | null,
  payoutsEnabled: false,
};

function customerGateway(overrides: Record<string, (body: any, auth: string | null) => { status: number; body: unknown }> = {}) {
  const state = { ...account };
  return mockGateway((url, init) => {
    const route = `${init.method ?? "GET"} ${url.pathname}`;
    const auth = new Headers(init.headers).get("authorization");
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (overrides[route]) return overrides[route](body, auth);
    const authed = auth === `Bearer ${SESSION}`;
    switch (route) {
      case "GET /v1/chains":
        return { status: 200, body: chains };
      case "POST /v1/customer-auth/setup":
        return body.token === "cst_good"
          ? { status: 200, body: { sessionToken: SESSION, expiresAt: "t", account: { ...state, email: body.email } } }
          : { status: 400, body: { error: "this setup link is invalid, expired or already used" } };
      case "POST /v1/customer-auth/login":
        return body.partnerId === "p-1" && body.password === "right password"
          ? { status: 200, body: { sessionToken: SESSION, expiresAt: "t", account: state } }
          : { status: 401, body: { error: "invalid email or password" } };
      case "GET /v1/customer/me":
        return authed ? { status: 200, body: state } : { status: 401, body: { error: "unauthorized" } };
      case "POST /v1/customer/me/wallet":
        if (!authed) return { status: 401, body: { error: "unauthorized" } };
        Object.assign(state, { payoutWallet: body.address, payoutChainId: body.chainId });
        return { status: 200, body: state };
      case "POST /v1/customer/me/password":
        return body.currentPassword === "right password"
          ? { status: 200, body: state }
          : { status: 400, body: { error: "current password is incorrect" } };
      case "POST /v1/customer-auth/logout":
        return { status: 200, body: { ok: true } };
      default:
        return { status: 404, body: { error: "not found" } };
    }
  });
}

describe("customer account setup", () => {
  it("sets email and password from the setup link and lands on the account", async () => {
    const user = userEvent.setup();
    const fetchMock = customerGateway();
    renderApp("/account/setup?token=cst_good");
    await user.type(await screen.findByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "long enough pw");
    await user.type(screen.getByLabelText("Confirm password"), "long enough pw");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(screen.getByText("with Acme Pay")).toBeInTheDocument();
    expect(window.localStorage.getItem(CUSTOMER_SESSION_STORAGE)).toBe(SESSION);
    expect(window.localStorage.getItem(CUSTOMER_PARTNER_STORAGE)).toBe("p-1");
    const setup = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/customer-auth/setup"))!;
    expect(JSON.parse(String(setup[1]!.body))).toEqual({ token: "cst_good", email: "ada@example.com", password: "long enough pw" });
  });

  it("checks the passwords match and explains a used link", async () => {
    const user = userEvent.setup();
    customerGateway();
    renderApp("/account/setup?token=cst_used");
    await user.type(await screen.findByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "long enough pw");
    await user.type(screen.getByLabelText("Confirm password"), "different pw!");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don't match");

    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("Confirm password"), "long enough pw");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, expired or already used");
  });

  it("asks for a link when there is no token", async () => {
    customerGateway();
    renderApp("/account/setup");
    expect(await screen.findByText(/needs the setup link/)).toBeInTheDocument();
  });
});

describe("customer login and account", () => {
  it("signs in with the partner from the link", async () => {
    const user = userEvent.setup();
    customerGateway();
    renderApp("/account/login?partner=p-1");
    await user.type(await screen.findByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "right password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
  });

  it("sends signed-out visitors to sign-in, which needs the business link", async () => {
    customerGateway();
    renderApp("/account");
    expect(await screen.findByText(/Open the sign-in link/)).toBeInTheDocument();
  });

  it("saves a payout wallet, changes the password and signs out", async () => {
    const user = userEvent.setup();
    const fetchMock = customerGateway();
    window.localStorage.setItem(CUSTOMER_SESSION_STORAGE, SESSION);
    renderApp("/account");
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();

    await screen.findByRole("option", { name: "Arc" });
    await user.selectOptions(screen.getByLabelText("Network"), "5042");
    await user.type(screen.getByLabelText("Wallet address"), "0x00000000000000000000000000000000000000d1");
    await user.click(screen.getByRole("button", { name: "Save wallet" }));
    expect(await screen.findByText("Payout wallet saved.")).toBeInTheDocument();
    const wallet = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/customer/me/wallet"))!;
    expect(JSON.parse(String(wallet[1]!.body))).toEqual({ address: "0x00000000000000000000000000000000000000d1", chainId: 5042 });

    await user.type(screen.getByLabelText("Current password"), "nope");
    await user.type(screen.getByLabelText("New password"), "a brand new pw");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("current password is incorrect");
    await user.clear(screen.getByLabelText("Current password"));
    await user.type(screen.getByLabelText("Current password"), "right password");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText(/Other devices were signed out/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(window.localStorage.getItem(CUSTOMER_SESSION_STORAGE)).toBeNull());
    expect(await screen.findByRole("heading", { name: "Sign in to your account" })).toBeInTheDocument();
  });

  it("drops an expired session", async () => {
    customerGateway();
    window.localStorage.setItem(CUSTOMER_SESSION_STORAGE, "cs_expired");
    window.localStorage.setItem(CUSTOMER_PARTNER_STORAGE, "p-1");
    renderApp("/account");
    expect(await screen.findByRole("heading", { name: "Sign in to your account" })).toBeInTheDocument();
    expect(window.localStorage.getItem(CUSTOMER_SESSION_STORAGE)).toBeNull();
  });
});
