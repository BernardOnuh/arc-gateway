import type { Chain, IntentStatus, WidgetAppearance } from "../types.js";

/** Minimal EIP-1193 provider (MetaMask, Rabby, Coinbase Wallet extension…). */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

export interface CheckoutChain extends Chain {
  rpcUrl?: string;
}

export interface PriceItem {
  chainId: number;
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
  priceUsd: number;
}

/** A token the connected wallet holds, valued in USD. */
export interface Holding {
  key: string;
  chainId: number;
  chainName: string;
  token: PriceItem;
  balance: bigint;
  usd: number;
  /** Cents usable for payment (native tokens keep a little back for gas). */
  maxCents: number;
}

export type PaymentStatus = "open" | "processing" | "paid" | "partially_paid" | "expired" | "canceled";

export interface PaymentLeg {
  legId: string;
  quoteId: string;
  originChainId: number;
  token: { symbol: string; address: string; decimals: number; isNative: boolean };
  amountIn: string;
  valueCents: number;
  payer: string;
  status: IntentStatus | "QUOTED";
  originTx: string | null;
  destTx: string | null;
  execution: {
    fromChain: string | null;
    toChain: string | null;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    recipientAddress: string;
    slippageBps: number;
  };
}

export type CheckoutTextKey =
  | "title"
  | "connectButton"
  | "connectHint"
  | "payWithLabel"
  | "payButton"
  | "totalLabel"
  | "remainingLabel"
  | "keepOpen"
  | "emptyBalances"
  | "successTitle"
  | "successMessage"
  | "footer";

export type CheckoutTexts = Partial<Record<CheckoutTextKey, string>>;

/** Saved per business on the gateway (PUT /v1/partners/me/branding) and shipped with each payment. */
export interface CheckoutBranding {
  displayName?: string | null;
  /** Data URL (png, jpeg, webp, svg) or https URL. */
  logo?: string | null;
  accentColor?: string;
  theme?: "light" | "dark" | "auto";
  radius?: number;
  showNetworkDetails?: boolean;
  /** Placeholders: {amount}, {merchant}. An empty footer hides it. */
  texts?: CheckoutTexts;
}

/** Screens the demo can be pinned to, for previews. */
export type CheckoutPreviewState = "connect" | "select" | "paying" | "partial" | "done" | "expired" | "invalid";

export interface Payment {
  paymentId: string;
  merchantName: string;
  branding?: CheckoutBranding;
  amountCents: number;
  currency: string;
  description: string | null;
  reference: string | null;
  status: PaymentStatus;
  paidCents: number;
  pendingCents: number;
  remainingCents: number;
  destChainId: number;
  expiresAt: string;
  paidAt: string | null;
  legs: PaymentLeg[];
}

export interface ExecuteLegContext {
  leg: PaymentLeg;
  provider: Eip1193Provider;
  account: string;
}

export interface ArcCheckoutProps extends WidgetAppearance {
  /** pk_live_… key; its allowed origins must include this page. */
  publishableKey: string;
  /** Gateway URL. Default http://localhost:3000. */
  baseUrl?: string;
  /** From POST /v1/payments on your server. */
  paymentId?: string;
  /**
   * Run with a simulated wallet and payment, no network calls. For previews
   * and design work; ignored when paymentId is set.
   */
  demo?: { amountCents: number; merchantName: string; description?: string };
  /** Wallet to use. Default: the browser's injected wallet (window.ethereum). */
  provider?: Eip1193Provider;
  /**
   * Sends one leg from the customer's wallet and returns the origin tx hash.
   * Default: Circle App Kit swap signed by the customer's wallet (loaded on demand).
   */
  executeLeg?: (ctx: ExecuteLegContext) => Promise<string>;
  /** Show that settlement happens on ARC, with explorer links. Default: the saved branding, else false. */
  showNetworkDetails?: boolean;
  /**
   * Branding overrides on top of the business's saved branding (which the
   * payment carries). Explicit props like accentColor win over both.
   */
  branding?: CheckoutBranding;
  /** Demo only: show a specific screen (for design previews). */
  previewState?: CheckoutPreviewState;
  /** Max slippage per leg in basis points. Default 50. */
  slippageBps?: number;
  /** Payment status poll interval. Default 3000 ms. */
  pollIntervalMs?: number;
  onPaid?: (payment: Payment) => void;
  onStatus?: (payment: Payment) => void;
  onError?: (error: Error) => void;
}
