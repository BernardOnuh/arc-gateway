import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <figcaption className="text-xs text-slate-400">{title ?? " "}</figcaption>
        <CopyButton text={code} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" />
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </figure>
  );
}
