import { getChain } from "./chains.js";

/**
 * Who sent a transaction, read from the chain's public RPC. Returns null when
 * the transaction isn't visible yet or the RPC can't be reached: callers treat
 * that as "can't tell yet", never as proof.
 */
export async function transactionSender(chainId: number, txHash: string, timeoutMs = 5000): Promise<string | null> {
  const rpcUrl = getChain(chainId)?.rpcUrl;
  if (!rpcUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [txHash] }),
      signal: controller.signal,
    });
    const body = (await res.json()) as { result?: { from?: string } | null };
    return body.result?.from?.toLowerCase() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
