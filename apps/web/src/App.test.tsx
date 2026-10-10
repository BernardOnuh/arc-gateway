import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_API_KEY_STORAGE } from "./lib/auth";
import { gatewayAccounts, gatewaySession, mockGateway, profile, renderApp, startSession } from "./test/render";

const GOOD_KEY = "gw_live_good";

function gatewayWithKey() {
  return mockGateway((url, init) => {
    const auth = new Headers(init.headers).get("authorization");
    if (url.pathname === "/v1/partners/me") {
      if (auth === `Bearer ${GOOD_KEY}`) return { status: 200, body: profile };
      if (auth === "Bearer gw_live_legacy") return { status: 400, body: { error: "api key is not linked to a partner" } };
      return { status: 401, body: { error: "unauthorized" } };
    }
    return { status: 404, body: { error: "not found" } };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routing", () => {
  it("renders the marketing home with a signup CTA", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/cross-chain gateway to ARC/i);
    const ctas = screen.getAllByRole("link", { name: "Get your API key" });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/signup");
  });

  it("renders each marketing page", () => {
    for (const [path, title] of [
      ["/how-it-works", "How it works"],
      ["/developers", "Developers"],
      ["/pricing", "Pricing"],
      ["/signup", "Get your API key"],
    ]) {
      const { unmount } = renderApp(path);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
      unmount();
    }
  });

  it("shows not found for unknown paths", () => {
    renderApp("/nope");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("redirects signed-out visitors from the dashboard to login", async () => {
    renderApp("/app/customers");
    expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
  });
});

/** The key must only ever travel in the session-open body, never as a header or in storage. */
function expectKeyNeverExposed(fetchMock: ReturnType<typeof mockGateway>) {
  for (const [, init] of fetchMock.mock.calls) {
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
  }
  expect(Object.values({ ...window.localStorage })).not.toContain(GOOD_KEY);
}

describe("email + password login", () => {
  it("is the default and signs in with the business email", async () => {
    const fetchMock = gatewayWithKey();
    gatewayAccounts.set("billing@acme.example", { password: "correct horse battery", apiKey: GOOD_KEY });
    renderApp("/app");
    await userEvent.type(await screen.findByLabelText("Email"), "billing@acme.example");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Fee 0.10% · 30 requests/min")).toBeInTheDocument();
    const open = fetchMock.mock.calls.find(([u]) => String(u) === "http://localhost:3000/v1/dashboard/session")!;
    expect(JSON.parse(String(open[1]!.body))).toEqual({ email: "billing@acme.example", password: "correct horse battery" });
    expectKeyNeverExposed(fetchMock);
  });

  it("says when the email and password don't match", async () => {
    gatewayWithKey();
    gatewayAccounts.set("billing@acme.example", { password: "correct horse battery", apiKey: GOOD_KEY });
    renderApp("/app/login");
    await userEvent.type(await screen.findByLabelText("Email"), "billing@acme.example");
    await userEvent.type(screen.getByLabelText("Password"), "wrong password!!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");
    expect(gatewaySession.key).toBeNull();
  });
});

describe("api-key login", () => {
  it("exchanges the key for a session cookie and returns to the page that was requested", async () => {
    const fetchMock = gatewayWithKey();
    renderApp("/app/customers");
    await userEvent.click(await screen.findByRole("tab", { name: "API key" }));
    await userEvent.type(screen.getByLabelText("API key"), `  ${GOOD_KEY}  `);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("Acme Pay")).toBeInTheDocument();
    expect(gatewaySession.key).toBe(GOOD_KEY);
    const open = fetchMock.mock.calls.find(([u]) => String(u) === "http://localhost:3000/v1/dashboard/session")!;
    expect(JSON.parse(String(open[1]!.body))).toEqual({ apiKey: GOOD_KEY });
    expect(open[1]!.credentials).toBe("include");
    expectKeyNeverExposed(fetchMock);
  });

  it("rejects a wrong key without opening a session", async () => {
    gatewayWithKey();
    renderApp("/app/login");
    await userEvent.click(await screen.findByRole("tab", { name: "API key" }));
    await userEvent.type(screen.getByLabelText("API key"), "gw_live_wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not accepted");
    expect(gatewaySession.key).toBeNull();
  });

  it("explains legacy keys that are not linked to a partner", async () => {
    gatewayWithKey();
    renderApp("/app/login");
    await userEvent.click(await screen.findByRole("tab", { name: "API key" }));
    await userEvent.type(screen.getByLabelText("API key"), "gw_live_legacy");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't linked to a partner");
  });

  it("reports an unreachable gateway", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    renderApp("/app/login");
    await userEvent.click(await screen.findByRole("tab", { name: "API key" }));
    await userEvent.type(screen.getByLabelText("API key"), GOOD_KEY);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the gateway");
  });

  it("keeps the session across reloads and logs out", async () => {
    const fetchMock = gatewayWithKey();
    startSession(GOOD_KEY);
    renderApp("/app");
    expect(await screen.findByText("Fee 0.10% · 30 requests/min")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(gatewaySession.key).toBeNull());
    expectKeyNeverExposed(fetchMock);
  });

  it("sends signed-out visitors to login once the gateway says there is no session", async () => {
    gatewayWithKey();
    startSession("gw_live_revoked");
    renderApp("/app");
    expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
  });

  it("moves a key left in localStorage by an older build into a session, then deletes it", async () => {
    const fetchMock = gatewayWithKey();
    window.localStorage.setItem(LEGACY_API_KEY_STORAGE, GOOD_KEY);
    renderApp("/app");
    expect(await screen.findByText("Fee 0.10% · 30 requests/min")).toBeInTheDocument();
    expect(window.localStorage.getItem(LEGACY_API_KEY_STORAGE)).toBeNull();
    expect(gatewaySession.key).toBe(GOOD_KEY);
    expectKeyNeverExposed(fetchMock);
  });
});

describe("password reset", () => {
  it("requests a link from the login page", async () => {
    const fetchMock = mockGateway((url) =>
      url.pathname === "/v1/partners/me" ? { status: 401, body: { error: "unauthorized" } } : { status: 200, body: { ok: true } }
    );
    renderApp("/app/login");
    await userEvent.click(await screen.findByRole("link", { name: "Forgot password?" }));
    await userEvent.type(await screen.findByLabelText("Email"), "billing@acme.example");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("reset link is on its way");
    const req = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/partners/password-reset"))!;
    expect(JSON.parse(String(req[1]!.body))).toEqual({ email: "billing@acme.example" });
  });

  it("uses the token once to set the new password", async () => {
    const fetchMock = mockGateway((url) =>
      url.pathname === "/v1/partners/me" ? { status: 401, body: { error: "unauthorized" } } : { status: 200, body: { ok: true } }
    );
    renderApp("/app/reset-password?token=cst_abc123token");
    await userEvent.type(await screen.findByLabelText("New password"), "a fresh passphrase");
    await userEvent.type(screen.getByLabelText("Confirm password"), "a fresh passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password is updated");
    const req = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/password-reset/confirm"))!;
    expect(JSON.parse(String(req[1]!.body))).toEqual({ token: "cst_abc123token", newPassword: "a fresh passphrase" });
  });
});
