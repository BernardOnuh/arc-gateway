import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl bg-night text-snow/90 shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-snow/10 px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-snow/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-snow/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-snow/25" />
          </span>
          <figcaption className="font-mono text-xs text-[#b4b8d4]">{title ?? " "}</figcaption>
        </div>
        <CopyButton text={code} className="border-snow/15 bg-snow/10 text-snow hover:bg-snow/20" />
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed sm:p-5 sm:text-[13px]">
        <code className="font-mono">{code}</code>
      </pre>
    </figure>
  );
}
