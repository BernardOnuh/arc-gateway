import type { ReactNode } from "react";
import type { IntentStatus, LedgerTokenTotals } from "@arc/gateway-sdk";
import { describeError } from "../../lib/gateway";
import { formatUnits } from "../../lib/format";

export function PageTitle({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-sm text-slate-500">{intro}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {describeError(error)}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 font-medium underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>;
}

const statusStyles: Record<IntentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  ORIGIN_CONFIRMED: "bg-blue-50 text-blue-700",
  FILLED: "bg-indigo-50 text-indigo-700",
  EXECUTED_ON_ARC: "bg-green-50 text-green-700",
  REFUNDED: "bg-amber-50 text-amber-800",
  FAILED: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: IntentStatus | null }) {
  if (!status) return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-500">Quoted</span>;
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/** "0.001 WETH · 5 USDC" from per-token totals. */
export function tokenTotalsText(rows: LedgerTokenTotals[], field: "feeTotal" | "amountInTotal"): string {
  if (rows.length === 0) return "—";
  return rows
    .map((r) => (r.decimals === null ? `${r[field]} ${r.symbol} (base units)` : `${formatUnits(r[field], r.decimals)} ${r.symbol}`))
    .join(" · ");
}

export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
export const buttonClass =
  "rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";
