import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "../../components/RequireAuth";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Login } from "./Login";
import { Overview } from "./Overview";
import { Customers } from "./Customers";
import { Transactions } from "./Transactions";
import { Ledger } from "./Ledger";
import { Settings } from "./Settings";
import { Widget } from "./Widget";
import { NotFound } from "../NotFound";

/** Everything under /app. Lazy-loaded so marketing visitors never download it. */
export default function DashboardRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="widget" element={<Widget />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
