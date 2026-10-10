import { useState, type FormEvent } from "react";
import { Field, MIN_PASSWORD, PasswordInput, PasswordStrength } from "../forms";
import { describeError } from "../../lib/gateway";
import { useSetPassword } from "../../lib/queries";
import { buttonClass, Card } from "./ui";

/** Set (key-only partners) or change the dashboard password. */
export function PasswordCard({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const save = useSetPassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    try {
      await save.mutateAsync({ ...(hasPassword ? { currentPassword: current } : {}), newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (!email) {
    return (
      <Card title="Dashboard password">
        <p className="text-sm text-ink-600">This business has no email on file, so it signs in with its API key.</p>
      </Card>
    );
  }

  return (
    <Card title="Dashboard password">
      <p className="text-sm text-ink-600">
        {hasPassword ? (
          <>
            You sign in as <span className="font-medium text-ink-900">{email}</span>.
          </>
        ) : (
          <>
            Set a password to sign in with <span className="font-medium text-ink-900">{email}</span> instead of pasting
            your API key.
          </>
        )}
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid max-w-md gap-4">
        {hasPassword && (
          <Field label="Current password" htmlFor="current-password">
            <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={setCurrent} />
          </Field>
        )}
        <Field label={hasPassword ? "New password" : "Password"} htmlFor="new-password">
          <PasswordInput id="new-password" autoComplete="new-password" value={next} onChange={setNext} />
          <PasswordStrength password={next} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm-new-password">
          <PasswordInput id="confirm-new-password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-green-700">
            Password saved.
          </p>
        )}
        <div>
          <button type="submit" className={buttonClass} disabled={save.isPending}>
            {save.isPending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </button>
        </div>
      </form>
    </Card>
  );
}
