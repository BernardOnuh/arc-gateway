import type { CheckoutChain, Eip1193Provider, Holding, PriceItem } from "./types.js";

export function injectedProvider(): Eip1193Provider | null {
  const eth = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

export async function connectWallet(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("Your wallet didn't share an account.");
  return accounts[0].toLowerCase();
}

/** True when the wallet says the user cancelled (EIP-1193 code 4001). */
export function isUserRejection(err: unknown): boolean {
  const e = err as { code?: number; message?: string; cause?: { code?: number } };
  return e?.code === 4001 || e?.cause?.code === 4001 || /user (rejected|denied)|rejected the request/i.test(e?.message ?? "");
}

const GAS_RESERVE_USD = 0.75;

/**
 * Reads native and ERC-20 balances on each chain with one JSON-RPC batch per
 * chain. A chain whose RPC fails is skipped, so one bad network never blocks
 * the checkout.
 */
export async function readHoldings(chains: CheckoutChain[], prices: PriceItem[], account: string): Promise<Holding[]> {
  const padded = account.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const byChain = new Map<number, PriceItem[]>();
  for (const p of prices) byChain.set(p.chainId, [...(byChain.get(p.chainId) ?? []), p]);

  const perChain = await Promise.all(
    [...byChain.entries()].map(async ([chainId, tokens]) => {
      const chain = chains.find((c) => c.id === chainId);
      if (!chain?.rpcUrl) return [];
      const batch = tokens.map((t, i) =>
        t.isNative
          ? { jsonrpc: "2.0", id: i, method: "eth_getBalance", params: [account, "latest"] }
          : { jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: t.address, data: `0x70a08231${padded}` }, "latest"] }
      );
      try {
        const res = await fetch(chain.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch) });
        const out = (await res.json()) as { id: number; result?: string }[];
        return tokens.flatMap((t, i): Holding[] => {
          const hex = out.find((r) => r.id === i)?.result;
          if (!hex || hex === "0x") return [];
          const balance = BigInt(hex);
          if (balance === 0n) return [];
          const usd = (Number(balance) / 10 ** t.decimals) * t.priceUsd;
          const usable = t.isNative ? Math.max(0, usd - GAS_RESERVE_USD) : usd;
          return [
            {
              key: `${chainId}:${t.address}`,
              chainId,
              chainName: chain.name,
              token: t,
              balance,
              usd,
              maxCents: Math.floor(usable * 100),
            },
          ];
        });
      } catch {
        return [];
      }
    })
  );
  return perChain.flat().sort((a, b) => b.usd - a.usd);
}

/** Base units needed to cover `cents`, with a buffer for slippage and price drift, capped at the balance. */
export function amountForCents(h: Holding, cents: number, slippageBps: number): bigint {
  const usd = (cents / 100) * (1 + (slippageBps + 100) / 10_000);
  const units = BigInt(Math.ceil((usd / h.token.priceUsd) * 10 ** Math.min(h.token.decimals, 15))) *
    10n ** BigInt(Math.max(0, h.token.decimals - 15));
  return units > h.balance ? h.balance : units;
}
