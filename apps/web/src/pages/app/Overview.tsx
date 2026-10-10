import { Link } from "react-router-dom";
import { SkyBackdrop } from "../../components/art";
import { Amount, ChainName } from "../../components/dashboard/Amount";
import {
  buttonClass,
  Card,
  Empty,
  ErrorState,
  Loading,
  PageTitle,
  secondaryButtonClass,
  Stat,
  StatusBadge,
  tokenTotalsText,
} from "../../components/dashboard/ui";
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
            <Link to="/app/customers" className={buttonClass}>
              Add customer
            </Link>
            <Link to="/developers" className={secondaryButtonClass}>
              Integration docs
            </Link>
          </div>
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-3xl px-6 py-9 text-white sm:px-9">
        <SkyBackdrop />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#3d5fae]/80 via-[#3d5fae]/30 to-transparent" />
        <div className="relative">
          <p className="text-sm font-medium text-white/85">Welcome back{profile.data ? `, ${profile.data.name}` : ""}</p>
          <p className="mt-1 max-w-lg text-2xl font-bold tracking-[-0.03em]">
            Every quote, intent and fee your customers generate, routed to ARC.
          </p>
        </div>
      </div>

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
            <ul className="divide-y divide-mist-100">
              {recent.data.items.map((q) => (
                <li key={q.quoteId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <Amount catalog={catalog} chainId={q.originChainId} token={q.tokenIn} value={q.amountIn} />{" "}
                    <span className="text-ink-600">
                      from <ChainName catalog={catalog} chainId={q.originChainId} />
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-ink-600">{formatDate(q.createdAt)}</span>
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
