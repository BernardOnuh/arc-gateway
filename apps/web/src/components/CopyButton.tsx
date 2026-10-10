import { useEffect, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
  onCopied,
}: {
  text: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      onCopied?.();
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${className || "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed, select manually" : label}
    </button>
  );
}
