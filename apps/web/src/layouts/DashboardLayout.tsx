import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { GatewayError } from "stableflow-sdk";
import { Logo } from "../components/Logo";
import { NewKeyDialog } from "../components/dashboard/NewKeyDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  IconBook,
  IconChart,
  IconClose,
  IconHome,
  IconLogout,
  IconMenu,
  IconSettings,
  IconSwap,
  IconUsers,
  IconWallet,
  IconWidget,
} from "../components/art";
import { useAuth } from "../lib/auth";
import { usePartnerProfile } from "../lib/queries";

const nav: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/app", label: "Overview", icon: <IconHome size={19} />, end: true },
  { to: "/app/payments", label: "Payments", icon: <IconWallet size={19} /> },
  { to: "/app/customers", label: "Customers", icon: <IconUsers size={19} /> },
  { to: "/app/transactions", label: "Transactions", icon: <IconSwap size={19} /> },
  { to: "/app/ledger", label: "Ledger", icon: <IconChart size={19} /> },
  { to: "/app/widget", label: "Checkout", icon: <IconWidget size={19} /> },
  { to: "/app/settings", label: "Settings", icon: <IconSettings size={19} /> },
];

/** Lavender shell with the page content in one big white panel. */
export function DashboardLayout() {
  const { logout } = useAuth();
  const profile = usePartnerProfile();

  // A key that stops working (revoked/rotated) signs the partner out.
  useEffect(() => {
    if (profile.error instanceof GatewayError && profile.error.statusCode === 401) logout();
  }, [profile.error, logout]);

  const name = profile.data?.name;
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Following a link closes the mobile menu.
  useEffect(() => setOpen(false), [pathname]);
  // While the sidebar is open on a phone, Escape closes it and the page behind stays put.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const signedIn = name ? (
    <>
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate">
        Signed in as <span className="font-bold text-ink-900">{name}</span>
      </span>
    </>
  ) : (
    " "
  );
  const logoutButton = (
    <button
      type="button"
      onClick={logout}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-white"
    >
      <IconLogout size={16} />
      Log out
    </button>
  );

  return (
    <div className="min-h-screen bg-mist-200 md:flex">
      <NewKeyDialog />
      {/* Phones: a slim top bar; the sidebar slides in from the left. */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-mist-200 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-ink-900 transition hover:bg-white"
        >
          <IconMenu size={18} />
        </button>
        <Logo to="/app" />
        <ThemeToggle />
      </div>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-mist-200 transition-transform duration-300 md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:shrink-0 md:translate-x-0 md:shadow-none ${
          open ? "translate-x-0 shadow-float" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-6">
          <Logo to="/app" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-ink-900 transition hover:bg-white md:hidden"
          >
            <IconClose size={18} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4 pb-3 text-[15px] font-semibold md:pt-6">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3.5 whitespace-nowrap rounded-2xl px-4 py-3 transition ${
                  isActive ? "bg-white text-ink-900 shadow-soft" : "text-ink-700 hover:bg-white/60"
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/developers"
          className="mx-4 mb-5 flex items-center gap-3 rounded-2xl bg-card-sheen p-4 text-xs text-ink-700 transition hover:brightness-105"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <IconBook size={17} />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink-900">Developer docs</span>
            SDK, REST and errors
          </span>
        </Link>
        {/* Only while open, so the desktop header stays the one account control on the page. */}
        {open && (
          <div className="mx-4 mb-5 flex flex-col gap-3 border-t border-ink-900/10 pt-4 text-sm text-ink-600 md:hidden">
            <span className="flex min-w-0 items-center gap-3">{signedIn}</span>
            {logoutButton}
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:py-4 md:pr-4">
        <header className="hidden items-center justify-between gap-4 px-2 pb-4 pt-2 md:flex">
          <span className="flex min-w-0 items-center gap-3 truncate text-sm text-ink-600">{signedIn}</span>
          <span className="flex items-center gap-2">
            <ThemeToggle />
            {logoutButton}
          </span>
        </header>
        <main className="flex-1 bg-white px-4 py-8 md:rounded-[32px] md:px-10 md:py-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
