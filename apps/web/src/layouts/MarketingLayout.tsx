import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Logo";

const nav = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/developers", label: "Developers" },
  { to: "/pricing", label: "Pricing" },
];

export function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Logo />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/app/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Get your API key
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          ARC Gateway: a cross-chain on-ramp to the ARC network for businesses.
        </div>
      </footer>
    </div>
  );
}
