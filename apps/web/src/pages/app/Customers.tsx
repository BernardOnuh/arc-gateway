import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Customer, LedgerCustomer } from "@arc/gateway-sdk";
import { CopyButton } from "../../components/CopyButton";
import {
  buttonClass,
  Card,
  Empty,
  ErrorState,
  inputClass,
  Loading,
  PageTitle,
  Pagination,
  tokenTotalsText,
} from "../../components/dashboard/ui";
import { describeError } from "../../lib/gateway";
import { formatDate, shortId } from "../../lib/format";
import { useCreateCustomer, useCreateSetupLink, useCustomers, useLedger, usePartnerProfile } from "../../lib/queries";

const PAGE_SIZE = 25;

export function Customers() {
  const [offset, setOffset] = useState(0);
  const customers = useCustomers({ limit: PAGE_SIZE, offset });
  const ledger = useLedger();
  const revenue = useMemo(() => {
    const map = new Map<string, LedgerCustomer>();
    for (const row of ledger.data?.byCustomer ?? []) if (row.customerId) map.set(row.customerId, row);
    return map;
  }, [ledger.data]);

  return (
    <>
      <PageTitle
        title="Customers"
        intro="End customers you've registered. Attribute quotes to them with customerId. Send a setup link so they can manage their account; we don't email it for you yet."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card title={customers.data ? `${customers.data.total} customers` : "Customers"}>
          {customers.isPending ? (
            <Loading />
          ) : customers.error ? (
            <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />
          ) : customers.data.items.length === 0 ? (
            <Empty>No customers yet. Add your first one with the form.</Empty>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">External ID</th>
                      <th className="py-2 pr-4 font-medium">Receiving address</th>
                      <th className="py-2 pr-4 font-medium">Transactions</th>
                      <th className="py-2 pr-4 font-medium">Fees earned</th>
                      <th className="py-2 pr-4 font-medium">Account</th>
                      <th className="py-2 font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.data.items.map((c) => {
                      const r = revenue.get(c.customerId);
                      return (
                        <tr key={c.customerId}>
                          <td className="py-2 pr-4">
                            <Link
                              to={`/app/transactions?customerId=${c.customerId}`}
                              className="font-medium text-brand-600 hover:underline"
                              title="View this customer's transactions"
                            >
                              {c.externalId}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs" title={c.recipientAddress}>
                            {shortId(c.recipientAddress, 8, 6)}
                          </td>
                          <td className="py-2 pr-4">{r?.transactions ?? 0}</td>
                          <td className="py-2 pr-4">{r ? tokenTotalsText(r.byToken, "feeTotal") : "—"}</td>
                          <td className="py-2 pr-4">
                            <AccountCell customer={c} />
                          </td>
                          <td className="whitespace-nowrap py-2 text-slate-500">{formatDate(c.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination total={customers.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
            </>
          )}
        </Card>
        <div className="space-y-6">
          <AddCustomer onAdded={() => setOffset(0)} />
          <CustomerSignInLink />
        </div>
      </div>
    </>
  );
}

function CustomerSignInLink() {
  const profile = usePartnerProfile();
  if (!profile.data) return null;
  const url = `${window.location.origin}/account/login?partner=${profile.data.partnerId}`;
  return (
    <Card title="Customer sign-in page">
      <p className="text-sm text-slate-500">
        Customers who've set up their account sign in here to manage their password and payout wallet.
      </p>
      <code className="mt-3 block break-all rounded bg-slate-50 p-2 font-mono text-xs">{url}</code>
      <CopyButton text={url} label="Copy link" className="mt-2" />
    </Card>
  );
}

function AccountCell({ customer }: { customer: Customer }) {
  const create = useCreateSetupLink();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  async function makeLink() {
    try {
      const res = await create.mutateAsync(customer.customerId);
      setLink({ url: `${window.location.origin}/account/setup?token=${encodeURIComponent(res.token)}`, expiresAt: res.expiresAt });
    } catch {
      // shown below via create.error
    }
  }

  return (
    <div className="min-w-[10rem] text-xs">
      {customer.hasPassword ? (
        <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700" title={customer.email ?? ""}>
          Active
        </span>
      ) : (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Not set up</span>
      )}
      {customer.payoutWallet && <span className="ml-1 text-slate-500" title={customer.payoutWallet}>· wallet set</span>}
      <div className="mt-1">
        {link ? (
          <div className="space-y-1">
            <code data-testid="setup-link" className="block max-w-[16rem] break-all rounded bg-slate-50 p-1 font-mono">
              {link.url}
            </code>
            <div className="flex items-center gap-2">
              <CopyButton text={link.url} label="Copy link" />
              <span className="text-slate-500">expires {formatDate(link.expiresAt)}</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-brand-600 hover:underline disabled:opacity-60"
            disabled={create.isPending}
            onClick={makeLink}
          >
            {customer.hasPassword ? "Password reset link" : "Create setup link"}
          </button>
        )}
        {create.error && <p role="alert" className="text-red-600">{describeError(create.error)}</p>}
      </div>
    </div>
  );
}

function AddCustomer({ onAdded }: { onAdded: () => void }) {
  const create = useCreateCustomer();
  const [externalId, setExternalId] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const id = externalId.trim();
    const address = recipientAddress.trim();
    if (!id) return setError("Enter the customer's ID from your system.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setError("Enter a valid 0x address (42 characters).");
    try {
      const customer = await create.mutateAsync({ externalId: id, recipientAddress: address });
      setMessage(`Saved ${customer.externalId}. Customer ID: ${customer.customerId}`);
      setExternalId("");
      setRecipientAddress("");
      onAdded();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Add customer">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="external-id" className="block text-sm font-medium text-slate-700">
            External ID
          </label>
          <input
            id="external-id"
            maxLength={200}
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="user_42"
            className={`mt-1 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-slate-500">Their ID in your system. Re-adding the same ID returns the existing customer.</p>
        </div>
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-slate-700">
            Receiving address
          </label>
          <input
            id="recipient"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className={`mt-1 font-mono ${inputClass}`}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="break-all text-sm text-green-700">
            {message}
          </p>
        )}
        <button type="submit" disabled={create.isPending} className={`w-full ${buttonClass}`}>
          {create.isPending ? "Saving…" : "Add customer"}
        </button>
      </form>
    </Card>
  );
}
