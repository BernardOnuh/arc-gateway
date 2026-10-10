import type { ReactNode } from "react";
import { GlowBackdrop } from "./art";

export function Section({
  title,
  intro,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  intro?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-16 sm:py-20 ${className}`}>
      {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold sm:text-[2.1rem]">{title}</h2>
      {intro && <p className="mt-3 max-w-2xl text-lg text-slate-600">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

/** Dark band with glow that opens every inner marketing page. */
export function PageHeader({ title, intro, eyebrow }: { title: string; intro?: ReactNode; eyebrow?: string }) {
  return (
    <header className="relative overflow-hidden bg-ink-950 text-white">
      <GlowBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pb-20 sm:pt-20">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-ink-300">{intro}</p>}
      </div>
    </header>
  );
}

/** Closing call-to-action panel. */
export function CtaPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 text-white sm:px-12">
        <GlowBackdrop />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="max-w-lg text-3xl font-semibold">{title}</h2>
          <div className="flex flex-wrap gap-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
