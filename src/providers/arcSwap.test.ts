import { describe, it, expect } from "vitest";
import {
  ArcSwapProvider,
  NoLiquidityError,
  type AppKitLike,
  type EstimateSwapParams,
  type SwapParams,
} from "./arcSwap.js";
import { IntentStatus, type QuoteRequest, type UpstreamQuote } from "./types.js";
import { getTokenByAddress } from "../tokens.js";

function fakeKit(overrides: {
  result?: {
    estimatedOutput?: { amount?: string; token?: string };
    stopLimit?: { amount?: string; token?: string };
    fees?: readonly Record<string, unknown>[];
  };
  throwMessage?: string;
  swapResult?: { txHash?: string; progress?: { status?: string } };
  swapThrowMessage?: string;
  statusResult?: { progress?: { status?: string }; source?: { txHash?: string }; destination?: { txHash?: string } };
  statusThrowMessage?: string;
}): { kit: AppKitLike; captured: EstimateSwapParams[]; swapped: SwapParams[]; statusCalls: Array<{ txHash: string; chainIn: string; chainOut: string }> } {
  const captured: EstimateSwapParams[] = [];
  const swapped: SwapParams[] = [];
  const statusCalls: Array<{ txHash: string; chainIn: string; chainOut: string }> = [];
  const kit: AppKitLike = {
    async estimateSwap(params: EstimateSwapParams) {
      captured.push(params);
      if (overrides.throwMessage) throw new Error(overrides.throwMessage);
      return {
        estimatedOutput: overrides.result?.estimatedOutput ?? { amount: "1.005928", token: "EURC" },
        stopLimit: overrides.result?.stopLimit ?? { amount: "0.97575", token: "EURC" },
        fees: overrides.result?.fees ?? [{ token: "USDC", amount: "0.0002", type: "provider" }],
      };
    },
    async swap(params: SwapParams) {
      swapped.push(params);
      if (overrides.swapThrowMessage) throw new Error(overrides.swapThrowMessage);
      return {
        txHash: overrides.swapResult?.txHash ?? "0x" + "ab".repeat(32),
        progress: overrides.swapResult?.progress ?? { status: "PENDING" },
      };
    },
    async getSwapStatus(params: { txHash: string; chainIn: string; chainOut: string }) {
      statusCalls.push(params);
      if (overrides.statusThrowMessage) throw new Error(overrides.statusThrowMessage);
      return {
        progress: overrides.statusResult?.progress ?? { status: "PENDING" },
        source: overrides.statusResult?.source,
        destination: overrides.statusResult?.destination,
      };
    },
  };
  return { kit, captured, swapped, statusCalls };
}

