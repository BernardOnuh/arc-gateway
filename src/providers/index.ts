import { config } from "../config.js";
import type { QuoteProvider } from "./types.js";
import { mockProvider } from "./mock.js";
import { arcSwapProvider } from "./arcSwap.js";

/**
 * Active liquidity provider.
 * - "mock": simulated reference prices (default; used by tests).
 * - "arc": live quotes from the Circle Swap solver (App Kit) via `arcSwapProvider`.
 */
export const quoteProvider: QuoteProvider =
  config.quoteProvider === "arc" ? arcSwapProvider : mockProvider;