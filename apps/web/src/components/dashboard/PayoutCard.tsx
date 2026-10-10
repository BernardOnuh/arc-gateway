import { useState, type FormEvent } from "react";
import { Field } from "../forms";
import { describeError } from "../../lib/gateway";
import { useSetPayoutAddress } from "../../lib/queries";
import { buttonClass, Card, inputClass } from "./ui";

/** Where checkout payments land: a USDC address on ARC. */
export function PayoutCard({ payoutAddress }: { payoutAddress: string | null }) {
  const save = useSetPayoutAddress();
  const [value, setValue] = useState(payoutAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const address = value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setError("Enter a 0x address (42 characters).");
    try {
      await save.mutateAsync(address);
      setDone(true);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Payouts">
      <p className="text-sm text-ink-600">
        Checkout payments settle here in USDC on ARC, straight from your customers' wallets. The gateway never holds
        the funds. Use an address you control; changes apply to new payments.
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid max-w-xl gap-4">
        <Field label="Payout address (ARC)" htmlFor="payout-address">
          <input
            id="payout-address"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className={`font-mono ${inputClass}`}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-green-700">
            Payout address saved.
          </p>
        )}
        <div>
          <button type="submit" className={buttonClass} disabled={save.isPending}>
            {save.isPending ? "Saving…" : payoutAddress ? "Update address" : "Save address"}
          </button>
        </div>
      </form>
    </Card>
  );
}
