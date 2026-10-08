import { Link } from "react-router-dom";
import { Amount, ChainName } from "../../components/dashboard/Amount";
import { Card, Empty, ErrorState, Loading, PageTitle, Stat, StatusBadge, tokenTotalsText } from "../../components/dashboard/ui";
import { formatBps, formatDate } from "../../lib/format";
import { useCatalog, useCustomers, useLedger, usePartnerProfile, useQuotes } from "../../lib/queries";

export function Overview() {
  const profile = usePartnerProfile();
  const ledger = useLedger();
  const customers = useCustomers({ limit: 1 });
  const recent = useQuotes({ limit: 5 });
  const catalog = useCatalog();

  return (
    <>
      <PageTitle
        title="Overview"
        intro={
          profile.data
            ? `Fee ${formatBps(profile.data.feeBps)} · ${profile.data.rateLimitPerMin} requests/min`
            : "Loading…"
        }
        actions={
          <div className="flex gap-2">
            <Link to="/app/customers" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Add customer
            </Link>
            <Link to="/developers" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Integration docs
            </Link>
          </div>
        }
      />

      {ledger.error ? (
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Transactions" value={ledger.data?.totals.transactions ?? "…"} hint="Quotes created with this key" />
          <Stat
            label="Fees earned"
            value={<span className="text-lg">{ledger.data ? tokenTotalsText(ledger.data.byToken, "feeTotal") : "…"}</span>}
            hint="Per token sent"
          />
          <Stat label="Customers" value={customers.data?.total ?? "…"} />
        </div>
      )}

      <div className="mt-6">
        <Card
          title="Recent transactions"
          actions={
            <Link to="/app/transactions" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          }
        >
          {recent.isPending ? (
            <Loading />
          ) : recent.error ? (
            <ErrorState error={recent.error} />
          ) : recent.data.items.length === 0 ? (
            <Empty>
              No transactions yet. Request a quote with your API key and it shows up here.{" "}
              <Link to="/developers" className="text-brand-600 hover:underline">
                See how
              </Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.data.items.map((q) => (
                <li key={q.quoteId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <Amount catalog={catalog} chainId={q.originChainId} token={q.tokenIn} value={q.amountIn} />{" "}
                    <span className="text-slate-500">
                      from <ChainName catalog={catalog} chainId={q.originChainId} />
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{formatDate(q.createdAt)}</span>
                    <StatusBadge status={q.intent?.status ?? null} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
