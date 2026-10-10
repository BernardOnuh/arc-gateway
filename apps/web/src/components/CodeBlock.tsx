import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 text-slate-100 shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <figcaption className="font-mono text-xs text-ink-300">{title ?? " "}</figcaption>
        </div>
        <CopyButton text={code} className="border-ink-600 bg-ink-800 text-slate-200 hover:bg-ink-700" />
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </figure>
  );
}
