import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, glassCardClass } from "../../components/AuthShell";
import { buttonClass } from "../../components/dashboard/ui";
import { Field, MIN_PASSWORD, PasswordInput, PasswordStrength } from "../../components/forms";
import { describeError, publicClient } from "../../lib/gateway";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Read the one-time token once, then drop it from the address bar and history.
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (params.get("token")) navigate("/app/reset-password", { replace: true });
  }, [params, navigate]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");
    setPending(true);
    try {
      await publicClient.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Almost there.">
      <div className={glassCardClass}>
        <h1 className="text-[1.7rem]">Choose a new password</h1>
        {!token ? (
          <p className="mt-3 text-sm text-ink-700">
            This page needs the link from your reset email.{" "}
            <Link to="/app/forgot-password" className="font-medium text-brand-600 hover:underline">
              Request a new link
            </Link>
            .
          </p>
        ) : done ? (
          <div role="status" className="mt-3 text-sm text-ink-700">
            Your password is updated and other sessions were signed out.
            <Link to="/app/login" className={`mt-5 w-full ${buttonClass}`}>
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="New password" htmlFor="reset-password">
              <PasswordInput id="reset-password" autoComplete="new-password" value={password} onChange={setPassword} />
              <PasswordStrength password={password} />
            </Field>
            <Field label="Confirm password" htmlFor="reset-confirm">
              <PasswordInput id="reset-confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending} className={`w-full ${buttonClass}`}>
              {pending ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
