import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { MarketingLayout } from "./layouts/MarketingLayout";
import { Home } from "./pages/marketing/Home";
import { HowItWorks } from "./pages/marketing/HowItWorks";
import { Developers } from "./pages/marketing/Developers";
import { Pricing } from "./pages/marketing/Pricing";
import { Signup } from "./pages/marketing/Signup";
import { NotFound } from "./pages/NotFound";

const DashboardRoutes = lazy(() => import("./pages/app/DashboardRoutes"));
const AccountRoutes = lazy(() => import("./pages/account/AccountRoutes"));

export function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Home />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="developers" element={<Developers />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="signup" element={<Signup />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="app/*"
        element={
          <Suspense fallback={<div className="p-8 text-sm text-ink-600">Loading…</div>}>
            <DashboardRoutes />
          </Suspense>
        }
      />
      <Route
        path="account/*"
        element={
          <Suspense fallback={<div className="p-8 text-sm text-ink-600">Loading…</div>}>
            <AccountRoutes />
          </Suspense>
        }
      />
    </Routes>
  );
}
