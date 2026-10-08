export type IntentStatus =
  | "PENDING"
  | "ORIGIN_CONFIRMED"
  | "FILLED"
  | "EXECUTED_ON_ARC"
  | "REFUNDED"
  | "FAILED";

export const TERMINAL_STATUSES: readonly IntentStatus[] = ["EXECUTED_ON_ARC", "FAILED", "REFUNDED"];

export interface Chain {
  id: number;
  name: string;
  isArc: boolean;
  testnet: boolean;
  explorerUrl: string;
}

export interface Token {
  chainId: number;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

export interface QuoteRequest {
  originChainId: number;
  destChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  recipient: string;
  slippageBps: number;
  deadline: number;
  customerId?: string;
}

export interface Quote {
  quoteId: string;
  amountIn: string;
  feeAmount: string;
  feeBps: number;
  netAmount: string;
  estimatedOut: string;
  minOut: string;
  expiresAt: number;
  unsignedTx: string | null;
}

/** What the widget hands your submitIntent callback. */
export interface WidgetQuote extends Quote {
  request: QuoteRequest;
  tokenIn: Token;
  tokenOut: Token;
}

export interface Intent {
  id: string;
  status: IntentStatus;
  originTx: string | null;
  destTx: string | null;
  upstreamId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArcSwapWidgetProps {
  /** pk_live_… key from your dashboard. Its allowed origins must include this page's origin. */
  publishableKey: string;
  /** Gateway URL. Default http://localhost:3000. */
  baseUrl?: string;
  /** Preselected source chain. */
  originChainId?: number;
  /** Preselected ARC chain (destination). */
  destChainId?: number;
  /** Fixed receiving address. If set, the customer can't edit it. */
  recipient?: string;
  /** Attribute the quote to one of your registered customers. */
  customerId?: string;
  /** Max slippage in basis points (0-100). Default 50. */
  slippageBps?: number;
  /**
   * Submit the quote from YOUR server with your secret key
   * (POST /v1/intents/submit) and return the intentId. Publishable keys
   * can't submit. Omit it to run the widget in quote-only preview mode.
   */
  submitIntent?: (quote: WidgetQuote) => Promise<{ intentId: string }>;
  onQuote?: (quote: WidgetQuote) => void;
  onStatus?: (intent: Intent) => void;
  /** Fired once when the intent reaches EXECUTED_ON_ARC, FAILED or REFUNDED. */
  onIntent?: (intent: Intent) => void;
  onError?: (error: Error) => void;
  /** Status poll interval. Default 3000 ms. */
  pollIntervalMs?: number;
}
