import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GatewayError, type CustomerAccount } from "@arc/gateway-sdk";
import { buttonClass, Card, ErrorState, inputClass, Loading, secondaryButtonClass } from "../../components/dashboard/ui";
import { CUSTOMER_PARTNER_STORAGE, useCustomerAuth } from "../../lib/customerAuth";
import { writeStored } from "../../lib/storage";
import { describeError, publicClient } from "../../lib/gateway";

export function Account() {
  const { client, sessionToken, logout } = useCustomerAuth();
  const account = useQuery({ queryKey: ["customer", "me", sessionToken], queryFn: () => client.account() });

  // Remember the business so sign-in works after signing out.
  useEffect(() => {
    if (account.data) writeStored(CUSTOMER_PARTNER_STORAGE, account.data.partnerId);
  }, [account.data]);

  // Expired or revoked session: back to sign-in.
  useEffect(() => {
    if (account.error instanceof GatewayError && account.error.statusCode === 401) logout();
  }, [account.error, logout]);

  async function signOut() {
    try {
      await client.logout();
    } catch {
      // Signing out locally is what matters.
    }
    logout();
  }

  if (account.isPending) return <Loading />;
  if (account.error) return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;
  const a = account.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Your account</h1>
          <p className="text-sm text-slate-500">with {a.partnerName}</p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={signOut}>
          Sign out
        </button>
      </div>

      <Card title="Details">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd>{a.email}</dd>
          <dt className="text-slate-500">Receiving address</dt>
          <dd className="break-all font-mono text-xs">{a.recipientAddress}</dd>
        </dl>
      </Card>

      <PayoutWallet account={a} />
      <ChangePassword />
    </div>
  );
}

function PayoutWallet({ account }: { account: CustomerAccount }) {
  const { client, sessionToken } = useCustomerAuth();
  const queryClient = useQueryClient();
  const chains = useQuery({ queryKey: ["public", "chains"], queryFn: () => publicClient.chains(), staleTime: Infinity });
  const [address, setAddress] = useState(account.payoutWallet ?? "");
  const [chainId, setChainId] = useState<number | "">(account.payoutChainId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (p: { address: string; chainId: number }) => client.setPayoutWallet(p),
    onSuccess: (updated) => queryClient.setQueryData(["customer", "me", sessionToken], updated),
  });

  const options = (chains.data ?? []).filter((c) => !c.testnet);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (chainId === "") return setError("Choose a network.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) return setError("Enter a valid 0x address (42 characters).");
    try {
      await save.mutateAsync({ address: address.trim(), chainId });
      setSaved(true);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Payout wallet">
      <p className="text-sm text-slate-500">
        Where your share of fees will be sent. Payouts aren't live yet; saving a wallet now means you're ready when they
        are.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="payout-chain" className="block text-sm font-medium text-slate-700">
            Network
          </label>
          <select
            id="payout-chain"
            value={chainId}
            onChange={(e) => setChainId(e.target.value ? Number(e.target.value) : "")}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Choose…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payout-address" className="block text-sm font-medium text-slate-700">
            Wallet address
          </label>
          <input
            id="payout-address"
            spellCheck={false}
            placeholder="0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`mt-1 font-mono ${inputClass}`}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-green-700">
            Payout wallet saved.
          </p>
        )}
        <button type="submit" className={buttonClass} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save wallet"}
        </button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const { client, sessionToken } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => client.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: (updated) => queryClient.setQueryData(["customer", "me", sessionToken], updated),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 10) return setError("Use at least 10 characters for the new password.");
    try {
      await change.mutateAsync();
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
            Current password
          </label>
          <input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-green-700">
            Password changed. Other devices were signed out.
          </p>
        )}
        <button type="submit" className={buttonClass} disabled={change.isPending}>
          {change.isPending ? "Saving…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}
