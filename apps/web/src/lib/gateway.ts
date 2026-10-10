import { GatewayClient, GatewayError } from "stableflow-sdk";
import { GATEWAY_URL } from "./env";

export function createGatewayClient(apiKey?: string): GatewayClient {
  return new GatewayClient({ baseUrl: GATEWAY_URL, apiKey });
}

/** Unauthenticated client for public endpoints (chains, tokens, signup). */
export const publicClient = createGatewayClient();

/**
 * Dashboard client: authenticated by the httpOnly session cookie. The
 * x-arc-dashboard header is the gateway's CSRF check for cookie requests.
 */
export const sessionClient = new GatewayClient({
  baseUrl: GATEWAY_URL,
  credentials: "include",
  headers: { "x-arc-dashboard": "1" },
});

/** Turn any thrown value into a sentence a partner can act on. */
export function describeError(err: unknown): string {
  if (err instanceof GatewayError) {
    const reason =
      err.body && typeof err.body === "object" && "error" in err.body
        ? String((err.body as { error: unknown }).error)
        : undefined;
    switch (err.statusCode) {
      case 401:
        return "That API key was not accepted. Check it and try again.";
      case 429:
        return "Too many requests. Wait a minute and try again.";
      case 0:
        return reason ?? "The request timed out.";
      default:
        return reason ?? `The gateway returned an error (HTTP ${err.statusCode}).`;
    }
  }
  if (err instanceof TypeError) {
    return `Can't reach the gateway at ${GATEWAY_URL}. Is it running?`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
