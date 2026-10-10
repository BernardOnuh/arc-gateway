import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { GatewayError } from "@arc/gateway-sdk";
import { Logo } from "../components/Logo";
import { NewKeyDialog } from "../components/dashboard/NewKeyDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  IconBook,
  IconChart,
  IconHome,
  IconLogout,
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

  return (
    <div className="min-h-screen bg-mist-200 md:flex">
      <NewKeyDialog />
      <aside className="md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="px-6 py-6">
          <Logo to="/app" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 text-[15px] font-semibold md:flex-1 md:flex-col md:pt-6">
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
          className="mx-4 mb-5 hidden items-center gap-3 rounded-2xl bg-card-sheen p-4 text-xs text-ink-700 transition hover:brightness-105 md:flex"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
            <IconBook size={17} />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink-900">Developer docs</span>
            SDK, REST and errors
          </span>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:py-4 md:pr-4">
        <header className="flex items-center justify-between gap-4 px-4 py-3 md:px-2 md:pb-4 md:pt-2">
          <span className="flex min-w-0 items-center gap-3 truncate text-sm text-ink-600">
            {name ? (
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
            )}
          </span>
          <span className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-white"
          >
            <IconLogout size={16} />
            Log out
          </button>
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
