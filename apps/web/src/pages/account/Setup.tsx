import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { useCustomerAuth } from "../../lib/customerAuth";
import { describeError } from "../../lib/gateway";

export function Setup() {
  const [params] = useSearchParams();
  // Read the one-time token once, then drop it from the address bar and history.
  const [token] = useState(() => params.get("token") ?? "");
  const navigate = useNavigate();
  useEffect(() => {
    if (params.get("token")) navigate("/account/setup", { replace: true });
  }, [params, navigate]);

  const { client, start } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold">Set up your account</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page needs the setup link from the business you use. Ask them for a new link, or{" "}
          <Link to="/account/login" className="font-medium text-brand-600 hover:underline">
            sign in
          </Link>{" "}
          if you already have a password.
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setPending(true);
    try {
      start(await client.setup({ token, email: email.trim(), password }));
      navigate("/account", { replace: true });
    } catch (err) {
      setError(describeError(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h1 className="text-lg font-semibold">Set up your account</h1>
        <p className="mt-1 text-sm text-slate-500">Choose the email and password you'll sign in with.</p>
      </div>
      <div>
        <label htmlFor="setup-email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input id="setup-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="setup-password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input id="setup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${inputClass}`} />
        <p className="mt-1 text-xs text-slate-500">At least 10 characters. A short sentence works well.</p>
      </div>
      <div>
        <label htmlFor="setup-confirm" className="block text-sm font-medium text-slate-700">
          Confirm password
        </label>
        <input id="setup-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`mt-1 ${inputClass}`} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`w-full ${buttonClass}`}>
        {pending ? "Saving…" : "Create account"}
      </button>
    </form>
  );
}
