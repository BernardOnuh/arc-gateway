import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { GatewayError } from "@arc/gateway-sdk";
import { Logo } from "../components/Logo";
import { useAuth } from "../lib/auth";
import { usePartnerProfile } from "../lib/queries";

const nav = [
  { to: "/app", label: "Overview", end: true },
  { to: "/app/customers", label: "Customers" },
  { to: "/app/transactions", label: "Transactions" },
  { to: "/app/ledger", label: "Ledger" },
  { to: "/app/widget", label: "Widget" },
  { to: "/app/settings", label: "Settings" },
];

export function DashboardLayout() {
  const { logout } = useAuth();
  const profile = usePartnerProfile();

  // A key that stops working (revoked/rotated) signs the partner out.
  useEffect(() => {
    if (profile.error instanceof GatewayError && profile.error.statusCode === 401) logout();
  }, [profile.error, logout]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-slate-50 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <Logo to="/app" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm md:flex-col md:pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 ${
                  isActive ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 md:px-8">
          <span className="truncate text-sm text-slate-600">
            {profile.data ? (
              <>
                Signed in as <span className="font-medium text-slate-900">{profile.data.name}</span>
              </>
            ) : (
              " "
            )}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Log out
          </button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
