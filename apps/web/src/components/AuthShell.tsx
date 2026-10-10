import type { ReactNode } from "react";
import { AuthArt, GlowBackdrop, IconCheck } from "./art";
import { Logo } from "./Logo";

/** Dark illustrated panel used beside sign-in and signup forms. */
export function AuthPanel({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <GlowBackdrop />
      <div className="relative">
        <Logo tone="light" />
      </div>
      <AuthArt className="relative mx-auto w-full max-w-sm" />
      <div className="relative">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <ul className="mt-5 space-y-2.5 text-sm text-ink-300">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <IconCheck size={16} className="text-accent-400" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Full-screen split: illustrated panel left, form right. */
export function AuthShell({ children, title, points }: { children: ReactNode; title: string; points: string[] }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <AuthPanel title={title} points={points} />
      <div className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const fieldLabelClass = "block text-sm font-medium text-slate-700";
