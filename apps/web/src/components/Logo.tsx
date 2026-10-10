import { Link } from "react-router-dom";
import { LogoMark } from "./art";

export function Logo({ to = "/", tone = "dark" }: { to?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 text-lg font-extrabold uppercase tracking-[-0.02em] ${
        tone === "light" ? "text-white" : "text-ink-900"
      }`}
    >
      <LogoMark tone={tone} />
      ARC Gateway
    </Link>
  );
}
