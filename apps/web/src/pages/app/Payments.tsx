import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Payment, PaymentStatus } from "@arc/gateway-sdk";
import { CopyButton } from "../../components/CopyButton";
import { Field } from "../../components/forms";
import {
  buttonClass,
  Card,
  Empty,
  ErrorState,
  inputClass,
  Loading,
  PageTitle,
  Pagination,
} from "../../components/dashboard/ui";
import { describeError } from "../../lib/gateway";
import { formatDate } from "../../lib/format";
import { useApiKeys, useCreatePayment, usePartnerProfile, usePayments } from "../../lib/queries";

const PAGE = 20;

export const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tone: Record<PaymentStatus, string> = {
  open: "bg-mist-100 text-ink-700 ring-mist-300",
  processing: "bg-brand-50 text-brand-700 ring-brand-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partially_paid: "bg-amber-50 text-amber-800 ring-amber-200",
  expired: "bg-mist-100 text-ink-400 ring-mist-300",
  canceled: "bg-mist-100 text-ink-400 ring-mist-300",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/** Link to the hosted checkout, using a publishable key that's allowed on this site. */
function useCheckoutLink() {
  const keys = useApiKeys();
  const origin = window.location.origin;
  const pk = keys.data?.items.find(
    (k) => k.kind === "publishable" && k.active && k.publishableKey && (k.allowedOrigins ?? []).includes(origin)
  )?.publishableKey;
  return (paymentId: string) => (pk ? `${origin}/checkout/${paymentId}?key=${encodeURIComponent(pk)}` : null);
}

function CreatePayment({ disabled }: { disabled: boolean }) {
  const create = useCreatePayment();
  const link = useCheckoutLink();
  const [amount, setAmount] = useState("10.00");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Payment | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setCreated(
        await create.mutateAsync({
          amount: amount.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        })
      );
    } catch (err) {
      setError(describeError(err));
    }
  }

  const url = created ? link(created.paymentId) : null;
  return (
    <Card title="New payment">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
        <Field label="Amount (USD)" htmlFor="pay-amount">
          <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Description" htmlFor="pay-desc" optional>
          <input id="pay-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Pro plan, 1 month" className={inputClass} />
        </Field>
        <Field label="Reference" htmlFor="pay-ref" optional>
          <input id="pay-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="order_1042" className={inputClass} />
        </Field>
        <button type="submit" className={buttonClass} disabled={disabled || create.isPending}>
          {create.isPending ? "Creating…" : "Create"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {created && (
        <div role="status" className="mt-5 rounded-2xl bg-mist-100 p-4 text-sm">
          <p className="font-medium text-ink-900">
            Payment for {usd(created.amountCents)} created. Send your customer to the checkout:
          </p>
          {url ? (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-700">{url}</code>
              <CopyButton text={url} label="Copy link" />
              <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
                Open
              </a>
            </div>
          ) : (
            <p className="mt-1 text-ink-600">
              To get a checkout link, create a publishable key for {window.location.origin} in{" "}
              <Link to="/app/settings" className="font-medium text-brand-600 hover:underline">
                Settings
              </Link>
              . Or embed the checkout with payment id <span className="font-mono">{created.paymentId}</span>.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function Payments() {
  const profile = usePartnerProfile();
  const [offset, setOffset] = useState(0);
  const payments = usePayments({ limit: PAGE, offset });
  const link = useCheckoutLink();
  const noPayout = profile.data && !profile.data.payoutAddress;

  return (
    <>
      <PageTitle
        title="Payments"
        intro="Charge a price in dollars; customers pay with any mix of tokens from their wallet and you receive USDC."
      />
      {noPayout && (
        <div role="note" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Set a payout address in{" "}
          <Link to="/app/settings" className="font-semibold underline">
            Settings
          </Link>{" "}
          before creating payments. That's where your customers' payments land.
        </div>
      )}
      <div className="space-y-6">
        <CreatePayment disabled={Boolean(noPayout)} />
        <Card title="All payments">
          {payments.isPending ? (
            <Loading />
          ) : payments.error ? (
            <ErrorState error={payments.error} onRetry={() => void payments.refetch()} />
          ) : payments.data.items.length === 0 ? (
            <Empty>No payments yet. Create one above, or from your server with POST /v1/payments.</Empty>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mist-200 text-left text-ink-600">
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">For</th>
                      <th className="py-2 pr-4 font-medium">Paid with</th>
                      <th className="py-2 pr-4 font-medium">Created</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mist-100">
                    {payments.data.items.map((p) => {
                      const url = link(p.paymentId);
                      const tokens = [...new Set(p.legs.filter((l) => l.status === "EXECUTED_ON_ARC").map((l) => l.token.symbol))];
                      return (
                        <tr key={p.paymentId}>
                          <td className="py-3 pr-4 font-medium tabular-nums">
                            {usd(p.amountCents)}
                            {p.status === "partially_paid" && (
                              <span className="block text-xs font-normal text-ink-600">{usd(p.paidCents)} received</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <PaymentStatusBadge status={p.status} />
                          </td>
                          <td className="py-3 pr-4">
                            {p.description ?? <span className="text-ink-400">—</span>}
                            {p.reference && <span className="block font-mono text-xs text-ink-600">{p.reference}</span>}
                          </td>
                          <td className="py-3 pr-4 text-ink-700">{tokens.length ? tokens.join(" + ") : <span className="text-ink-400">—</span>}</td>
                          <td className="py-3 pr-4 text-ink-600">{formatDate(p.createdAt)}</td>
                          <td className="py-3 text-right">
                            {url && (p.status === "open" || p.status === "partially_paid") && (
                              <a href={url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                                Checkout
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination total={payments.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
