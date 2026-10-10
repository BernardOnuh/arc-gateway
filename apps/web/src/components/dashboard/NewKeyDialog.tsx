import { useEffect, useRef, useState } from "react";
import { CopyButton } from "../CopyButton";
import { IconKey } from "../art";
import { useAuth } from "../../lib/auth";
import { buttonClass } from "./ui";

/**
 * Shows the secret key from signup exactly once, inside the dashboard. It
 * can't be dismissed until the partner copies it or confirms they stored it.
 */
export function NewKeyDialog() {
  const { revealKey, setRevealKey } = useAuth();
  const [stored, setStored] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealKey) ref.current?.focus();
  }, [revealKey]);

  if (!revealKey) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm dark:bg-black/60">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-key-title"
        className="card w-full max-w-lg p-7 outline-none sm:p-8"
      >
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-900 text-white">
          <IconKey />
        </span>
        <h2 id="new-key-title" className="mt-5 text-2xl">
          Your secret key
        </h2>
        <p role="note" className="mt-2 text-sm leading-relaxed text-ink-600">
          This is the only time it's shown. We keep just a hash, so it can't be recovered. Store it in your secrets
          manager and use it only on your server. If you lose it, rotate it in Settings.
        </p>
        <div className="mt-5 rounded-2xl bg-night p-4">
          <code data-testid="api-key" className="block break-all font-mono text-sm leading-relaxed text-[#c8cef6]">
            {revealKey}
          </code>
          <div className="mt-3 flex justify-end">
            <CopyButton
              text={revealKey}
              label="Copy key"
              onCopied={() => setStored(true)}
              className="border-snow/15 bg-snow/10 text-snow hover:bg-snow/20"
            />
          </div>
        </div>
        <label className="mt-5 flex items-start gap-2.5 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={stored}
            onChange={(e) => setStored(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--ink-900))]"
          />
          I've stored my key somewhere safe.
        </label>
        <button
          type="button"
          disabled={!stored}
          onClick={() => setRevealKey(null)}
          className={`mt-6 w-full ${buttonClass} py-3`}
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}
