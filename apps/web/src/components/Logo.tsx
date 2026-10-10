import { Link } from "react-router-dom";
import { LogoMark } from "./art";

export function Logo({ to = "/", tone = "dark" }: { to?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.02em] ${
        tone === "light" ? "text-snow" : "text-ink-900"
      }`}
    >
      <LogoMark tone={tone} />
      Stableflowr
    </Link>
  );
}
