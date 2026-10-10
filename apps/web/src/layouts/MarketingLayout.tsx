import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { IconClose, IconMenu } from "../components/art";
import { DOCS_URL } from "../lib/env";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

const nav = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/developers", label: "Developers" },
  { to: "/pricing", label: "Pricing" },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-bold text-snow" : "text-snow/85 transition hover:text-snow";

/** Every marketing page opens on the sky, so the header floats over it in white. */
export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Following a link closes the mobile menu.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={`absolute inset-x-0 top-0 z-30 border-b ${open ? "border-transparent" : "border-snow/20"} md:border-snow/20`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Logo tone="light" />
          <nav className="hidden items-center gap-x-7 text-[15px] font-medium tracking-wide md:flex">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            <a href={DOCS_URL} className="text-snow/85 transition hover:text-snow">
              Docs
            </a>
            <Link to="/app/login" className="text-snow/85 transition hover:text-snow">
              Sign in
            </Link>
            <ThemeToggle onSky />
            <Link to="/signup" className="btn-glass px-5 py-2 text-[15px]">
              Get your API key
            </Link>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle onSky />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid h-9 w-9 place-items-center rounded-full bg-snow/15 text-snow ring-1 ring-snow/30 backdrop-blur transition hover:bg-snow/25"
            >
              {open ? <IconClose size={18} /> : <IconMenu size={18} />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            className="mx-4 mb-4 flex flex-col gap-1 rounded-3xl bg-night/70 p-3 text-base font-medium ring-1 ring-snow/20 backdrop-blur-xl md:hidden"
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `rounded-2xl px-4 py-3 ${navClass({ isActive })}`}
              >
                {item.label}
              </NavLink>
            ))}
            <a href={DOCS_URL} className="rounded-2xl px-4 py-3 text-snow/85 transition hover:text-snow">
              Docs
            </a>
            <Link to="/app/login" className="rounded-2xl px-4 py-3 text-snow/85 transition hover:text-snow">
              Sign in
            </Link>
            <Link to="/signup" className="btn-glass mt-2">
              Get your API key
            </Link>
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-ink-900/5 bg-mist-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-ink-600">
              Stableflowr: a cross-chain on-ramp to the ARC network for businesses.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-700">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="transition hover:text-ink-900">
                {item.label}
              </Link>
            ))}
            <a href={DOCS_URL} className="transition hover:text-ink-900">
              Docs
            </a>
            <Link to="/account/login" className="transition hover:text-ink-900">
              Customer sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
