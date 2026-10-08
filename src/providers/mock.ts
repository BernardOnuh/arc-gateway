import { randomBytes } from "crypto";
import type { UpstreamQuote, QuoteProvider, QuoteRequest, IntentStatusDetail } from "./types.js";
import { IntentStatus } from "./types.js";
import { getChain } from "../chains.js";
import { resolveToken } from "../tokens.js";

interface Tracked {
  status: IntentStatus;
  originTx: string | null;
  destTx: string | null;
}

function estimateOut(amountIn: bigint, originChainId: number, destChainId: number): bigint {
  // Simulated market quality: same-chain routes keep more, cross-chain
  // routes pay a simulated bridge/market spread.
  const spreadBps = originChainId === destChainId ? 9800n : 9300n; // 2% / 7%
  return (amountIn * spreadBps) / 10000n;
}

function randomTxHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

class MockProvider implements QuoteProvider {
  name = "mock";
  private tracked = new Map<string, Tracked>();

  async getQuote(req: QuoteRequest): Promise<UpstreamQuote> {
    const amountIn = BigInt(req.amountIn);
    const estimatedOut = estimateOut(amountIn, req.originChainId, req.destChainId);
    const minOut = (estimatedOut * BigInt(10000 - req.slippageBps)) / 10000n;

    const id = randomId("mock");
    this.tracked.set(id, { status: IntentStatus.PENDING, originTx: null, destTx: null });

    const origin = getChain(req.originChainId);
    const dest = getChain(req.destChainId);
    const tokenIn = resolveToken(req.originChainId, req.tokenIn);
    const tokenOut = resolveToken(req.destChainId, req.tokenOut);

    return {
      id,
      provider: this.name,
      amountIn: req.amountIn,
      estimatedOut: estimatedOut.toString(),
      minOut: minOut.toString(),
      expiresAt: req.deadline,
      unsignedTx: randomTxHash(),
      raw: {
        originChainId: req.originChainId,
        destChainId: req.destChainId,
        origin: origin?.name,
        destination: dest?.name,
        tokenIn: tokenIn?.symbol ?? req.tokenIn,
        tokenOut: tokenOut?.symbol ?? req.tokenOut,
      },
    };
  }

  async submit(_quote: UpstreamQuote, _signedPayload: string): Promise<string> {
    return randomId("intent");
  }

  async getStatus(upstreamId: string, _quote?: UpstreamQuote): Promise<IntentStatusDetail> {
    const current: Tracked =
      this.tracked.get(upstreamId) ?? { status: IntentStatus.PENDING, originTx: null, destTx: null };

    let next: Tracked = current;
    if (current.status === "PENDING") {
      next = { status: IntentStatus.ORIGIN_CONFIRMED, originTx: randomTxHash(), destTx: null };
    } else if (current.status === "ORIGIN_CONFIRMED") {
      next = { status: IntentStatus.FILLED, originTx: current.originTx, destTx: randomTxHash() };
    } else if (current.status === "FILLED") {
      next = { status: IntentStatus.EXECUTED_ON_ARC, originTx: current.originTx, destTx: current.destTx };
    }

    this.tracked.set(upstreamId, next);
    return { status: next.status, originTx: next.originTx, destTx: next.destTx };
  }
}

export const mockProvider = new MockProvider();