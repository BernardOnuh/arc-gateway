import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GatewayError, type RegisterPartnerResult } from "@arc/gateway-sdk";
import { CopyButton } from "../../components/CopyButton";
import { useAuth } from "../../lib/auth";
import { describeError, publicClient } from "../../lib/gateway";
import { formatBps } from "../../lib/format";

function signupError(err: unknown): string {
  if (err instanceof GatewayError && err.statusCode === 409) {
    return "An account with this email already exists. Sign in with the key you received, or use a different email.";
  }
  return describeError(err);
}

export function Signup() {
  const [result, setResult] = useState<RegisterPartnerResult | null>(null);
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      {result ? <KeyReveal result={result} /> : <SignupForm onCreated={setResult} />}
    </div>
  );
}

function SignupForm({ onCreated }: { onCreated: (r: RegisterPartnerResult) => void }) {
  const [partnerName, setPartnerName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = partnerName.trim();
    if (!name) {
      setError("Enter your business name.");
      return;
    }
    setPending(true);
    try {
      const trimmedEmail = email.trim();
      onCreated(await publicClient.registerPartner({ partnerName: name, ...(trimmedEmail ? { email: trimmedEmail } : {}) }));
    } catch (err) {
      setError(signupError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Get your API key</h1>
      <p className="mt-2 text-slate-600">Create a partner account. Your key is issued instantly.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-lg border border-slate-200 p-6">
        <div>
          <label htmlFor="partner-name" className="block text-sm font-medium text-slate-700">
            Business name
          </label>
          <input
            id="partner-name"
            required
            maxLength={120}
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Contact email <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have a key?{" "}
        <Link to="/app/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

function KeyReveal({ result }: { result: RegisterPartnerResult }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [stored, setStored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function continueToDashboard() {
    setError(null);
    setPending(true);
    try {
      // Hand the key to the dashboard in memory; it never goes in a URL.
      await login(result.apiKey);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(describeError(err));
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Your API key</h1>
      <div role="note" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Store this key now. It is shown only once.</p>
        <p className="mt-1">
          We keep only a hash, so we can't show it again or recover it. Put it in your password manager or secrets
          store before you continue.
        </p>
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">Secret key</span>
          <CopyButton text={result.apiKey} label="Copy key" onCopied={() => setStored(true)} />
        </div>
        <code data-testid="api-key" className="mt-2 block break-all rounded bg-slate-50 p-3 font-mono text-sm">
          {result.apiKey}
        </code>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Fee</dt>
          <dd>{formatBps(result.feeBps)} per transaction</dd>
          <dt className="text-slate-500">Rate limit</dt>
          <dd>{result.rateLimitPerMin} requests/min</dd>
        </dl>
      </div>
      <label className="mt-6 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={stored}
          onChange={(e) => setStored(e.target.checked)}
          className="mt-0.5"
        />
        I've stored my key somewhere safe.
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={continueToDashboard}
        disabled={!stored || pending}
        className="mt-5 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Opening dashboard…" : "Continue to dashboard"}
      </button>
    </>
  );
}
