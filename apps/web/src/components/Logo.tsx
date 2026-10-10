import { Link } from "react-router-dom";
import { LogoMark } from "./art";

export function Logo({ to = "/", tone = "dark" }: { to?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight ${
        tone === "light" ? "text-white" : "text-slate-900"
      }`}
    >
      <LogoMark />
      ARC Gateway
    </Link>
  );
}
