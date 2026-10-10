import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { inputClass } from "./dashboard/ui";

/** Label + input + optional hint, consistent spacing everywhere. */
export function Field({
  label,
  hint,
  optional,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label} {optional && <span className="font-normal text-ink-400">(optional)</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-ink-600">{hint}</p>}
    </div>
  );
}

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

/** Password input with a show/hide toggle. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "new-password" | "current-password";
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "id">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-11`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-controls={id}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-400 transition hover:text-ink-900"
      >
        <EyeIcon off={shown} />
      </button>
    </div>
  );
}

export const MIN_PASSWORD = 10;

/** 0–4: length, mixed case, digits, symbols. Guidance only; the server enforces the minimum. */
export function passwordScore(pw: string): number {
  if (pw.length < MIN_PASSWORD) return pw.length ? 1 : 0;
  let s = 1;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const strength = ["", "Too short", "Okay", "Good", "Strong"];
const barTone = ["bg-mist-300", "bg-red-400", "bg-amber-400", "bg-brand-500", "bg-emerald-500"];

export function PasswordStrength({ password }: { password: string }) {
  const id = useId();
  const score = passwordScore(password);
  return (
    <div aria-live="polite" id={id} className="mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? barTone[score] : "bg-mist-300"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-600">
        {password ? `${strength[score]} · ` : ""}At least {MIN_PASSWORD} characters. A short sentence works well.
      </p>
    </div>
  );
}

/** Two-option switch (e.g. "Email" / "API key"). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-1 rounded-full bg-mist-200/80 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-2 font-medium transition ${
            value === o.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
