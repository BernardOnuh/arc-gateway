import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { LoginError, useAuth } from "../../lib/auth";
import { describeError } from "../../lib/gateway";

export function Login() {
  const { apiKey, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (apiKey) return <Navigate to={from} replace />;

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Sign in to your dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Use the API key you received at signup.</p>
          <label htmlFor="api-key" className="mt-5 block text-sm font-medium text-slate-700">
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
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Checking…" : "Sign in"}
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Your key is stored in this browser only. Log out on shared computers.
          </p>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          No key yet?{" "}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Get your API key
          </Link>
        </p>
      </div>
    </div>
  );
}
