export interface QuoteRequest {
  originChainId: number;
  destChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // base units as string
  recipient: string;
  slippageBps: number;
  deadlineSeconds: number;
}

export interface UpstreamQuote {
  id: string;
  provider: string;
  amountIn: string;
  estimatedOut: string;
  minOut: string;
  expiresAt: number;
  unsignedTx: string;
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

export interface QuoteProvider {
  name: string;
  getQuote(req: QuoteRequest): Promise<UpstreamQuote>;
  submit(quote: UpstreamQuote, signedPayload: string): Promise<string>;
  getStatus(upstreamId: string): Promise<IntentStatus>;
}
