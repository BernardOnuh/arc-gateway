import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { GatewayError } from "@arc/gateway-sdk";
import { Logo } from "../components/Logo";
import {
  IconBook,
  IconChart,
  IconHome,
  IconLogout,
  IconSettings,
  IconSwap,
  IconUsers,
  IconWidget,
} from "../components/art";
import { useAuth } from "../lib/auth";
import { usePartnerProfile } from "../lib/queries";

const nav: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/app", label: "Overview", icon: <IconHome size={18} />, end: true },
  { to: "/app/customers", label: "Customers", icon: <IconUsers size={18} /> },
  { to: "/app/transactions", label: "Transactions", icon: <IconSwap size={18} /> },
  { to: "/app/ledger", label: "Ledger", icon: <IconChart size={18} /> },
  { to: "/app/widget", label: "Widget", icon: <IconWidget size={18} /> },
  { to: "/app/settings", label: "Settings", icon: <IconSettings size={18} /> },
];

export function DashboardLayout() {
  const { logout } = useAuth();
  const profile = usePartnerProfile();

  // A key that stops working (revoked/rotated) signs the partner out.
  useEffect(() => {
    if (profile.error instanceof GatewayError && profile.error.statusCode === 401) logout();
  }, [profile.error, logout]);

  const name = profile.data?.name;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <aside className="relative bg-ink-950 text-ink-300 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div aria-hidden className="pointer-events-none absolute -left-20 top-0 h-60 w-60 rounded-full bg-brand-600/25 blur-[90px]" />
        <div className="relative px-5 py-5">
          <Logo to="/app" tone="light" />
        </div>
        <nav className="relative flex gap-1 overflow-x-auto px-3 pb-3 text-sm md:flex-1 md:flex-col md:pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 transition ${
                  isActive
                    ? "bg-white/10 font-medium text-white shadow-[inset_2px_0_0_#22d3ee]"
                    : "hover:bg-white/5 hover:text-white"
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
          className="relative mx-3 mb-4 hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs transition hover:bg-white/10 md:flex"
        >
          <IconBook size={18} className="text-accent-300" />
          <span>
            <span className="block font-medium text-white">Developer docs</span>
            SDK, REST and errors
          </span>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
          <span className="flex min-w-0 items-center gap-3 truncate text-sm text-slate-600">
            {name ? (
              <>
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient font-display text-sm font-semibold text-white"
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">
                  Signed in as <span className="font-medium text-slate-900">{name}</span>
                </span>
              </>
            ) : (
              " "
            )}
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <IconLogout size={16} />
            Log out
          </button>
        </header>
        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
