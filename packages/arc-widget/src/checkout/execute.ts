import type { ExecuteLegContext } from "./types.js";

/**
 * Default leg executor: a Circle App Kit swap signed by the customer's own
 * wallet. App Kit is loaded on demand (a separate chunk), so pages that never
 * pay don't download it.
 */
export async function appKitExecute({ leg, provider }: ExecuteLegContext): Promise<string> {
  const e = leg.execution;
  if (!e.fromChain || !e.toChain) throw new Error(`${leg.token.symbol} can't be paid from this network yet.`);
  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"),
    import("@circle-fin/adapter-viem-v2"),
  ]);
  const adapter = await createViemAdapterFromProvider({ provider: provider as never });
  const kit = new AppKit({ adapters: { viem: adapter } } as never) as unknown as {
    swap(params: unknown): Promise<{ txHash?: string }>;
  };
  const result = await kit.swap({
    from: { adapter, chain: e.fromChain },
    tokenIn: e.tokenIn,
    amountIn: e.amountIn,
    tokenOut: e.tokenOut,
    to: { chain: e.toChain, recipientAddress: e.recipientAddress },
    config: { slippageBps: e.slippageBps },
  });
  if (!result?.txHash) throw new Error("Your wallet didn't return a transaction.");
  return result.txHash;
}
