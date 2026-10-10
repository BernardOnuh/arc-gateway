import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GatewayError } from "@arc/gateway-sdk";
import { glassCardClass } from "../../components/AuthShell";
import { IconCheck, IconKey, IconShield, SkyBackdrop } from "../../components/art";
import { buttonClass, inputClass } from "../../components/dashboard/ui";
import { Field, MIN_PASSWORD, PasswordInput, PasswordStrength } from "../../components/forms";
import { useAuth } from "../../lib/auth";
import { describeError, publicClient } from "../../lib/gateway";
import { DEFAULT_FEE_BPS, formatBps } from "../../lib/format";

function signupError(err: unknown): string {
  if (err instanceof GatewayError && err.statusCode === 409) {
    return "An account with this email already exists. Sign in instead, or use a different email.";
  }
  return describeError(err);
}

const perks = [
  { icon: <IconKey size={16} />, text: "Secret key shown once, in your dashboard" },
  { icon: <IconShield size={16} />, text: "Passwords stored as salted scrypt hashes" },
  { icon: <IconCheck size={16} />, text: `${formatBps(DEFAULT_FEE_BPS)} per transaction · no monthly minimum` },
];

/**
 * Self-serve signup. Creates the partner with email + password, signs in,
 * and hands the one-time secret key to the dashboard (in memory, never the
 * URL), which shows it until the partner confirms they stored it.
 */
export function Signup() {
  const { login, setRevealKey } = useAuth();
  const navigate = useNavigate();
  // Prefilled from the home page's business-name field (router state, never the URL).
  const initialName = (useLocation().state as { partnerName?: string } | null)?.partnerName ?? "";
  const [partnerName, setPartnerName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = partnerName.trim();
    const mail = email.trim();
    if (!name) return setError("Enter your business name.");
    if (!mail) return setError("Enter your work email.");
    if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");

    setPending(true);
    try {
      const result = await publicClient.registerPartner({ partnerName: name, email: mail, password });
      await login({ email: mail, password });
      setRevealKey(result.apiKey);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(signupError(err));
      setPending(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <SkyBackdrop fade />
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 pb-24 pt-32 sm:pt-40 lg:grid-cols-[1fr_1.05fr]">
        <div className="text-snow">
          <span className="eyebrow">Get started</span>
          <p className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.025em] sm:text-5xl">
            Live in minutes, not weeks.
          </p>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-snow/85">
            Create your partner account, get a secret key, and start quoting cross-chain swaps to ARC today.
          </p>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[15px] text-snow/90">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-snow/15 ring-1 ring-snow/25">{p.icon}</span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={onSubmit} noValidate className={glassCardClass}>
          <h1 className="text-[1.9rem]">Get your API key</h1>
          <p className="mt-1 text-sm text-ink-600">Create a partner account. It takes under a minute.</p>

          <div className="mt-7 space-y-4">
            <Field label="Business name" htmlFor="partner-name">
              <input
                id="partner-name"
                required
                maxLength={120}
                autoComplete="organization"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Work email" htmlFor="email" hint="You'll sign in with this.">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <PasswordInput id="password" autoComplete="new-password" required value={password} onChange={setPassword} />
              <PasswordStrength password={password} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password">
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={setConfirm}
              />
            </Field>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={`mt-6 w-full ${buttonClass} py-3`}>
            {pending ? "Creating your account…" : "Create account"}
          </button>
          <p className="mt-4 text-center text-sm text-ink-600">
            Already have an account?{" "}
            <Link to="/app/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
