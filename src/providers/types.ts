export interface QuoteRequest {
  originChainId: number;
  destChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // base units as string
  recipient: string;
  slippageBps: number;
  deadline: number; // absolute unix seconds
}

export interface UpstreamQuote {
  id: string;
  provider: string;
  amountIn: string;
  estimatedOut: string;
  minOut: string;
  expiresAt: number;
  /** Unsigned origin transaction when the provider returns one (null until settlement wiring). */
  unsignedTx: string | null;
  raw: Record<string, unknown>;
}

export enum IntentStatus {
  PENDING = "PENDING",
  ORIGIN_CONFIRMED = "ORIGIN_CONFIRMED",
  FILLED = "FILLED",
  EXECUTED_ON_ARC = "EXECUTED_ON_ARC",
  REFUNDED = "REFUNDED",
  FAILED = "FAILED",
}

export interface IntentStatusDetail {
  status: IntentStatus;
  originTx?: string | null;
  destTx?: string | null;
}

export interface QuoteProvider {
  name: string;
  getQuote(req: QuoteRequest): Promise<UpstreamQuote>;
  submit(quote: UpstreamQuote, signedPayload: string): Promise<string>;
  getStatus(upstreamId: string, quote?: UpstreamQuote): Promise<IntentStatusDetail>;
}
