import type { ReactNode } from "react";
import { EmptyArt } from "../art";
import type { IntentStatus, LedgerTokenTotals } from "@arc/gateway-sdk";
import { describeError } from "../../lib/gateway";
import { formatUnits } from "../../lib/format";

export function PageTitle({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold">{title}</h1>
        {intro && <p className="mt-1 text-sm text-slate-500">{intro}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="font-display text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient" />
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-slate-500">
      <EmptyArt className="h-16 w-24" />
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

export function Loading() {
  return (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      Loading…
    </p>
  );
}

const statusStyles: Record<IntentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  ORIGIN_CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-200",
  FILLED: "bg-brand-50 text-brand-700 ring-brand-200",
  EXECUTED_ON_ARC: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REFUNDED: "bg-amber-50 text-amber-800 ring-amber-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: IntentStatus | null }) {
  if (!status) return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-500">Quoted</span>;
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${statusStyles[status]}`}>
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
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
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110 disabled:opacity-60";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60";
