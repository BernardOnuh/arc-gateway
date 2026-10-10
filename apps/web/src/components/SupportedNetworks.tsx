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
    <ul aria-label="Supported networks" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((chain) => {
        const symbols = tokens.data.filter((t) => t.chainId === chain.id).map((t) => t.symbol);
        return (
          <li
            key={chain.id}
            className={`card p-5 ${chain.isArc ? "ring-1 ring-brand-500/30" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-3 font-medium">
                <span
                  aria-hidden
                  className={`grid h-9 w-9 place-items-center rounded-full font-display text-sm font-semibold ${
                    chain.isArc ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {chain.name.slice(0, 1)}
                </span>
                {chain.name}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  chain.isArc ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {chain.isArc ? (chain.testnet ? "Destination · testnet" : "Destination") : "Source"}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs text-slate-400">Chain ID {chain.id}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {symbols.length ? (
                symbols.map((sym) => (
                  <span key={sym} className="rounded-md bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                    {sym}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No tokens listed</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
