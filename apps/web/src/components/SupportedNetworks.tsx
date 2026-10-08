import { useQuery } from "@tanstack/react-query";
import { describeError, publicClient } from "../lib/gateway";

/** Live list of chains and tokens from GET /v1/chains + /v1/tokens. */
export function SupportedNetworks() {
  const chains = useQuery({ queryKey: ["public", "chains"], queryFn: () => publicClient.chains() });
  const tokens = useQuery({ queryKey: ["public", "tokens"], queryFn: () => publicClient.tokens() });

  if (chains.isPending || tokens.isPending) {
    return <p className="text-sm text-slate-500">Loading supported networks…</p>;
  }
  if (chains.error || tokens.error) {
    return (
      <p className="text-sm text-slate-500">
        Couldn't load the live network list ({describeError(chains.error ?? tokens.error)}).
      </p>
    );
  }

  const ordered = [...chains.data].sort((a, b) => Number(a.isArc) - Number(b.isArc) || a.name.localeCompare(b.name));

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((chain) => {
        const symbols = tokens.data.filter((t) => t.chainId === chain.id).map((t) => t.symbol);
        return (
          <li key={chain.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{chain.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  chain.isArc ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {chain.isArc ? (chain.testnet ? "Destination · testnet" : "Destination") : "Source"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Chain ID {chain.id}</p>
            <p className="mt-3 text-sm text-slate-700">{symbols.length ? symbols.join(", ") : "No tokens listed"}</p>
          </li>
        );
      })}
    </ul>
  );
}
