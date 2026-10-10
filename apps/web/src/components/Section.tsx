import type { ReactNode } from "react";
import { SkyBackdrop } from "./art";

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
    <section className={`mx-auto max-w-6xl px-4 py-16 sm:py-24 ${className}`}>
      {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
      <h2 className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed tracking-wide text-ink-600">{intro}</p>}
      <div className="mt-12">{children}</div>
    </section>
  );
}

/** Sky band that opens every inner marketing page. */
export function PageHeader({ title, intro, eyebrow }: { title: string; intro?: ReactNode; eyebrow?: string }) {
  return (
    <header className="relative overflow-hidden text-white">
      <SkyBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 text-center sm:pb-28 sm:pt-44">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mx-auto mt-5 max-w-3xl text-5xl leading-[1.02] sm:text-7xl">{title}</h1>
        {intro && <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed tracking-wide text-white/90">{intro}</p>}
      </div>
    </header>
  );
}

/** Closing call-to-action on a small patch of sky. */
export function CtaPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="relative overflow-hidden rounded-4xl px-6 py-14 text-white sm:px-14">
        <SkyBackdrop />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="max-w-lg text-3xl sm:text-4xl">{title}</h2>
          <div className="flex flex-wrap gap-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
