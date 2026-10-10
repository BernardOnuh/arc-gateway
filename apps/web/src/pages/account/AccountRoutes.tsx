import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SkyBackdrop } from "../../components/art";
import { Logo } from "../../components/Logo";
import { CustomerAuthProvider, useCustomerAuth } from "../../lib/customerAuth";
import { NotFound } from "../NotFound";
import { Account } from "./Account";
import { CustomerLogin } from "./CustomerLogin";
import { Setup } from "./Setup";

function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-mist-100">
      <div className="absolute inset-x-0 top-0 h-80 overflow-hidden">
        <SkyBackdrop />
      </div>
      <div className="relative mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 flex justify-center">
          <Logo to="/account" tone="light" />
        </div>
        {children}
      </div>
    </div>
  );
}

function RequireCustomer({ children }: { children: ReactNode }) {
  const { sessionToken } = useCustomerAuth();
  const location = useLocation();
  if (!sessionToken) return <Navigate to="/account/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** End-customer self-service under /account. Lazy-loaded. */
export default function AccountRoutes() {
  return (
    <CustomerAuthProvider>
      <AccountShell>
        <Routes>
          <Route path="setup" element={<Setup />} />
          <Route path="login" element={<CustomerLogin />} />
          <Route
            index
            element={
              <RequireCustomer>
                <Account />
              </RequireCustomer>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AccountShell>
    </CustomerAuthProvider>
  );
}
