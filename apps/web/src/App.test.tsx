import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_KEY_STORAGE } from "./lib/auth";
import { mockGateway, profile, renderApp } from "./test/render";

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

describe("api-key login", () => {
  it("validates the key, stores it, and returns to the page that was requested", async () => {
    const fetchMock = gatewayWithKey();
    renderApp("/app/customers");
    await userEvent.type(await screen.findByLabelText("API key"), `  ${GOOD_KEY}  `);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("Acme Pay")).toBeInTheDocument();
    expect(window.localStorage.getItem(API_KEY_STORAGE)).toBe(GOOD_KEY);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:3000/v1/partners/me");
  });

  it("rejects a wrong key without storing it", async () => {
    gatewayWithKey();
    renderApp("/app/login");
    await userEvent.type(await screen.findByLabelText("API key"), "gw_live_wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not accepted");
    expect(window.localStorage.getItem(API_KEY_STORAGE)).toBeNull();
  });

  it("explains legacy keys that are not linked to a partner", async () => {
    gatewayWithKey();
    renderApp("/app/login");
    await userEvent.type(await screen.findByLabelText("API key"), "gw_live_legacy");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't linked to a partner");
  });

  it("reports an unreachable gateway", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    renderApp("/app/login");
    await userEvent.type(await screen.findByLabelText("API key"), GOOD_KEY);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the gateway");
  });

  it("keeps a stored key across reloads and logs out", async () => {
    gatewayWithKey();
    window.localStorage.setItem(API_KEY_STORAGE, GOOD_KEY);
    renderApp("/app");
    expect(await screen.findByText("Fee 0.10% · 30 requests/min")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
    expect(window.localStorage.getItem(API_KEY_STORAGE)).toBeNull();
  });

  it("signs out when the stored key is no longer accepted", async () => {
    gatewayWithKey();
    window.localStorage.setItem(API_KEY_STORAGE, "gw_live_revoked");
    renderApp("/app");
    await waitFor(() => expect(window.localStorage.getItem(API_KEY_STORAGE)).toBeNull());
    expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
  });
});
