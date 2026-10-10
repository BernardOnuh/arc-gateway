import type { Chain, Intent, Quote, QuoteRequest, Token } from "./types.js";
import type { CheckoutChain, Payment, PaymentLeg, PriceItem } from "./checkout/types.js";

export class WidgetApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WidgetApiError";
  }
}

/** Minimal REST client: the widget must stand alone on partner pages. */
export function createApi(baseUrl: string, publishableKey: string) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = {};
    if (auth) headers.authorization = `Bearer ${publishableKey}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new WidgetApiError(0, "Can't reach the payment service. Check your connection and try again.");
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const reason =
        data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : undefined;
      throw new WidgetApiError(res.status, friendly(res.status, reason));
    }
    return data as T;
  }

  return {
    chains: () => request<Chain[]>("GET", "/v1/chains", undefined, false),
    tokens: () => request<Token[]>("GET", "/v1/tokens", undefined, false),
    quote: (params: QuoteRequest) => request<Quote>("POST", "/v1/quotes", params),
    intent: (id: string) => request<Intent>("GET", `/v1/intents/${encodeURIComponent(id)}`),
    checkoutChains: () => request<CheckoutChain[]>("GET", "/v1/chains", undefined, false),
    prices: () => request<{ source: string; items: PriceItem[] }>("GET", "/v1/prices"),
    payment: (id: string) => request<Payment>("GET", `/v1/payments/${encodeURIComponent(id)}`),
    addLeg: (
      id: string,
      body: { originChainId: number; tokenIn: string; amountIn: string; payer: string; slippageBps: number }
    ) => request<PaymentLeg>("POST", `/v1/payments/${encodeURIComponent(id)}/legs`, body),
    legSubmitted: (id: string, legId: string, txHash: string) =>
      request<PaymentLeg>(
        "POST",
        `/v1/payments/${encodeURIComponent(id)}/legs/${encodeURIComponent(legId)}/submitted`,
        { txHash }
      ),
  };
}

function friendly(status: number, reason?: string): string {
  if (status === 401) return "This widget's key isn't valid. Contact the site owner.";
  if (status === 404) return reason === "payment not found" ? "This payment link isn't valid." : (reason ?? "Not found.");
  if (status === 403) return reason === "origin not allowed for this publishable key"
    ? "This widget isn't enabled for this website."
    : (reason ?? "Not allowed.");
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return "The payment service is having trouble. Try again shortly.";
  return reason ?? `Request failed (HTTP ${status}).`;
}

export type WidgetApi = ReturnType<typeof createApi>;
