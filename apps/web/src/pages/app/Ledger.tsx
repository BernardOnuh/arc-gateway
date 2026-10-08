import { Card, Empty, ErrorState, Loading, PageTitle, secondaryButtonClass, Stat, tokenTotalsText } from "../../components/dashboard/ui";
import type { Ledger as LedgerData } from "@arc/gateway-sdk";
import { formatBps, formatUnits } from "../../lib/format";
import { useLedger } from "../../lib/queries";

export function Ledger() {
  const ledger = useLedger();

  return (
    <>
      <PageTitle
        title="Ledger"
        intro="Revenue from every quote made with your key, per token and per customer."
        actions={
          ledger.data && (
            <button type="button" className={secondaryButtonClass} onClick={() => downloadCsv(ledger.data)}>
              Export CSV
            </button>
          )
        }
      />
      {ledger.isPending ? (
        <Loading />
      ) : ledger.error ? (
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Transactions" value={ledger.data.totals.transactions} />
            <Stat label="Fee rate" value={formatBps(ledger.data.totals.feeBps)} />
            <Stat label="Tokens" value={ledger.data.byToken.length} hint="Distinct tokens sent" />
          </div>

          <Card title="By token">
            {ledger.data.byToken.length === 0 ? (
              <Empty>No revenue yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">Token</th>
                      <th className="py-2 pr-4 font-medium">Chain</th>
                      <th className="py-2 pr-4 font-medium">Transactions</th>
                      <th className="py-2 pr-4 font-medium">Volume</th>
                      <th className="py-2 font-medium">Fees earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.data.byToken.map((t) => (
                      <tr key={`${t.chainId}:${t.address}`}>
                        <td className="py-2 pr-4 font-medium">{t.symbol}</td>
                        <td className="py-2 pr-4">{t.chainId}</td>
                        <td className="py-2 pr-4">{t.transactions}</td>
                        <td className="py-2 pr-4">{t.decimals === null ? t.amountInTotal : formatUnits(t.amountInTotal, t.decimals)}</td>
                        <td className="py-2">{t.decimals === null ? t.feeTotal : formatUnits(t.feeTotal, t.decimals)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="By customer">
            {ledger.data.byCustomer.length === 0 ? (
              <Empty>No transactions yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Transactions</th>
                      <th className="py-2 pr-4 font-medium">Volume</th>
                      <th className="py-2 font-medium">Fees earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.data.byCustomer.map((c) => (
                      <tr key={c.customerId ?? "unattributed"}>
                        <td className="py-2 pr-4">
                          {c.externalId ?? <span className="text-slate-500">Unattributed</span>}
                        </td>
                        <td className="py-2 pr-4">{c.transactions}</td>
                        <td className="py-2 pr-4">{tokenTotalsText(c.byToken, "amountInTotal")}</td>
                        <td className="py-2">{tokenTotalsText(c.byToken, "feeTotal")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  // Quote everything; neutralise spreadsheet formula injection from partner-supplied IDs.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** One row per customer × token, with both base units and human amounts. */
export function ledgerToCsv(ledger: LedgerData): string {
  const header = [
    "customer_id",
    "external_id",
    "recipient_address",
    "chain_id",
    "token",
    "token_address",
    "transactions",
    "volume",
    "fees",
    "volume_base_units",
    "fees_base_units",
  ];
  const rows = ledger.byCustomer.flatMap((c) =>
    c.byToken.map((t) => [
      c.customerId,
      c.externalId,
      c.recipientAddress,
      t.chainId,
      t.symbol,
      t.address,
      t.transactions,
      t.decimals === null ? "" : formatUnits(t.amountInTotal, t.decimals, t.decimals).replace(/,/g, ""),
      t.decimals === null ? "" : formatUnits(t.feeTotal, t.decimals, t.decimals).replace(/,/g, ""),
      t.amountInTotal,
      t.feeTotal,
    ])
  );
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function downloadCsv(ledger: LedgerData) {
  const blob = new Blob([ledgerToCsv(ledger)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `arc-gateway-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
