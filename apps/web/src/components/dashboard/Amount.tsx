import type { Catalog } from "../../lib/queries";
import { formatUnits } from "../../lib/format";

/** Base-unit amount labelled with its token, or raw units if the token is unknown. */
export function Amount({
  catalog,
  chainId,
  token,
  value,
}: {
  catalog: Catalog;
  chainId: number;
  token: string;
  value: string;
}) {
  const info = catalog.token(chainId, token);
  if (!info) return <span className="font-mono" title="base units">{value}</span>;
  return (
    <span className="whitespace-nowrap" title={`${value} base units`}>
      {formatUnits(value, info.decimals)} {info.symbol}
    </span>
  );
}

export function TxLink({ catalog, chainId, hash }: { catalog: Catalog; chainId: number; hash: string | null }) {
  if (!hash) return <span className="text-ink-400">—</span>;
  const chain = catalog.chain(chainId);
  const label = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  if (!chain || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return <span className="font-mono text-xs">{label}</span>;
  return (
    <a
      href={`${chain.explorerUrl.replace(/\/+$/, "")}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-brand-600 hover:underline"
    >
      {label}
    </a>
  );
}

export function ChainName({ catalog, chainId }: { catalog: Catalog; chainId: number }) {
  return <>{catalog.chain(chainId)?.name ?? `Chain ${chainId}`}</>;
}
