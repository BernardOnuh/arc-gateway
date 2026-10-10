import { randomBytes } from "crypto";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type {
  QuoteProvider,
  QuoteRequest,
  UpstreamQuote,
  IntentStatusDetail,
} from "./types.js";
import { IntentStatus } from "./types.js";
import { isArcChain } from "../chains.js";
import { getTokenByAddress, humanToBaseUnits } from "../tokens.js";
import { config } from "../config.js";

/**
 * Raised when Circle's Swap solver has no route for the requested combination
 * (unsupported chain/token/alias). The gateway translates this to HTTP 400.
 */
export class NoLiquidityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoLiquidityError";
  }
}

/** Mapping from gateway chain id -> Circle Swap chain alias (verified via getSupportedChains). */
export const APP_KIT_CHAINS: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  5042: "Arc",
  5042002: "Arc_Testnet",
};

/** Swap stables supported on the origin side (Arc itself only settles USDC/EURC/cirBTC). */
const STABLE_ALIASES = new Set(["USDC", "USDT", "EURC"]);

/** Whether Circle Swap can route this source token at all: a supported chain, and native gas or a stablecoin. */
export function canRouteFrom(chainId: number, token: { symbol: string; isNative: boolean }): boolean {
  return Boolean(APP_KIT_CHAINS[chainId]) && (token.isNative || STABLE_ALIASES.has(token.symbol.toUpperCase()));
}

/** Minimum estimateSwap param shape used by this provider (subset of SwapParams). */
export interface EstimateSwapParams {
  from: { adapter: unknown; chain: string };
  tokenIn: string;
  amountIn: string;
  tokenOut: string;
  to?: { chain: string; recipientAddress: string };
  config?: { apiKey?: string };
}

export interface EstimateSwapResult {
  estimatedOutput?: { amount?: string; token?: string };
  stopLimit?: Record<string, unknown> | null;
  fees?: readonly Record<string, unknown>[];
  [key: string]: unknown;
}

/** Swap params (execution). Adds slippage/stop-limit config over the quote params. */
export interface SwapParams extends EstimateSwapParams {
  config?: {
    apiKey?: string;
    slippageBps?: number;
    stopLimit?: string;
  };
}

export interface SwapResultLike {
  txHash?: string;
  chainIn?: string;
  chainOut?: string;
  amountOut?: string;
  progress?: { status?: string; substatus?: string; substatusMessage?: string };
  fees?: readonly Record<string, unknown>[];
  [key: string]: unknown;
}

export interface SwapStatusResultLike {
  progress?: { status?: string; substatus?: string; substatusMessage?: string };
  source?: { txHash?: string };
  destination?: { txHash?: string; amount?: string; token?: { symbol?: string } };
  [key: string]: unknown;
}

/** The small surface of AppKit this provider uses (kept structural for test injection). */
export interface AppKitLike {
  estimateSwap(params: EstimateSwapParams): Promise<EstimateSwapResult>;
  swap(params: SwapParams): Promise<SwapResultLike>;
  getSwapStatus(params: {
    txHash: string;
    chainIn: string;
    chainOut: string;
    config?: { apiKey?: string };
  }): Promise<SwapStatusResultLike>;
}

const DEFAULT_ADAPTER_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function classifySwapError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/no route|not supported by any available|route or resource not found/i.test(message)) {
    return new NoLiquidityError(message);
  }
  return err instanceof Error ? err : new Error(message);
}

export class ArcSwapProvider implements QuoteProvider {
  name = "arc-appkit";

  private kit: AppKitLike;
  private adapter: unknown;
  private apiKey?: string;

