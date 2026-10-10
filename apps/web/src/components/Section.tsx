import type { ReactNode } from "react";
import { SkyBackdrop } from "./art";
import { Reveal } from "./motion";

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
      <Reveal>
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>}
        <h2 className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{intro}</p>}
      </Reveal>
      <Reveal delay={120} className="mt-12">
        {children}
      </Reveal>
    </section>
  );
}

/** Sky band that opens every inner marketing page. */
export function PageHeader({ title, intro, eyebrow }: { title: string; intro?: ReactNode; eyebrow?: string }) {
  return (
    <header className="relative overflow-hidden text-snow">
      <SkyBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 text-center sm:pb-28 sm:pt-44">
        {eyebrow && <span className="eyebrow animate-rise">{eyebrow}</span>}
        <h1 className="mx-auto mt-5 max-w-3xl animate-rise text-5xl leading-[1.02] [animation-delay:80ms] sm:text-7xl">
          {title}
        </h1>
        {intro && (
          <p className="mx-auto mt-6 max-w-2xl animate-rise text-lg leading-relaxed text-snow/90 [animation-delay:180ms]">
            {intro}
          </p>
        )}
      </div>
    </header>
  );
}

/** Closing call-to-action on a small patch of sky. */
export function CtaPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="relative overflow-hidden rounded-4xl px-6 py-14 text-snow sm:px-14">
        <SkyBackdrop />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="max-w-lg text-3xl sm:text-4xl">{title}</h2>
          <div className="flex flex-wrap gap-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
