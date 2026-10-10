import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Logo";

const nav = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/developers", label: "Developers" },
  { to: "/pricing", label: "Pricing" },
];

/** Every marketing page opens on the sky, so the header floats over it in white. */
export function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Logo tone="light" />
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[15px] font-medium tracking-wide">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "font-bold text-white" : "text-white/85 transition hover:text-white"
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/app/login" className="text-white/85 transition hover:text-white">
              Sign in
            </Link>
            <Link to="/signup" className="btn-glass px-5 py-2 text-[15px]">
              Get your API key
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-ink-900/5 bg-mist-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-ink-600">
              ARC Gateway: a cross-chain on-ramp to the ARC network for businesses.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-700">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="transition hover:text-ink-900">
                {item.label}
              </Link>
            ))}
            <Link to="/account/login" className="transition hover:text-ink-900">
              Customer sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