  constructor(overrides?: { kit?: AppKitLike; apiKey?: string }) {
    const privateKey = config.arcSdkPrivateKey ?? DEFAULT_ADAPTER_KEY;
    if (overrides?.kit) {
      // Unit tests inject a fake kit.
      this.kit = overrides.kit;
      this.adapter = { test: true };
    } else {
      this.adapter = createViemAdapterFromPrivateKey({ privateKey });
      this.kit = new AppKit({
        adapters: { viem: this.adapter },
        ...(config.arcApiKey ? { config: { apiKey: config.arcApiKey } } : {}),
      } as never) as unknown as AppKitLike;
    }
    this.apiKey = overrides?.apiKey ?? config.arcApiKey;
  }

  /**
   * Live quote from Circle's Swap solver. Only Ethereum/Base origin chains are
   * supported by Swap; BNB/Robinhood chains have no route and raise NoLiquidityError.
   */
  async getQuote(req: QuoteRequest): Promise<UpstreamQuote> {
    const originAlias = APP_KIT_CHAINS[req.originChainId];
    const destAlias = APP_KIT_CHAINS[req.destChainId];

    if (!originAlias) {
      throw new NoLiquidityError(
        `no swap route from chain ${req.originChainId}: not supported by the Circle Swap solver`
      );
    }
    if (!isArcChain(req.destChainId) || !destAlias) {
      throw new NoLiquidityError(
        `no swap route to chain ${req.destChainId}: Swap settles only on Arc (USDC/EURC)`
      );
    }

    const tokenIn = getTokenByAddress(req.originChainId, req.tokenIn);
    const tokenOut = getTokenByAddress(req.destChainId, req.tokenOut);
    if (!tokenIn) throw new NoLiquidityError(`tokenIn not found on chain ${req.originChainId}`);
    if (!tokenOut) throw new NoLiquidityError(`tokenOut not found on chain ${req.destChainId}`);

    if (req.recipient) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(req.recipient)) {
        throw new NoLiquidityError("invalid recipient address");
      }
    }

    const tokenInAlias = tokenIn.isNative ? "NATIVE" : tokenIn.symbol.toUpperCase();
    if (!STABLE_ALIASES.has(tokenInAlias) && !tokenIn.isNative) {
      throw new NoLiquidityError(
        `no swap route from ${tokenIn.symbol}: Circle Swap supports native gas and stablecoins (USDC/USDT/EURC)`
      );
    }
    if (!STABLE_ALIASES.has(tokenOut.symbol.toUpperCase())) {
      throw new NoLiquidityError(
        `no swap route to ${tokenOut.symbol}: destination on Arc can only be USDC or EURC`
      );
    }

    const amountIn = toHuman(BigInt(req.amountIn), tokenIn.decimals);
    const tokenOutAlias = tokenOut.symbol.toUpperCase();
    const estimateParams: EstimateSwapParams = {
      from: { adapter: this.adapter, chain: originAlias },
      tokenIn: tokenInAlias,
      amountIn,
      tokenOut: tokenOutAlias,
      to: { chain: destAlias, recipientAddress: req.recipient },
      config: this.apiKey ? { apiKey: this.apiKey } : undefined,
    };

    let estimate: EstimateSwapResult;
    try {
      estimate = await this.kit.estimateSwap(estimateParams);
    } catch (err) {
      throw classifySwapError(err);
    }

    const rawAmountIn = estimate.estimatedOutput?.amount;
    if (!rawAmountIn) {
      throw new NoLiquidityError("Circle Swap returned no output estimate for this route");
    }

    const estimatedOut = toBaseUnits(rawAmountIn, tokenOut.decimals);
    const minOut = (estimatedOut * BigInt(10000 - req.slippageBps)) / 10000n;

    return {
      id: randomId("arc"),
      provider: this.name,
      amountIn: req.amountIn,
      estimatedOut: estimatedOut.toString(),
      minOut: minOut.toString(),
      expiresAt: req.deadline,
      unsignedTx: null,
      raw: {
        route: `${tokenIn.symbol} (${originAlias}) -> ${tokenOut.symbol} (${destAlias})`,
        pricing: "circle-appkit-live",
        estimatedOutput: estimate.estimatedOutput,
        stopLimit: estimate.stopLimit ?? null,
        fees: estimate.fees ?? [],
        from: originAlias,
        to: destAlias,
        tokenOutDecimals: tokenOut.decimals,
        slippageBps: req.slippageBps,
        // Reused verbatim by submit() to execute the swap from the gateway wallet.
        swapParams: {
          from: { adapter: this.adapter, chain: originAlias },
          tokenIn: tokenInAlias,
          amountIn,
          tokenOut: tokenOutAlias,
          to: { chain: destAlias, recipientAddress: req.recipient },
          config: {
            ...(this.apiKey ? { apiKey: this.apiKey } : {}),
            slippageBps: req.slippageBps,
            ...(estimate.stopLimit?.amount ? { stopLimit: estimate.stopLimit.amount as string } : {}),
          },
        },
      },
    };
  }

  /**
   * Executes the quoted swap via Circle's Swap solver using the gateway hot
   * wallet (ARC_SDK_PRIVATE_KEY): it approves the origin token, builds the
   * CCTP crosschain swap and broadcasts it. Returns the origin-chain tx hash.
   *
   * Requires mainnet origin chains, ARC_CHAIN_ID=5042 (or a route the solver
   * accepts), a funded wallet for origin gas + tokenIn, and optionally a
   * CIRCLE_API_KEY. The partner's signedPayload is currently unused because
   * the gateway wallet is the signer (funding/approval flow for partners is a
   * later milestone).
   */
  async submit(quote: UpstreamQuote, _signedPayload: string): Promise<string> {
    const swapParams = (quote.raw as Record<string, unknown>)?.swapParams as SwapParams | undefined;
    if (!swapParams) {
      throw new Error("arc-appkit submit requires a quote produced by QUOTE_PROVIDER=arc");
    }
    let result: SwapResultLike;
    try {
      result = await this.kit.swap(swapParams);
    } catch (err) {
      throw classifySwapError(err);
    }
    if (!result.txHash) {
      throw new Error("Circle Swap executed but returned no origin transaction hash");
    }
    return result.txHash;
  }

  /**
   * Polls the Stablecoin Service for the swap's lifecycle using the origin
   * tx hash from submit(). Maps the solver status to gateway intent statuses:
   * PENDING -> ORIGIN_CONFIRMED, DONE -> EXECUTED_ON_ARC, FAILED/NOT_FOUND -> FAILED.
   */
  async getStatus(upstreamId: string, quote?: UpstreamQuote): Promise<IntentStatusDetail> {
    const raw = (quote?.raw ?? {}) as Record<string, unknown>;
    const chainIn = raw.from as string | undefined;
    const chainOut = raw.to as string | undefined;
    if (!chainIn || !chainOut) {
      throw new Error("arc-appkit status requires the originating quote for chain mapping");
    }

    let status: SwapStatusResultLike;
    try {
      status = await this.kit.getSwapStatus({
        txHash: upstreamId,
        chainIn,
        chainOut,
        config: this.apiKey ? { apiKey: this.apiKey } : undefined,
      });
    } catch (err) {
      throw classifySwapError(err);
    }

    const state = status.progress?.status ?? "PENDING";
    const originTx = status.source?.txHash ?? upstreamId;
    const destTx = status.destination?.txHash ?? null;

    if (state === "DONE") {
      return { status: IntentStatus.EXECUTED_ON_ARC, originTx, destTx };
    }
    if (state === "FAILED" || state === "NOT_FOUND") {
      return { status: IntentStatus.FAILED, originTx, destTx };
    }
    return { status: IntentStatus.ORIGIN_CONFIRMED, originTx, destTx };
  }
}

function toHuman(amountInBaseUnits: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  return `${amountInBaseUnits / divisor}.${(amountInBaseUnits % divisor).toString().padStart(decimals, "0")}`;
}

function toBaseUnits(human: string, decimals: number): bigint {
  return BigInt(humanToBaseUnits(human, decimals));
}

export const arcSwapProvider = new ArcSwapProvider();