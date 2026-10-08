import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { IntentStatus } from "@arc/gateway-sdk";
import { Amount, ChainName, TxLink } from "../../components/dashboard/Amount";
import { Card, Empty, ErrorState, Loading, PageTitle, Pagination, StatusBadge } from "../../components/dashboard/ui";
import { formatDate, shortId } from "../../lib/format";
import { useCatalog, useIntents, useQuotes } from "../../lib/queries";

const PAGE_SIZE = 25;
const STATUSES: IntentStatus[] = ["PENDING", "ORIGIN_CONFIRMED", "FILLED", "EXECUTED_ON_ARC", "REFUNDED", "FAILED"];

export function Transactions() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "intents" ? "intents" : "quotes";
  const customerId = params.get("customerId") ?? undefined;
  const statusParam = params.get("status");
  const status = STATUSES.includes(statusParam as IntentStatus) ? (statusParam as IntentStatus) : undefined;

  function update(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    setParams(merged, { replace: true });
  }

  const tab = (id: "quotes" | "intents", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => update({ view: id === "quotes" ? undefined : id, status: undefined })}
      className={`rounded-md px-3 py-1.5 text-sm ${view === id ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageTitle title="Transactions" intro="Every quote made with your key, and the intents submitted from them." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tab("quotes", "Quotes")}
          {tab("intents", "Intents")}
        </div>
        {view === "intents" && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Status
            <select
              value={status ?? ""}
              onChange={(e) => update({ status: e.target.value || undefined })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        {customerId && (
          <span className="flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
            Customer {shortId(customerId)}
            <button type="button" aria-label="Clear customer filter" onClick={() => update({ customerId: undefined })}>
              ×
            </button>
          </span>
        )}
      </div>
      {view === "quotes" ? (
        <QuotesTable key={customerId ?? ""} customerId={customerId} />
      ) : (
        <IntentsTable key={`${customerId ?? ""}:${status ?? ""}`} customerId={customerId} status={status} />
      )}
    </>
  );
}

function QuotesTable({ customerId }: { customerId?: string }) {
  const [offset, setOffset] = useState(0);
  const quotes = useQuotes({ limit: PAGE_SIZE, offset, customerId });
  const catalog = useCatalog();

  return (
    <Card>
      {quotes.isPending ? (
        <Loading />
      ) : quotes.error ? (
        <ErrorState error={quotes.error} onRetry={() => void quotes.refetch()} />
      ) : quotes.data.items.length === 0 ? (
        <Empty>No quotes yet.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Route</th>
                  <th className="py-2 pr-4 font-medium">Amount in</th>
                  <th className="py-2 pr-4 font-medium">Fee</th>
                  <th className="py-2 pr-4 font-medium">Est. out</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.data.items.map((q) => (
                  <tr key={q.quoteId}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-500" title={`Quote ${q.quoteId}`}>
                      {formatDate(q.createdAt)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <ChainName catalog={catalog} chainId={q.originChainId} /> →{" "}
                      <ChainName catalog={catalog} chainId={q.destChainId} />
                    </td>
                    <td className="py-2 pr-4">
                      <Amount catalog={catalog} chainId={q.originChainId} token={q.tokenIn} value={q.amountIn} />
                    </td>
                    <td className="py-2 pr-4">
                      <Amount catalog={catalog} chainId={q.originChainId} token={q.tokenIn} value={q.feeAmount} />
                    </td>
                    <td className="py-2 pr-4">
                      {q.estimatedOut ? (
                        <Amount catalog={catalog} chainId={q.destChainId} token={q.tokenOut} value={q.estimatedOut} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={q.intent?.status ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={quotes.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </Card>
  );
}

function IntentsTable({ customerId, status }: { customerId?: string; status?: IntentStatus }) {
  const [offset, setOffset] = useState(0);
  const intents = useIntents({ limit: PAGE_SIZE, offset, customerId, status });
  const catalog = useCatalog();

  return (
    <Card>
      {intents.isPending ? (
        <Loading />
      ) : intents.error ? (
        <ErrorState error={intents.error} onRetry={() => void intents.refetch()} />
      ) : intents.data.items.length === 0 ? (
        <Empty>No intents{status ? ` with status ${status}` : ""}.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Submitted</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Route</th>
                  <th className="py-2 pr-4 font-medium">Origin tx</th>
                  <th className="py-2 pr-4 font-medium">ARC tx</th>
                  <th className="py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {intents.data.items.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-500" title={`Intent ${i.id}`}>
                      {formatDate(i.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={i.status} />
                      {i.error && <p className="mt-1 max-w-xs text-xs text-red-600">{i.error}</p>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <ChainName catalog={catalog} chainId={i.originChainId} /> →{" "}
                      <ChainName catalog={catalog} chainId={i.destChainId} />
                    </td>
                    <td className="py-2 pr-4">
                      <TxLink catalog={catalog} chainId={i.originChainId} hash={i.originTx} />
                    </td>
                    <td className="py-2 pr-4">
                      <TxLink catalog={catalog} chainId={i.destChainId} hash={i.destTx} />
                    </td>
                    <td className="whitespace-nowrap py-2 text-slate-500">{formatDate(i.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={intents.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </Card>
  );
}
