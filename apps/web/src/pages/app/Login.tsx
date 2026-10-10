import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell, glassCardClass } from "../../components/AuthShell";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { LoginError, useAuth } from "../../lib/auth";
import { describeError } from "../../lib/gateway";

export function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === "signedIn") return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(value);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof LoginError ? err.message : describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Your gateway, one dashboard.">
        <form onSubmit={onSubmit} className={glassCardClass}>
          <h1 className="text-[1.7rem]">Sign in to your dashboard</h1>
          <p className="mt-1 text-sm text-ink-600">Use the API key you received at signup.</p>
          <label htmlFor="api-key" className="mt-5 block text-sm font-medium text-ink-700">
            API key
          </label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="gw_live_…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`mt-1.5 font-mono ${inputClass}`}
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className={`mt-6 w-full ${buttonClass}`}
          >
            {pending ? "Checking…" : "Sign in"}
          </button>
          <p className="mt-4 text-xs text-ink-600">
            Your key is swapped for a secure session cookie and isn't saved in this browser. Log out on shared computers.
          </p>
        </form>
        <p className="mt-6 text-center text-sm text-white/90">
          No key yet?{" "}
          <Link to="/signup" className="font-bold text-white underline-offset-4 hover:underline">
            Get your API key
          </Link>
        </p>
    </AuthShell>
  );
}
