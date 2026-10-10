import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { GatewayError } from "@arc/gateway-sdk";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { CUSTOMER_PARTNER_STORAGE, useCustomerAuth } from "../../lib/customerAuth";
import { describeError } from "../../lib/gateway";
import { readStored } from "../../lib/storage";

export function CustomerLogin() {
  const { sessionToken, client, start } = useCustomerAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/account";
  const partnerId = params.get("partner") ?? readStored(CUSTOMER_PARTNER_STORAGE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (sessionToken) return <Navigate to={from} replace />;

  if (!partnerId) {
    return (
      <div className="card p-7">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-ink-600">
          Open the sign-in link from the business you use. If you haven't set a password yet, ask them for a setup link.
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      start(await client.login({ partnerId: partnerId!, email: email.trim(), password }));
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof GatewayError && err.statusCode === 401
          ? "That email and password don't match. Forgot your password? Ask the business for a reset link."
          : describeError(err)
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 card p-7">
      <h1 className="text-2xl font-semibold">Sign in to your account</h1>
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-ink-700">
          Email
        </label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-ink-700">
          Password
        </label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${inputClass}`} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`w-full ${buttonClass}`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
