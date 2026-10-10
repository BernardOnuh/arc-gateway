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
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5">
          <Logo tone="light" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "font-medium text-white" : "text-ink-300 transition hover:text-white"
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/app/login" className="text-ink-300 transition hover:text-white">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-white px-3.5 py-1.5 font-medium text-ink-900 transition hover:bg-brand-50"
            >
              Get your API key
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-ink-950 text-ink-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo tone="light" />
            <p className="mt-3 max-w-sm text-sm">ARC Gateway: a cross-chain on-ramp to the ARC network for businesses.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link to="/account/login" className="transition hover:text-white">
              Customer sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