function baseRequest(): QuoteRequest {
  return {
    originChainId: 1,
    destChainId: 5042002,
    tokenIn: "0x0000000000000000000000000000000000000000", // native ETH
    tokenOut: getTokenByAddress(5042002, "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a")!.address, // EURC
    amountIn: (1e18).toString(),
    recipient: "0x0000000000000000000000000000000000000001",
    slippageBps: 50,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe("ArcSwapProvider.getQuote", () => {
  it("maps native ETH -> 'NATIVE' alias and converts estimated output to base units", async () => {
    const { kit, captured } = fakeKit({
      result: { estimatedOutput: { amount: "2575.265912", token: "USDC" }, fees: [] },
    });
    const provider = new ArcSwapProvider({ kit });
    const quote = await provider.getQuote(baseRequest());

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      tokenIn: "NATIVE",
      tokenOut: "EURC",
      amountIn: "1.000000000000000000",
      to: { chain: "Arc_Testnet", recipientAddress: baseRequest().recipient },
    });
    expect(quote.provider).toBe("arc-appkit");
    expect(quote.unsignedTx).toBeNull();
    // EURC on Arc uses 6 decimals: 2575.265912 * 1e6
    expect(quote.estimatedOut).toBe("2575265912");
    expect(quote.minOut).toBe(((2575265912n * 9950n) / 10000n).toString());
    expect(quote.raw.pricing).toBe("circle-appkit-live");
    expect(quote.raw.route).toBe("ETH (Ethereum) -> EURC (Arc_Testnet)");
  });

  it("maps stablecoins by symbol and 6-decimal USDC amount to human string", async () => {
    const { kit, captured } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    const usdc = getTokenByAddress(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")!;
    await provider.getQuote({
      ...baseRequest(),
      tokenIn: usdc.address,
      amountIn: (1e6).toString(), // 1 USDC
      tokenOut: getTokenByAddress(5042002, "0x3600000000000000000000000000000000000000")!.address,
    });
    expect(captured[0]).toMatchObject({ tokenIn: "USDC", tokenOut: "USDC", amountIn: "1.000000" });
  });

  it("rejects a non-Arc destination as no-liquidity", async () => {
    const { kit } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    await expect(
      provider.getQuote({ ...baseRequest(), destChainId: 56 })
    ).rejects.toThrow(NoLiquidityError);
  });

  it("rejects an unsupported origin chain (Robinhood) as no-liquidity", async () => {
    const { kit } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    await expect(
      provider.getQuote({ ...baseRequest(), originChainId: 4663 })
    ).rejects.toThrow(/not supported by the Circle Swap solver/i);
  });

  it("rejects unsupported tokens (meme/defi) as no-liquidity", async () => {
    const { kit } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    const pepe = getTokenByAddress(1, "0x6982508145454Ce325dDbE47a25d4ec3d2311933")!;
    await expect(
      provider.getQuote({ ...baseRequest(), tokenIn: pepe.address })
    ).rejects.toThrow(NoLiquidityError);
  });

  it("maps solver 'No route available' failures to NoLiquidityError", async () => {
    const { kit } = fakeKit({ throwMessage: "Stablecoin Service createSwap failed: Route or resource not found. Details: No route available" });
    const provider = new ArcSwapProvider({ kit });
    await expect(provider.getQuote(baseRequest())).rejects.toThrow(NoLiquidityError);
  });

  it("propagates non-route upstream failures as generic errors", async () => {
    const { kit } = fakeKit({ throwMessage: "timeout hitting stablecoin service" });
    const provider = new ArcSwapProvider({ kit });
    await expect(provider.getQuote(baseRequest())).rejects.toThrow(/timeout/);
  });

  it("rejects an invalid recipient", async () => {
    const { kit } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    await expect(
      provider.getQuote({ ...baseRequest(), recipient: "not-an-address" })
    ).rejects.toThrow(/invalid recipient/);
  });
});

async function makeQuote(provider: ArcSwapProvider): Promise<UpstreamQuote> {
  return provider.getQuote(baseRequest());
}

describe("ArcSwapProvider.submit", () => {
  it("executes the swap with the stored swapParams and returns the tx hash", async () => {
    const { kit, swapped } = fakeKit({ swapResult: { txHash: "0x" + "cd".repeat(32) } });
    const provider = new ArcSwapProvider({ kit });
    const quote = await makeQuote(provider);

    const upstreamId = await provider.submit(quote, "0x00");
    expect(upstreamId).toBe("0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd");
    expect(swapped).toHaveLength(1);
    expect(swapped[0]).toMatchObject({
      tokenIn: "NATIVE",
      tokenOut: "EURC",
      to: { chain: "Arc_Testnet", recipientAddress: baseRequest().recipient },
      config: { slippageBps: 50, stopLimit: expect.any(String) },
    });
  });

  it("fails cleanly when the quote was not produced by the arc provider", async () => {
    const { kit } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    await expect(
      provider.submit({ id: "x", provider: "mock", amountIn: "1", estimatedOut: "1", minOut: "1", expiresAt: 0, unsignedTx: null, raw: {} }, "0x00")
    ).rejects.toThrow(/requires a quote produced by QUOTE_PROVIDER=arc/i);
  });

  it("classifies no-route swap failures as NoLiquidityError", async () => {
    const { kit } = fakeKit({ swapThrowMessage: "No route available" });
    const provider = new ArcSwapProvider({ kit });
    const quote = await makeQuote(provider);
    await expect(provider.submit(quote, "0x00")).rejects.toThrow(NoLiquidityError);
  });
});

describe("ArcSwapProvider.getStatus", () => {
  it("polls with the quote's chain mapping and maps DONE to EXECUTED_ON_ARC", async () => {
    const { kit, statusCalls } = fakeKit({
      statusResult: {
        progress: { status: "DONE" },
        source: { txHash: "0xaa" },
        destination: { txHash: "0xbb" },
      },
    });
    const provider = new ArcSwapProvider({ kit });
    const quote = await makeQuote(provider);

    const detail = await provider.getStatus("0xaa", quote);
    expect(statusCalls[0]).toEqual({ txHash: "0xaa", chainIn: "Ethereum", chainOut: "Arc_Testnet" });
    expect(detail).toEqual({
      status: IntentStatus.EXECUTED_ON_ARC,
      originTx: "0xaa",
      destTx: "0xbb",
    });
  });

  it("maps PENDING to ORIGIN_CONFIRMED with the origin tx hash", async () => {
    const { kit } = fakeKit({ statusResult: { progress: { status: "PENDING" }, source: { txHash: "0xaa" } } });
    const provider = new ArcSwapProvider({ kit });
    const quote = await makeQuote(provider);
    const detail = await provider.getStatus("0xaa", quote);
    expect(detail.status).toBe(IntentStatus.ORIGIN_CONFIRMED);
    expect(detail.originTx).toBe("0xaa");
  });

  it("maps FAILED and NOT_FOUND to FAILED", async () => {
    for (const bad of ["FAILED", "NOT_FOUND"]) {
      const { kit } = fakeKit({ statusResult: { progress: { status: bad } } });
      const provider = new ArcSwapProvider({ kit });
      const quote = await makeQuote(provider);
      const detail = await provider.getStatus("0xaa", quote);
      expect(detail.status).toBe(IntentStatus.FAILED);
    }
  });

  it("throws if the originating quote is missing (mock-mode quotes), surfaces as 502", async () => {
    const { kit, statusCalls } = fakeKit({});
    const provider = new ArcSwapProvider({ kit });
    await expect(provider.getStatus("0xaa")).rejects.toThrow(/requires the originating quote/i);
    expect(statusCalls).toHaveLength(0);
  });
});