import { UpstreamQuote, QuoteProvider, QuoteRequest, IntentStatus } from "./types.js";

class MockProvider implements QuoteProvider {
  name = "mock";
  private statusMap = new Map<string, IntentStatus>();

  async getQuote(req: QuoteRequest): Promise<UpstreamQuote> {
    const estimatedOut = (BigInt(req.amountIn) * BigInt(95)) / BigInt(100);
    const minOut = estimatedOut - BigInt(10);

    const quote: UpstreamQuote = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      provider: this.name,
      amountIn: req.amountIn,
      estimatedOut: estimatedOut.toString(),
      minOut: minOut.toString(),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      unsignedTx: "0x" + "a".repeat(64),
      raw: { originChainId: req.originChainId, destChainId: req.destChainId },
    };

    this.statusMap.set(quote.id, IntentStatus.PENDING);

    return quote;
  }

  async submit(_quote: UpstreamQuote, _signedPayload: string): Promise<string> {
    return `intent-${Date.now()}-mock`;
  }

  async getStatus(upstreamId: string): Promise<IntentStatus> {
    let status = this.statusMap.get(upstreamId);
    if (!status) status = IntentStatus.PENDING;

    const current = status;

    if (status === IntentStatus.PENDING) {
      this.statusMap.set(upstreamId, IntentStatus.ORIGIN_CONFIRMED);
    } else if (status === IntentStatus.ORIGIN_CONFIRMED) {
      this.statusMap.set(upstreamId, IntentStatus.FILLED);
    }

    return current;
  }
}

export const mockProvider = new MockProvider();
