import type { ReactNode } from "react";

export function Section({
  title,
  intro,
  children,
  className = "",
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-14 ${className}`}>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-2 max-w-2xl text-slate-600">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function PageHeader({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl text-lg text-slate-600">{intro}</p>}
    </header>
  );
}
