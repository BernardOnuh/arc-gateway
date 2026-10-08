import { Link } from "react-router-dom";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white"
      >
        A
      </span>
      ARC Gateway
    </Link>
  );
}
