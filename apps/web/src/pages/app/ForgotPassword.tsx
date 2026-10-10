import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell, glassCardClass } from "../../components/AuthShell";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { Field } from "../../components/forms";
import { describeError, publicClient } from "../../lib/gateway";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Enter your email.");
    setPending(true);
    try {
      await publicClient.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Locked out? It happens.">
      <div className={glassCardClass}>
        <h1 className="text-[1.7rem]">Reset your password</h1>
        {sent ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-ink-700">
            If <span className="font-medium">{email.trim()}</span> has an account, a reset link is on its way. It works once
            and expires in an hour. Check your spam folder if it doesn't arrive.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <p className="text-sm text-ink-600">Enter the email you sign in with and we'll send you a link.</p>
            <Field label="Email" htmlFor="forgot-email">
              <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending} className={`w-full ${buttonClass}`}>
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-snow/90">
        <Link to="/app/login" className="font-semibold text-snow underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
