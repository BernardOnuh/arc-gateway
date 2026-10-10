import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell, glassCardClass } from "../../components/AuthShell";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { Field, PasswordInput, Segmented } from "../../components/forms";
import { LoginError, useAuth } from "../../lib/auth";
import { describeError } from "../../lib/gateway";

type Method = "password" | "key";

export function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === "signedIn") return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(method === "key" ? { apiKey } : { email, password });
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
        <p className="mt-1 text-sm text-ink-600">Welcome back. Use your business email, or a secret key.</p>
        <div className="mt-6">
          <Segmented
            label="Sign-in method"
            value={method}
            onChange={(m) => {
              setMethod(m);
              setError(null);
            }}
            options={[
              { value: "password", label: "Email" },
              { value: "key", label: "API key" },
            ]}
          />
        </div>

        <div className="mt-6 space-y-4">
          {method === "password" ? (
            <>
              <Field label="Email" htmlFor="login-email">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Password"
                htmlFor="login-password"
                hint={
                  <Link to="/app/forgot-password" className="font-medium text-brand-600 hover:underline">
                    Forgot password?
                  </Link>
                }
              >
                <PasswordInput id="login-password" autoComplete="current-password" value={password} onChange={setPassword} />
              </Field>
            </>
          ) : (
            <Field
              label="API key"
              htmlFor="api-key"
              hint="Your key is swapped for a secure session cookie and isn't saved in this browser."
            >
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="gw_live_…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={`font-mono ${inputClass}`}
              />
            </Field>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`mt-6 w-full ${buttonClass}`}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-ink-600">Log out on shared computers.</p>
      </form>
      <p className="mt-6 text-center text-sm text-snow/90">
        New to Stableflowr?{" "}
        <Link to="/signup" className="font-semibold text-snow underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
