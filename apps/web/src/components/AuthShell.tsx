import type { ReactNode } from "react";
import { SkyBackdrop } from "./art";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** Full-screen sky with a frosted card in the middle (sign-in pages). */
export function AuthShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <SkyBackdrop />
      <div className="absolute right-4 top-4">
        <ThemeToggle onSky />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo tone="light" />
        </div>
        <p className="mb-6 text-center text-lg font-medium tracking-wide text-snow/90">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Frosted-glass form card for the sky. */
export const glassCardClass = "glass rounded-4xl bg-white/70 p-7 sm:p-9";
