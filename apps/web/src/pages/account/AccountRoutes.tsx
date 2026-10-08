import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { CustomerAuthProvider, useCustomerAuth } from "../../lib/customerAuth";
import { NotFound } from "../NotFound";
import { Account } from "./Account";
import { CustomerLogin } from "./CustomerLogin";
import { Setup } from "./Setup";

function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo to="/account" />
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
